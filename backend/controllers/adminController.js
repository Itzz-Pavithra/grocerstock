import User from '../models/User.js';
import Retailer from '../models/Retailer.js';
import Wholesaler from '../models/Wholesaler.js';
import StockRequest from '../models/StockRequest.js';
import Response from '../models/Response.js';
import Category from '../models/Category.js';
import Product from '../models/Product.js';
import Notification from '../models/Notification.js';
import { safeExactRegex } from '../utils/regex.js';

export const getStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const retailerCount = await User.countDocuments({ role: 'retailer' });
    const wholesalerCount = await User.countDocuments({ role: 'wholesaler' });

    const totalRequests = await StockRequest.countDocuments();
    const pendingRequests = await StockRequest.countDocuments({ status: 'pending' });
    const respondedRequests = await StockRequest.countDocuments({ status: 'responded' });
    const acceptedRequests = await StockRequest.countDocuments({ status: 'accepted' });
    const rejectedRequests = await StockRequest.countDocuments({ status: 'rejected' });

    const totalBids = await Response.countDocuments();

    // Business verifications count
    const pendingVerifications = await Wholesaler.countDocuments({
      'businessVerification.status': 'pending',
    });

    const categories = await Category.find();
    const requestsByCategory = await Promise.all(
      categories.map(async (cat) => {
        const count = await StockRequest.countDocuments({ category: cat.name });
        return { name: cat.name, count };
      })
    );

    res.json({
      users: {
        total: totalUsers,
        retailers: retailerCount,
        wholesalers: wholesalerCount,
      },
      requests: {
        total: totalRequests,
        pending: pendingRequests,
        responded: respondedRequests,
        accepted: acceptedRequests,
        rejected: rejectedRequests,
      },
      bids: {
        total: totalBids,
      },
      pendingVerifications,
      requestsByCategory,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password');
    const formattedUsers = await Promise.all(
      users.map(async (user) => {
        let profile = null;
        if (user.role === 'retailer') {
          profile = await Retailer.findOne({ user: user._id });
        } else if (user.role === 'wholesaler') {
          profile = await Wholesaler.findOne({ user: user._id });
        }
        return {
          ...user.toObject(),
          profile,
        };
      })
    );
    res.json(formattedUsers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const toggleUserStatus = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.role === 'admin') {
      return res.status(400).json({ message: 'Cannot deactivate an admin account' });
    }

    user.isActive = !user.isActive;
    await user.save();

    res.json({ message: `User status changed successfully`, user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * PROBLEM 5: Business Verification Workflow for Wholesalers
 * Lists all wholesalers with business approval status
 */
export const getBusinessVerifications = async (req, res) => {
  try {
    const wholesalers = await Wholesaler.find().populate('user', 'email isActive isEmailVerified createdAt');

    const formatted = wholesalers.map((w) => {
      const status = w.businessVerification?.status || 'approved'; // legacy default approved
      return {
        _id: w._id,
        userId: w.user?._id,
        email: w.user?.email,
        companyName: w.companyName,
        phone: w.phone,
        address: w.address,
        city: w.city,
        state: w.state,
        postalCode: w.postalCode,
        businessRegNo: w.businessRegNo,
        categoriesSupplied: w.categoriesSupplied,
        deliveryRadiusKm: w.deliveryRadiusKm,
        isEmailVerified: w.user?.isEmailVerified || false,
        isActive: w.user?.isActive !== false,
        verificationStatus: status,
        reviewedAt: w.businessVerification?.reviewedAt,
        rejectionReason: w.businessVerification?.rejectionReason || '',
        registeredAt: w.createdAt,
      };
    });

    res.json({ success: true, verifications: formatted, count: formatted.length });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Approve wholesaler business verification
 */
export const approveBusinessVerification = async (req, res) => {
  const { id } = req.params;

  try {
    const wholesaler = await Wholesaler.findById(id);
    if (!wholesaler) {
      return res.status(404).json({ success: false, message: 'Wholesaler profile not found' });
    }

    wholesaler.businessVerification = {
      status: 'approved',
      reviewedBy: req.user._id,
      reviewedAt: new Date(),
      rejectionReason: '',
    };

    await wholesaler.save();

    // Notify wholesaler
    await Notification.create({
      user: wholesaler.user,
      message:
        'Your business registration has been verified and approved by the GrocerStock Administrator. You may now submit quotations and participate in B2B procurement.',
      type: 'business_verified',
    });

    res.json({
      success: true,
      message: `Business verification approved for ${wholesaler.companyName}`,
      wholesaler,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Reject wholesaler business verification with clear reason
 */
export const rejectBusinessVerification = async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  if (!reason || !reason.trim()) {
    return res.status(400).json({ success: false, message: 'A rejection reason is required.' });
  }

  try {
    const wholesaler = await Wholesaler.findById(id);
    if (!wholesaler) {
      return res.status(404).json({ success: false, message: 'Wholesaler profile not found' });
    }

    wholesaler.businessVerification = {
      status: 'rejected',
      reviewedBy: req.user._id,
      reviewedAt: new Date(),
      rejectionReason: reason.trim(),
    };

    await wholesaler.save();

    // Notify wholesaler
    await Notification.create({
      user: wholesaler.user,
      message: `Your business verification was rejected by administrator: "${reason.trim()}". Please update your profile or contact support.`,
      type: 'business_rejected',
    });

    res.json({
      success: true,
      message: `Business verification rejected for ${wholesaler.companyName}`,
      wholesaler,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getCategories = async (req, res) => {
  try {
    const categories = await Category.find().sort({ name: 1 });
    res.json(categories);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createCategory = async (req, res) => {
  const { name, description } = req.body;
  try {
    const categoryExists = await Category.findOne({ name: safeExactRegex(name) });
    if (categoryExists) {
      return res.status(400).json({ message: 'Category already exists' });
    }
    const category = await Category.create({ name, description });
    res.status(201).json(category);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const updateCategory = async (req, res) => {
  const { name, description } = req.body;
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }
    category.name = name || category.name;
    category.description = description || category.description;
    await category.save();
    res.json(category);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const deleteCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }
    await Category.findByIdAndDelete(req.params.id);
    res.json({ message: 'Category removed successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getProducts = async (req, res) => {
  try {
    const products = await Product.find().populate('category').sort({ name: 1 });
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createProduct = async (req, res) => {
  const { name, categoryId, brand, defaultUnit } = req.body;
  try {
    const productExists = await Product.findOne({ name: safeExactRegex(name) });
    if (productExists) {
      return res.status(400).json({ message: 'Product already exists' });
    }
    const product = await Product.create({
      name,
      category: categoryId,
      brand,
      defaultUnit,
    });
    const populated = await Product.findById(product._id).populate('category');
    res.status(201).json(populated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const updateProduct = async (req, res) => {
  const { name, categoryId, brand, defaultUnit } = req.body;
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    product.name = name || product.name;
    product.category = categoryId || product.category;
    product.brand = brand || product.brand;
    product.defaultUnit = defaultUnit || product.defaultUnit;

    await product.save();
    const populated = await Product.findById(product._id).populate('category');
    res.json(populated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: 'Product removed successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
