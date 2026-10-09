import GroupBuy from '../models/GroupBuy.js';
import Retailer from '../models/Retailer.js';
import Wholesaler from '../models/Wholesaler.js';
import Notification from '../models/Notification.js';
import { extractCoordinates, calculateHaversineDistance } from '../utils/geo.js';

/**
 * Get all active and completed group buying campaigns
 */
export const getGroupBuys = async (req, res) => {
  try {
    const { status, category, search } = req.query;
    const query = {};

    if (status) {
      query.status = status;
    } else {
      // By default show open and target_reached pools
      query.status = { $in: ['open', 'target_reached', 'awarded'] };
    }

    if (category && category !== 'All') {
      query.category = category;
    }

    const groupBuys = await GroupBuy.find(query).sort({ deadline: 1, createdAt: -1 });

    // Mark current user's participation status
    const currentUserId = req.user._id.toString();
    const formatted = groupBuys.map((gb) => {
      const myParticipation = gb.participants.find(
        (p) => p.retailer.toString() === currentUserId && p.status !== 'withdrawn'
      );
      return {
        ...gb.toObject(),
        isJoined: Boolean(myParticipation),
        myCommitment: myParticipation || null,
        isCreator: gb.creator.toString() === currentUserId,
      };
    });

    res.json({ success: true, groupBuys: formatted, count: formatted.length });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Create a new Hyperlocal Group Buying Campaign
 */
export const createGroupBuy = async (req, res) => {
  const { title, productName, category, brand, unit, targetMinQuantity, joiningDeadline, initialCommitment, discountTiers } =
    req.body;

  if (!title || !productName || !category || !unit || !targetMinQuantity || !joiningDeadline) {
    return res.status(400).json({ success: false, message: 'All required campaign fields must be provided.' });
  }

  const minTarget = Math.max(2, Number(targetMinQuantity));
  const myInitialQty = Math.max(1, Number(initialCommitment) || 1);

  try {
    const retailerProfile = await Retailer.findOne({ user: req.user._id });
    const coords = extractCoordinates(retailerProfile);

    const deadlineDate = new Date(joiningDeadline);
    if (deadlineDate.getTime() <= Date.now()) {
      return res.status(400).json({ success: false, message: 'Joining deadline must be in the future.' });
    }

    const storeName = retailerProfile?.storeName || 'My Grocery Store';

    const groupBuy = await GroupBuy.create({
      title: title.trim(),
      productName: productName.trim(),
      category: category.trim(),
      brand: brand ? brand.trim() : '',
      unit: unit.trim().toLowerCase(),
      targetMinQuantity: minTarget,
      currentCommittedQuantity: myInitialQty,
      joiningDeadline: deadlineDate,
      status: myInitialQty >= minTarget ? 'target_reached' : 'open',
      creator: req.user._id,
      creatorStoreName: storeName,
      city: retailerProfile?.city || '',
      latitude: coords.latitude,
      longitude: coords.longitude,
      participants: [
        {
          retailer: req.user._id,
          storeName,
          committedQuantity: myInitialQty,
          status: 'committed',
        },
      ],
      discountTiers: Array.isArray(discountTiers) ? discountTiers : [],
    });

    res.status(201).json({ success: true, message: 'Group buy created successfully', groupBuy });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * Retailer commits quantity to an open Group Buy
 */
export const joinGroupBuy = async (req, res) => {
  const { id } = req.params;
  const { committedQuantity } = req.body;

  const qty = Number(committedQuantity);
  if (isNaN(qty) || qty <= 0) {
    return res.status(400).json({ success: false, message: 'Committed quantity must be greater than zero.' });
  }

  try {
    const groupBuy = await GroupBuy.findById(id);
    if (!groupBuy) {
      return res.status(404).json({ success: false, message: 'Group buy not found' });
    }

    if (!['open', 'target_reached'].includes(groupBuy.status)) {
      return res.status(400).json({
        success: false,
        message: `This group buy campaign is ${groupBuy.status} and is no longer accepting commitments.`,
      });
    }

    if (new Date(groupBuy.joiningDeadline).getTime() <= Date.now()) {
      groupBuy.status = 'expired';
      await groupBuy.save();
      return res.status(400).json({ success: false, message: 'The commitment deadline has already passed.' });
    }

    const retailerProfile = await Retailer.findOne({ user: req.user._id });
    const storeName = retailerProfile?.storeName || 'Local Retailer';

    // Prevent duplicate active membership
    const existingIndex = groupBuy.participants.findIndex(
      (p) => p.retailer.toString() === req.user._id.toString()
    );

    if (existingIndex >= 0) {
      const existing = groupBuy.participants[existingIndex];
      if (existing.status !== 'withdrawn') {
        return res.status(400).json({
          success: false,
          message: `You are already committed with ${existing.committedQuantity} ${groupBuy.unit}. Update or withdraw your existing commitment.`,
        });
      }
      // Re-joining after previous withdrawal
      existing.status = 'committed';
      existing.committedQuantity = qty;
      existing.committedAt = new Date();
    } else {
      groupBuy.participants.push({
        retailer: req.user._id,
        storeName,
        committedQuantity: qty,
        status: 'committed',
      });
    }

    // Recalculate total quantity
    const totalCommitted = groupBuy.participants
      .filter((p) => p.status === 'committed')
      .reduce((sum, p) => sum + p.committedQuantity, 0);

    groupBuy.currentCommittedQuantity = totalCommitted;
    if (totalCommitted >= groupBuy.targetMinQuantity) {
      groupBuy.status = 'target_reached';
    }

    await groupBuy.save();

    res.json({
      success: true,
      message: `Successfully joined group buy with ${qty} ${groupBuy.unit}!`,
      groupBuy,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Retailer withdraws their commitment before deadline
 */
export const withdrawFromGroupBuy = async (req, res) => {
  const { id } = req.params;

  try {
    const groupBuy = await GroupBuy.findById(id);
    if (!groupBuy) {
      return res.status(404).json({ success: false, message: 'Group buy not found' });
    }

    if (new Date(groupBuy.joiningDeadline).getTime() <= Date.now()) {
      return res.status(400).json({
        success: false,
        message: 'Withdrawal deadline has passed. Commitments cannot be withdrawn after the deadline.',
      });
    }

    if (groupBuy.status === 'awarded') {
      return res.status(400).json({
        success: false,
        message: 'Supplier offer has already been accepted and awarded for this group purchase.',
      });
    }

    const participant = groupBuy.participants.find(
      (p) => p.retailer.toString() === req.user._id.toString() && p.status === 'committed'
    );

    if (!participant) {
      return res.status(400).json({ success: false, message: 'You have no active commitment in this group buy.' });
    }

    participant.status = 'withdrawn';

    const totalCommitted = groupBuy.participants
      .filter((p) => p.status === 'committed')
      .reduce((sum, p) => sum + p.committedQuantity, 0);

    groupBuy.currentCommittedQuantity = totalCommitted;
    if (totalCommitted < groupBuy.targetMinQuantity && groupBuy.status === 'target_reached') {
      groupBuy.status = 'open';
    }

    await groupBuy.save();

    res.json({
      success: true,
      message: 'Your commitment was safely withdrawn.',
      groupBuy,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Wholesaler submits a bulk wholesale tier offer on a group buy
 */
export const submitGroupBuyBulkOffer = async (req, res) => {
  const { id } = req.params;
  const { offeredPricePerUnit, minRequiredQuantity, deliveryEstimate } = req.body;

  const price = Number(offeredPricePerUnit);
  if (isNaN(price) || price <= 0) {
    return res.status(400).json({ success: false, message: 'Offered price per unit must be greater than zero.' });
  }

  try {
    const wholesalerProfile = await Wholesaler.findOne({ user: req.user._id });
    if (!wholesalerProfile) {
      return res.status(404).json({ success: false, message: 'Wholesaler profile not found' });
    }

    if (wholesalerProfile.businessVerification?.status !== 'approved') {
      return res.status(403).json({
        success: false,
        message: 'Wholesalers must have verified business status to submit group buying offers.',
      });
    }

    const groupBuy = await GroupBuy.findById(id);
    if (!groupBuy) {
      return res.status(404).json({ success: false, message: 'Group buy not found' });
    }

    if (groupBuy.status === 'awarded') {
      return res.status(400).json({ success: false, message: 'This group purchase has already been awarded.' });
    }

    // Add or update bulk offer
    const existingOfferIndex = groupBuy.supplierOffers.findIndex(
      (o) => o.wholesaler.toString() === req.user._id.toString()
    );

    const offerData = {
      wholesaler: req.user._id,
      companyName: wholesalerProfile.companyName,
      offeredPricePerUnit: price,
      minRequiredQuantity: Number(minRequiredQuantity) || groupBuy.targetMinQuantity,
      deliveryEstimate: deliveryEstimate || '2-3 business days',
      status: 'pending',
      createdAt: new Date(),
    };

    if (existingOfferIndex >= 0) {
      groupBuy.supplierOffers[existingOfferIndex] = offerData;
    } else {
      groupBuy.supplierOffers.push(offerData);
    }

    await groupBuy.save();

    // Notify creator
    await Notification.create({
      user: groupBuy.creator,
      message: `New bulk offer of ₹${price}/${groupBuy.unit} submitted by ${wholesalerProfile.companyName} for Group Buy "${groupBuy.title}".`,
      type: 'group_offer_received',
    });

    res.json({
      success: true,
      message: 'Bulk offer submitted successfully',
      groupBuy,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Creator awards/accepts a supplier bulk offer
 */
export const awardGroupBuyOffer = async (req, res) => {
  const { id, offerId } = req.params;

  try {
    const groupBuy = await GroupBuy.findById(id);
    if (!groupBuy) {
      return res.status(404).json({ success: false, message: 'Group buy not found' });
    }

    if (groupBuy.creator.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Only the group buy creator can award an offer.' });
    }

    const offer = groupBuy.supplierOffers.id(offerId);
    if (!offer) {
      return res.status(404).json({ success: false, message: 'Supplier offer not found' });
    }

    offer.status = 'accepted';
    groupBuy.awardedOffer = offer;
    groupBuy.status = 'awarded';

    // Reject other offers
    groupBuy.supplierOffers.forEach((o) => {
      if (o._id.toString() !== offerId) {
        o.status = 'rejected';
      }
    });

    await groupBuy.save();

    // Notify winning wholesaler
    await Notification.create({
      user: offer.wholesaler,
      message: `Congratulations! Your bulk offer on Group Buy "${groupBuy.title}" was selected by the stores!`,
      type: 'group_offer_awarded',
    });

    // Notify participating retailers
    const activeParticipants = groupBuy.participants.filter((p) => p.status === 'committed');
    for (const p of activeParticipants) {
      await Notification.create({
        user: p.retailer,
        message: `Group Buy "${groupBuy.title}" is awarded to ${offer.companyName} at ₹${offer.offeredPricePerUnit}/${groupBuy.unit}!`,
        type: 'group_buy_completed',
      });
    }

    res.json({
      success: true,
      message: `Group buy awarded to ${offer.companyName} at ₹${offer.offeredPricePerUnit}/${groupBuy.unit}`,
      groupBuy,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
