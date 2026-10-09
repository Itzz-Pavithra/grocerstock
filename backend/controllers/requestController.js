import StockRequest from '../models/StockRequest.js';
import User from '../models/User.js';
import Retailer from '../models/Retailer.js';
import Wholesaler from '../models/Wholesaler.js';
import Response from '../models/Response.js';
import Notification from '../models/Notification.js';
import { safeSubstringRegex } from '../utils/regex.js';
import { calculateHaversineDistance, extractCoordinates } from '../utils/geo.js';

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
        primaryProductName =
          finalItems.length === 1
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

    const retailerProfile = await Retailer.findOne({ user: req.user._id });
    const storeName = retailerProfile ? retailerProfile.storeName : 'A Local Retailer';
    const retCoords = extractCoordinates(retailerProfile);

    // PROBLEM 4 FIX: Hyperlocal Supplier Filtering & Eligible Broadcasting
    // Only broadcast to active wholesalers who are business-approved (or legacy accounts)
    const activeWholesalerUsers = await User.find({
      role: 'wholesaler',
      isActive: true,
    });
    const wholesalerUserIds = activeWholesalerUsers.map((u) => u._id);

    const wholesalerProfiles = await Wholesaler.find({
      user: { $in: wholesalerUserIds },
      // Exclude rejected or explicitly pending applications
      'businessVerification.status': { $nin: ['rejected'] },
    });

    const eligibleWholesalers = [];
    let isFallbackExpanded = false;

    if (retCoords.latitude !== null && retCoords.longitude !== null) {
      // 1. Primary pass: Match wholesalers within their delivery radius
      for (const w of wholesalerProfiles) {
        const wCoords = extractCoordinates(w);
        if (wCoords.latitude !== null && wCoords.longitude !== null) {
          const distKm = calculateHaversineDistance(
            retCoords.latitude,
            retCoords.longitude,
            wCoords.latitude,
            wCoords.longitude
          );

          const maxRadius = w.deliveryRadiusKm || 25;
          if (distKm !== null && distKm <= maxRadius) {
            eligibleWholesalers.push({ wholesaler: w, distanceKm: distKm });
          }
        } else {
          // If coordinates missing on wholesaler, include in primary pool
          eligibleWholesalers.push({ wholesaler: w, distanceKm: null });
        }
      }

      // 2. Fallback pass: If no nearby wholesalers within preferred radius, expand radius
      if (eligibleWholesalers.length === 0 && wholesalerProfiles.length > 0) {
        isFallbackExpanded = true;
        for (const w of wholesalerProfiles) {
          const wCoords = extractCoordinates(w);
          if (wCoords.latitude !== null && wCoords.longitude !== null) {
            const distKm = calculateHaversineDistance(
              retCoords.latitude,
              retCoords.longitude,
              wCoords.latitude,
              wCoords.longitude
            );
            const expandedRadius = (w.deliveryRadiusKm || 25) * 2;
            if (distKm !== null && distKm <= expandedRadius) {
              eligibleWholesalers.push({ wholesaler: w, distanceKm: distKm });
            }
          } else {
            eligibleWholesalers.push({ wholesaler: w, distanceKm: null });
          }
        }
      }
    } else {
      // Retailer coordinates not configured: notify active verified wholesalers
      for (const w of wholesalerProfiles) {
        eligibleWholesalers.push({ wholesaler: w, distanceKm: null });
      }
    }

    const noticeDesc =
      finalItems.length > 1
        ? `Procurement Request #${stockRequest._id.toString().slice(-6)} for ${finalItems.length} products`
        : `${stockRequest.quantity} ${stockRequest.unit} of "${stockRequest.productName}"`;

    const expandedNote = isFallbackExpanded ? ' [Expanded Delivery Zone]' : '';

    const notifications = eligibleWholesalers.map(({ wholesaler, distanceKm }) => {
      const distInfo = distanceKm !== null ? ` (~${distanceKm} km away)` : '';
      return {
        user: wholesaler.user,
        message: `New stock request${expandedNote}: ${noticeDesc} from ${storeName}${distInfo}.`,
        type: 'request_received',
      };
    });

    if (notifications.length > 0) {
      await Notification.insertMany(notifications);
    }

    res.status(201).json({
      success: true,
      stockRequest,
      matchedWholesalersCount: eligibleWholesalers.length,
      isFallbackExpanded,
    });
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

    if (search && search.trim()) {
      query.$or = [
        { productName: safeSubstringRegex(search) },
        { brand: safeSubstringRegex(search) },
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
          const responsesCount = await Response.countDocuments({ stockRequest: reqObj._id });
          return {
            ...reqObj.toObject(),
            retailerProfile: profile,
            responsesCount,
          };
        })
      );
    } else {
      formattedRequests = await Promise.all(
        requests.map(async (reqObj) => {
          const responsesCount = await Response.countDocuments({ stockRequest: reqObj._id });
          return {
            ...reqObj.toObject(),
            responsesCount,
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

/**
 * PROBLEM 1 & 4: Wholesaler Incoming Requests Feed
 * Returns open, eligible retailer requests with distance calculations,
 * delivery zone coverage, and indicators of whether this wholesaler has submitted a bid.
 */
export const getIncomingRequestsForWholesaler = async (req, res) => {
  try {
    const wholesalerProfile = await Wholesaler.findOne({ user: req.user._id });
    const wCoords = extractCoordinates(wholesalerProfile);
    const maxRadius = wholesalerProfile?.deliveryRadiusKm || 25;

    // Open requests awaiting fulfillment
    const openRequests = await StockRequest.find({
      status: { $in: ['pending', 'responded', 'partially_fulfilled'] },
    }).sort({ createdAt: -1 });

    const formatted = await Promise.all(
      openRequests.map(async (reqObj) => {
        const retailerProfile = await Retailer.findOne({ user: reqObj.retailer });
        const retCoords = extractCoordinates(retailerProfile);

        let distanceKm = null;
        let isWithinRadius = true;

        if (
          wCoords.latitude !== null &&
          wCoords.longitude !== null &&
          retCoords.latitude !== null &&
          retCoords.longitude !== null
        ) {
          distanceKm = calculateHaversineDistance(
            wCoords.latitude,
            wCoords.longitude,
            retCoords.latitude,
            retCoords.longitude
          );
          if (distanceKm !== null && distanceKm > maxRadius) {
            isWithinRadius = false;
          }
        }

        // Check if this wholesaler has already quoted
        const myQuotation = await Response.findOne({
          stockRequest: reqObj._id,
          wholesaler: req.user._id,
        });

        const responsesCount = await Response.countDocuments({ stockRequest: reqObj._id });

        const remainingQty =
          reqObj.remainingQuantity !== undefined && reqObj.remainingQuantity !== null
            ? reqObj.remainingQuantity
            : reqObj.quantity;

        return {
          ...reqObj.toObject(),
          retailerProfile: retailerProfile
            ? {
                storeName: retailerProfile.storeName,
                city: retailerProfile.city,
                state: retailerProfile.state,
                address: retailerProfile.address,
              }
            : null,
          distanceKm,
          isWithinRadius,
          hasQuoted: Boolean(myQuotation),
          myQuotation,
          responsesCount,
          remainingQuantity: remainingQty,
        };
      })
    );

    // Sort by distance (closest first), then by creation date
    formatted.sort((a, b) => {
      if (a.distanceKm !== null && b.distanceKm !== null) {
        return a.distanceKm - b.distanceKm;
      }
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    res.json({
      success: true,
      requests: formatted,
      count: formatted.length,
      wholesalerDeliveryRadius: maxRadius,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
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

export const deleteRequest = async (req, res) => {
  try {
    const stockRequest = await StockRequest.findById(req.params.id);
    if (!stockRequest) {
      return res.status(404).json({ success: false, message: 'Stock request not found' });
    }

    // Only the retailer who created it can cancel
    if (stockRequest.retailer.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to cancel this request' });
    }

    // Can only cancel pending or responded requests (not accepted/fulfilled)
    if (!['pending', 'responded'].includes(stockRequest.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel a request with status "${stockRequest.status}". Only pending or responded requests can be cancelled.`,
      });
    }

    // PROBLEM 6.E FIX: Prevent orphaned quotations when request is deleted
    const pendingResponses = await Response.find({
      stockRequest: stockRequest._id,
      status: 'pending',
    });

    if (pendingResponses.length > 0) {
      await Response.updateMany(
        { stockRequest: stockRequest._id, status: 'pending' },
        { status: 'rejected' }
      );

      const cancelNotices = pendingResponses.map((r) => ({
        user: r.wholesaler,
        message: `Request for "${stockRequest.productName}" was cancelled by the retailer. Your pending quotation has been closed.`,
        type: 'request_cancelled',
      }));
      await Notification.insertMany(cancelNotices);
    }

    await StockRequest.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Stock request cancelled successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
