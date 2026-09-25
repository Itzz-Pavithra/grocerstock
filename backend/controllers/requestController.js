import StockRequest from '../models/StockRequest.js';
import User from '../models/User.js';
import Retailer from '../models/Retailer.js';
import Notification from '../models/Notification.js';

export const createRequest = async (req, res) => {
  const { productName, category, brand, quantity, unit, urgency, preferredDeliveryDate, remarks, items } = req.body;

  try {
    let finalItems = [];
    let primaryProductName = productName;
    let primaryCategory = category;
    let primaryBrand = brand || '';
    let primaryQuantity = quantity ? Number(quantity) : 0;
    let primaryUnit = unit || 'kg';

    if (items && Array.isArray(items) && items.length > 0) {
      finalItems = items.map((it) => ({
        productName: (it.productName || '').trim(),
        category: (it.category || 'General').trim(),
        brand: (it.brand || '').trim(),
        quantity: Math.max(1, Number(it.quantity) || 1),
        unit: (it.unit || 'kg').trim(),
        fulfilledQuantity: 0,
        remainingQuantity: Math.max(1, Number(it.quantity) || 1),
        remarks: (it.remarks || '').trim(),
      }));

      // Backward compatibility fallback for primary fields
      if (!primaryProductName && finalItems.length > 0) {
        primaryProductName = finalItems.length === 1 
          ? finalItems[0].productName 
          : `${finalItems[0].productName} + ${finalItems.length - 1} more items`;
        primaryCategory = finalItems[0].category;
        primaryBrand = finalItems[0].brand;
        primaryQuantity = finalItems.reduce((acc, it) => acc + it.quantity, 0);
        primaryUnit = finalItems[0].unit;
      }
    }

    if (!primaryProductName) {
      return res.status(400).json({ message: 'Product name or items array is required' });
    }

    const stockRequest = await StockRequest.create({
      retailer: req.user._id,
      productName: primaryProductName,
      category: primaryCategory || 'General',
      brand: primaryBrand,
      quantity: primaryQuantity || 1,
      unit: primaryUnit,
      urgency: urgency || 'medium',
      preferredDeliveryDate: preferredDeliveryDate || new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      remarks,
      items: finalItems,
      requestedQuantity: primaryQuantity || 1,
      fulfilledQuantity: 0,
      remainingQuantity: primaryQuantity || 1,
      status: 'pending',
    });

    const wholesalers = await User.find({ role: 'wholesaler', isActive: true });
    const retailerProfile = await Retailer.findOne({ user: req.user._id });
    const storeName = retailerProfile ? retailerProfile.storeName : 'A Retailer';

    const noticeDesc = finalItems.length > 1
      ? `Procurement Request #${stockRequest._id.toString().slice(-6)} for ${finalItems.length} products`
      : `${stockRequest.quantity} ${stockRequest.unit} of "${stockRequest.productName}"`;

    const notifications = wholesalers.map((wholesaler) => ({
      user: wholesaler._id,
      message: `New stock request: ${noticeDesc} from ${storeName}.`,
      type: 'request_received',
    }));

    if (notifications.length > 0) {
      await Notification.insertMany(notifications);
    }

    res.status(201).json(stockRequest);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};


export const getRequests = async (req, res) => {
  try {
    const { search, category, status, urgency, sort, page = 1, limit = 10 } = req.query;

    const query = {};

    if (req.user.role === 'retailer') {
      query.retailer = req.user._id;
    }

    if (search) {
      query.$or = [
        { productName: { $regex: search, $options: 'i' } },
        { brand: { $regex: search, $options: 'i' } },
      ];
    }

    if (category) {
      query.category = category;
    }

    if (status) {
      query.status = status;
    }

    if (urgency) {
      query.urgency = urgency;
    }

    let sortOptions = { createdAt: -1 };
    if (sort) {
      if (sort === 'date_asc') sortOptions = { createdAt: 1 };
      else if (sort === 'qty_desc') sortOptions = { quantity: -1 };
      else if (sort === 'qty_asc') sortOptions = { quantity: 1 };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const requests = await StockRequest.find(query)
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await StockRequest.countDocuments(query);

    let formattedRequests = requests;
    if (req.user.role === 'wholesaler' || req.user.role === 'admin') {
      formattedRequests = await Promise.all(
        requests.map(async (reqObj) => {
          const profile = await Retailer.findOne({ user: reqObj.retailer });
          return {
            ...reqObj.toObject(),
            retailerProfile: profile,
          };
        })
      );
    }

    res.json({
      requests: formattedRequests,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      total,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getRequestById = async (req, res) => {
  try {
    const stockRequest = await StockRequest.findById(req.params.id);
    if (!stockRequest) {
      return res.status(404).json({ message: 'Stock request not found' });
    }

    const retailerProfile = await Retailer.findOne({ user: stockRequest.retailer });
    
    res.json({
      ...stockRequest.toObject(),
      retailerProfile,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
