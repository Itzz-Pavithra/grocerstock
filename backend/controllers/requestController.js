import StockRequest from '../models/StockRequest.js';
import User from '../models/User.js';
import Retailer from '../models/Retailer.js';
import Notification from '../models/Notification.js';

export const createRequest = async (req, res) => {
  const { productName, category, brand, quantity, unit, urgency, preferredDeliveryDate, remarks } = req.body;

  try {
    const stockRequest = await StockRequest.create({
      retailer: req.user._id,
      productName,
      category,
      brand,
      quantity,
      unit,
      urgency,
      preferredDeliveryDate,
      remarks,
    });

    const wholesalers = await User.find({ role: 'wholesaler', isActive: true });
    const retailerProfile = await Retailer.findOne({ user: req.user._id });
    const storeName = retailerProfile ? retailerProfile.storeName : 'A Retailer';

    const notifications = wholesalers.map((wholesaler) => ({
      user: wholesaler._id,
      message: `New stock request for ${quantity} ${unit} of "${productName}" from ${storeName}.`,
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
