import User from '../models/User.js';
import Retailer from '../models/Retailer.js';
import Wholesaler from '../models/Wholesaler.js';
import StockRequest from '../models/StockRequest.js';
import Response from '../models/Response.js';
import Order from '../models/Order.js';
import Category from '../models/Category.js';
import Product from '../models/Product.js';
import Inventory from '../models/Inventory.js';
import RetailerInventory from '../models/RetailerInventory.js';
import Notification from '../models/Notification.js';
import Dispute from '../models/Dispute.js';
import AuditLog from '../models/AuditLog.js';
import { logAdminAction } from '../services/auditService.js';
import { COMMON_100_CATALOGUE } from '../services/commonInventoryService.js';
import { safeExactRegex, safeSubstringRegex } from '../utils/regex.js';
import mongoose from 'mongoose';

/**
 * MODULE 1: Real Platform Statistics for Admin Dashboard
 */
export const getStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const retailerCount = await User.countDocuments({ role: 'retailer' });
    const wholesalerCount = await User.countDocuments({ role: 'wholesaler' });
    const adminCount = await User.countDocuments({ role: 'admin' });

    // Business verifications
    const verifiedWholesalers = await Wholesaler.countDocuments({
      'businessVerification.status': 'approved',
    });
    const pendingVerifications = await Wholesaler.countDocuments({
      'businessVerification.status': 'pending',
    });
    const rejectedVerifications = await Wholesaler.countDocuments({
      'businessVerification.status': 'rejected',
    });

    // Stock requests
    const totalRequests = await StockRequest.countDocuments();
    const activeRequests = await StockRequest.countDocuments({
      status: { $in: ['pending', 'responded', 'partially_fulfilled'] },
    });
    const acceptedRequests = await StockRequest.countDocuments({ status: 'accepted' });
    const rejectedRequests = await StockRequest.countDocuments({ status: 'rejected' });

    // Bids / Quotations
    const totalBids = await Response.countDocuments();
    const openBids = await Response.countDocuments({ status: 'pending' });

    // Orders
    const totalOrders = await Order.countDocuments();
    const activeOrders = await Order.countDocuments({
      status: { $in: ['accepted', 'processing', 'packed', 'shipped', 'out_for_delivery'] },
    });
    const completedOrders = await Order.countDocuments({ status: 'delivered' });
    const cancelledOrders = await Order.countDocuments({ status: 'cancelled' });

    // Total fulfilled order volume value
    const orderSumResult = await Order.aggregate([
      { $match: { status: { $ne: 'cancelled' } } },
      { $group: { _id: null, totalValue: { $sum: '$totalAmount' } } },
    ]);
    const totalOrderValue = orderSumResult.length > 0 ? Number(orderSumResult[0].totalValue.toFixed(2)) : 0;

    // Open Disputes
    const openDisputes = await Dispute.countDocuments({
      status: { $in: ['open', 'under_investigation'] },
    });

    // Order status distribution
    const orderStatusAgg = await Order.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
    const orderStatusDistribution = orderStatusAgg.map((item) => ({
      status: item._id,
      count: item.count,
    }));

    // Category distribution from StockRequests
    const categories = await Category.find().sort({ name: 1 });
    const requestsByCategory = await Promise.all(
      categories.map(async (cat) => {
        const count = await StockRequest.countDocuments({ category: cat.name });
        return { name: cat.name, count };
      })
    );

    // Recent activity timeline (latest 8 events across orders and requests)
    const recentOrders = await Order.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('productName quantity unit totalAmount status createdAt');

    const recentRequests = await StockRequest.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('productName quantity unit urgency status createdAt');

    const recentActivity = [
      ...recentOrders.map((o) => ({
        type: 'order',
        id: o._id,
        title: `Order #${o._id.toString().slice(-6)}: ${o.productName} (${o.quantity} ${o.unit})`,
        status: o.status,
        amount: o.totalAmount,
        createdAt: o.createdAt,
      })),
      ...recentRequests.map((r) => ({
        type: 'request',
        id: r._id,
        title: `Request #${r._id.toString().slice(-6)}: ${r.productName} (${r.quantity} ${r.unit})`,
        status: r.status,
        urgency: r.urgency,
        createdAt: r.createdAt,
      })),
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 8);

    res.json({
      success: true,
      users: {
        total: totalUsers,
        retailers: retailerCount,
        wholesalers: wholesalerCount,
        admins: adminCount,
      },
      verifications: {
        verified: verifiedWholesalers,
        pending: pendingVerifications,
        rejected: rejectedVerifications,
      },
      requests: {
        total: totalRequests,
        active: activeRequests,
        accepted: acceptedRequests,
        rejected: rejectedRequests,
      },
      bids: {
        total: totalBids,
        open: openBids,
      },
      orders: {
        total: totalOrders,
        active: activeOrders,
        completed: completedOrders,
        cancelled: cancelledOrders,
        totalValue: totalOrderValue,
      },
      disputes: {
        open: openDisputes,
      },
      pendingVerifications,
      orderStatusDistribution,
      requestsByCategory,
      recentActivity,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * MODULE 3: Real User Management
 */
export const getUsers = async (req, res) => {
  try {
    const { role, search, status } = req.query;
    const query = {};

    if (role && role !== 'all') {
      query.role = role;
    }

    if (status === 'active') {
      query.isActive = true;
    } else if (status === 'inactive') {
      query.isActive = false;
    }

    if (search && search.trim()) {
      query.email = safeSubstringRegex(search);
    }

    const users = await User.find(query).select('-password').sort({ createdAt: -1 });

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

    res.json({ success: true, users: formattedUsers, count: formattedUsers.length });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const toggleUserStatus = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.role === 'admin' && user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'You cannot deactivate your own administrator account' });
    }

    if (user.role === 'admin' && !user.isActive) {
      // allow reactivating admin
    } else if (user.role === 'admin') {
      return res.status(400).json({ success: false, message: 'Administrator accounts cannot be deactivated' });
    }

    const previousState = user.isActive;
    user.isActive = !user.isActive;
    await user.save();

    const actionText = user.isActive ? 'ACTIVATED' : 'SUSPENDED';
    await logAdminAction({
      action: user.isActive ? 'USER_ACTIVATION' : 'USER_SUSPENSION',
      adminId: req.user._id,
      adminEmail: req.user.email,
      targetModel: 'User',
      targetId: user._id,
      details: `Administrator ${actionText.toLowerCase()} user ${user.email} (${user.role})`,
      metadata: { role: user.role, previousState, newState: user.isActive },
    });

    res.json({
      success: true,
      message: `User account ${user.email} has been ${actionText.toLowerCase()}`,
      user: {
        _id: user._id,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * MODULE 2: Business Verification Workflow for Wholesalers
 */
export const getBusinessVerifications = async (req, res) => {
  try {
    const wholesalers = await Wholesaler.find()
      .populate('user', 'email isActive isEmailVerified createdAt')
      .sort({ createdAt: -1 });

    const formatted = wholesalers.map((w) => {
      const status = w.businessVerification?.status || 'approved';
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
        categoriesSupplied: w.categoriesSupplied || [],
        deliveryRadiusKm: w.deliveryRadiusKm || 25,
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

export const approveBusinessVerification = async (req, res) => {
  const { id } = req.params;

  try {
    const wholesaler = await Wholesaler.findById(id);
    if (!wholesaler) {
      return res.status(404).json({ success: false, message: 'Wholesaler profile not found' });
    }

    if (wholesaler.businessVerification?.status === 'approved') {
      return res.status(400).json({ success: false, message: 'This application is already approved.' });
    }

    wholesaler.businessVerification = {
      status: 'approved',
      reviewedBy: req.user._id,
      reviewedAt: new Date(),
      rejectionReason: '',
    };
    await wholesaler.save();

    await Notification.create({
      user: wholesaler.user,
      message:
        'Your business registration has been verified and approved by the Administrator. You may now submit quotations and participate in B2B procurement.',
      type: 'business_verified',
    });

    await logAdminAction({
      action: 'BUSINESS_VERIFICATION_APPROVED',
      adminId: req.user._id,
      adminEmail: req.user.email,
      targetModel: 'Wholesaler',
      targetId: wholesaler._id,
      details: `Approved business verification for "${wholesaler.companyName}" (Reg No: ${wholesaler.businessRegNo || 'N/A'})`,
      metadata: { companyName: wholesaler.companyName, regNo: wholesaler.businessRegNo },
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

    await Notification.create({
      user: wholesaler.user,
      message: `Your business verification was rejected by administrator: "${reason.trim()}". Please update your profile with valid documentation.`,
      type: 'business_rejected',
    });

    await logAdminAction({
      action: 'BUSINESS_VERIFICATION_REJECTED',
      adminId: req.user._id,
      adminEmail: req.user.email,
      targetModel: 'Wholesaler',
      targetId: wholesaler._id,
      details: `Rejected business verification for "${wholesaler.companyName}". Reason: ${reason.trim()}`,
      metadata: { companyName: wholesaler.companyName, reason: reason.trim() },
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

/**
 * MODULE 4: Categories Master (With Safe Dependency-Check Before Deletion)
 */
export const getCategories = async (req, res) => {
  try {
    const categories = await Category.find().sort({ name: 1 });
    res.json({ success: true, categories });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createCategory = async (req, res) => {
  const { name, description } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, message: 'Category name is required' });
  }

  try {
    const categoryExists = await Category.findOne({ name: safeExactRegex(name) });
    if (categoryExists) {
      return res.status(400).json({ success: false, message: `Category "${name}" already exists` });
    }

    const category = await Category.create({ name: name.trim(), description: (description || '').trim() });

    await logAdminAction({
      action: 'CATEGORY_CREATE',
      adminId: req.user._id,
      adminEmail: req.user.email,
      targetModel: 'Category',
      targetId: category._id,
      details: `Created new category "${category.name}"`,
    });

    res.status(201).json({ success: true, category });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const updateCategory = async (req, res) => {
  const { name, description } = req.body;
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    const oldName = category.name;
    if (name && name.trim()) {
      const duplicate = await Category.findOne({
        _id: { $ne: category._id },
        name: safeExactRegex(name.trim()),
      });
      if (duplicate) {
        return res.status(400).json({ success: false, message: `Another category named "${name}" already exists` });
      }
      category.name = name.trim();
    }
    if (description !== undefined) {
      category.description = description.trim();
    }
    await category.save();

    await logAdminAction({
      action: 'CATEGORY_UPDATE',
      adminId: req.user._id,
      adminEmail: req.user.email,
      targetModel: 'Category',
      targetId: category._id,
      details: `Updated category "${oldName}" ${oldName !== category.name ? `to "${category.name}"` : ''}`,
    });

    res.json({ success: true, category });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const deleteCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    // Dependency check: prevent deleting categories that are referenced by existing items!
    const [reqCount, prodCount, whInvCount, retInvCount] = await Promise.all([
      StockRequest.countDocuments({ category: category.name }),
      Product.countDocuments({ category: category._id }),
      Inventory.countDocuments({ category: category.name }),
      RetailerInventory.countDocuments({ category: category.name }),
    ]);

    const totalUsage = reqCount + prodCount + whInvCount + retInvCount;
    if (totalUsage > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete category "${category.name}" because it is currently in use by ${totalUsage} item(s) (${reqCount} requests, ${whInvCount + retInvCount} inventory records, ${prodCount} catalog products). Please reassign or remove referenced items first.`,
      });
    }

    const deletedName = category.name;
    await Category.findByIdAndDelete(req.params.id);

    await logAdminAction({
      action: 'CATEGORY_DELETE',
      adminId: req.user._id,
      adminEmail: req.user.email,
      targetModel: 'Category',
      targetId: req.params.id,
      details: `Deleted category "${deletedName}"`,
    });

    res.json({ success: true, message: `Category "${deletedName}" removed successfully` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * MODULE 6: Orders & Disputes
 */
export const getAdminOrders = async (req, res) => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;
    const query = {};

    if (status && status !== 'all') {
      query.status = status;
    }

    if (search && search.trim()) {
      query.$or = [
        { productName: safeSubstringRegex(search) },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('stockRequest', 'urgency category preferredDeliveryDate');

    const total = await Order.countDocuments(query);

    const formatted = await Promise.all(
      orders.map(async (ord) => {
        const retailerProfile = await Retailer.findOne({ user: ord.retailer });
        const wholesalerProfile = await Wholesaler.findOne({ user: ord.wholesaler });
        const dispute = await Dispute.findOne({ order: ord._id });
        return {
          ...ord.toObject(),
          retailerProfile,
          wholesalerProfile,
          dispute,
        };
      })
    );

    res.json({
      success: true,
      orders: formatted,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAdminDisputes = async (req, res) => {
  try {
    const { status } = req.query;
    const query = {};
    if (status && status !== 'all') {
      query.status = status;
    }

    const disputes = await Dispute.find(query)
      .sort({ createdAt: -1 })
      .populate('order')
      .populate('raisedBy', 'email role')
      .populate('resolvedBy', 'email');

    const formatted = await Promise.all(
      disputes.map(async (disp) => {
        const ord = disp.order;
        let retailerProfile = null;
        let wholesalerProfile = null;
        if (ord) {
          retailerProfile = await Retailer.findOne({ user: ord.retailer });
          wholesalerProfile = await Wholesaler.findOne({ user: ord.wholesaler });
        }
        return {
          ...disp.toObject(),
          retailerProfile,
          wholesalerProfile,
        };
      })
    );

    res.json({ success: true, disputes: formatted, count: formatted.length });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createOrderDispute = async (req, res) => {
  const { orderId } = req.params;
  const { reason, description } = req.body;

  if (!reason || !description) {
    return res.status(400).json({ success: false, message: 'Dispute reason and description are required' });
  }

  try {
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const existingDispute = await Dispute.findOne({ order: orderId, status: { $ne: 'dismissed' } });
    if (existingDispute) {
      return res.status(400).json({
        success: false,
        message: `An active dispute (${existingDispute.disputeId}) already exists for this order`,
      });
    }

    const disputeId = `DISP-${Date.now().toString().slice(-6)}`;
    const dispute = await Dispute.create({
      order: order._id,
      disputeId,
      raisedBy: req.user._id,
      raisedByRole: req.user.role,
      reason: reason.trim(),
      description: description.trim(),
      status: 'open',
    });

    // Notify counterparties
    await Notification.create({
      user: order.retailer,
      message: `A dispute (${disputeId}) has been logged for Order #${order._id.toString().slice(-6)}. Administrator investigation is open.`,
      type: 'order_dispute',
    });
    await Notification.create({
      user: order.wholesaler,
      message: `A dispute (${disputeId}) has been logged for Order #${order._id.toString().slice(-6)}. Administrator investigation is open.`,
      type: 'order_dispute',
    });

    await logAdminAction({
      action: 'DISPUTE_OPENED',
      adminId: req.user._id,
      adminEmail: req.user.email,
      targetModel: 'Dispute',
      targetId: dispute._id,
      details: `Logged dispute ${disputeId} on Order #${order._id.toString().slice(-6)}. Reason: ${reason.trim()}`,
    });

    res.status(201).json({ success: true, dispute });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const resolveOrderDispute = async (req, res) => {
  const { id } = req.params;
  const { status, investigationNotes, resolutionOutcome } = req.body;

  if (!['under_investigation', 'resolved', 'dismissed'].includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid dispute status outcome' });
  }

  try {
    const dispute = await Dispute.findById(id).populate('order');
    if (!dispute) {
      return res.status(404).json({ success: false, message: 'Dispute record not found' });
    }

    dispute.status = status;
    if (investigationNotes) dispute.investigationNotes = investigationNotes.trim();
    if (resolutionOutcome) dispute.resolutionOutcome = resolutionOutcome.trim();

    if (status === 'resolved' || status === 'dismissed') {
      dispute.resolvedBy = req.user._id;
      dispute.resolvedAt = new Date();
    }

    await dispute.save();

    // Notify parties
    const order = dispute.order;
    if (order) {
      const msg = `Dispute ${dispute.disputeId} status updated to ${status.toUpperCase().replace(/_/g, ' ')}. ${resolutionOutcome ? `Outcome: ${resolutionOutcome}` : ''}`;
      await Notification.create({ user: order.retailer, message: msg, type: 'dispute_resolved' });
      await Notification.create({ user: order.wholesaler, message: msg, type: 'dispute_resolved' });
    }

    await logAdminAction({
      action: `DISPUTE_${status.toUpperCase()}`,
      adminId: req.user._id,
      adminEmail: req.user.email,
      targetModel: 'Dispute',
      targetId: dispute._id,
      details: `Admin marked dispute ${dispute.disputeId} as ${status}. ${resolutionOutcome ? `Outcome: "${resolutionOutcome}"` : ''}`,
    });

    res.json({ success: true, message: `Dispute marked as ${status}`, dispute });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * MODULE 5: Verified System Settings & Health Check
 */
export const getSystemSettings = async (req, res) => {
  try {
    const dbState = mongoose.connection.readyState;
    const dbStateMap = {
      0: 'Disconnected',
      1: 'Connected & Verified',
      2: 'Connecting',
      3: 'Disconnecting',
    };

    const rawHost = mongoose.connection.host || 'MongoDB Cluster';
    const maskedHost = rawHost.includes('.') ? `${rawHost.slice(0, 14)}...` : rawHost;

    const uptimeSeconds = Math.floor(process.uptime());
    const uptimeFormatted = `${Math.floor(uptimeSeconds / 3600)}h ${Math.floor((uptimeSeconds % 3600) / 60)}m ${uptimeSeconds % 60}s`;

    const memUsage = process.memoryUsage();
    const heapUsedMB = Number((memUsage.heapUsed / 1024 / 1024).toFixed(1));

    const isSmtpConfigured = Boolean(
      (process.env.SMTP_USER || process.env.SMTP_EMAIL) &&
      (process.env.SMTP_PASS || process.env.SMTP_PASSWORD)
    );

    const isJwtConfigured = Boolean(process.env.JWT_SECRET);

    res.json({
      success: true,
      settings: {
        environment: process.env.NODE_ENV || 'development',
        nodeVersion: process.version,
        serverUptime: uptimeFormatted,
        memoryUsageMB: heapUsedMB,
        database: {
          status: dbStateMap[dbState] || 'Unknown',
          host: maskedHost,
          name: process.env.MONGODB_DB_NAME || 'grocery-stock-request-system',
          isLive: dbState === 1,
        },
        emailService: {
          configured: isSmtpConfigured,
          host: process.env.SMTP_HOST || 'smtp.gmail.com',
          port: Number(process.env.SMTP_PORT) || 465,
          fromAddress: process.env.SMTP_FROM || 'System Sender',
          status: isSmtpConfigured ? 'Operational' : 'Unconfigured',
        },
        security: {
          jwtConfigured: isJwtConfigured,
          otpExpiryMinutes: Number(process.env.OTP_EXPIRY_MINUTES) || 10,
          originPolicy: 'Strict Whitelist + Localhost',
        },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * MODULE 7: Audit Logs Retrieval
 */
export const getAuditLogs = async (req, res) => {
  try {
    const { action, search, page = 1, limit = 25 } = req.query;
    const query = {};

    if (action && action !== 'all') {
      query.action = action;
    }

    if (search && search.trim()) {
      query.$or = [
        { details: safeSubstringRegex(search) },
        { adminEmail: safeSubstringRegex(search) },
        { action: safeSubstringRegex(search) },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const logs = await AuditLog.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await AuditLog.countDocuments(query);

    res.json({
      success: true,
      logs,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * ADMIN UTILITY: Purge Auto-Seeded Demo Inventory
 * Safely removes only the exact COMMON_100_CATALOGUE items that still have
 * the seed default stockQuantity of 100. User-modified records are preserved.
 */
export const purgeDemoInventory = async (req, res) => {
  try {
    const seedProductNames = new Set(
      COMMON_100_CATALOGUE.map((item) => item.productName.toLowerCase().trim())
    );

    // Step 1: Count what's in the database before cleanup
    const totalBefore = await Inventory.countDocuments();

    // Step 2: Find seed candidates — catalogue name AND qty still at seed default (100)
    const seedCandidates = await Inventory.find({ stockQuantity: 100 }).select(
      '_id productName stockQuantity wholesaler'
    );
    const toDelete = seedCandidates.filter((item) =>
      seedProductNames.has((item.productName || '').toLowerCase().trim())
    );

    const preservedEditedCount = seedCandidates.length - toDelete.length;

    if (toDelete.length === 0) {
      return res.json({
        success: true,
        message:
          'No demo seed records found. The inventory is already clean (no catalogue items with qty=100 remain).',
        deletedCount: 0,
        totalBefore,
        totalAfter: totalBefore,
        preservedCount: 0,
      });
    }

    // Step 3: Delete identified seed records
    const idsToDelete = toDelete.map((r) => r._id);
    const result = await Inventory.deleteMany({ _id: { $in: idsToDelete } });

    const totalAfter = await Inventory.countDocuments();

    await logAdminAction({
      action: 'PURGE_DEMO_INVENTORY',
      adminId: req.user._id,
      adminEmail: req.user.email,
      targetModel: 'Inventory',
      targetId: 'bulk-purge',
      details: `Admin purged ${result.deletedCount} auto-seeded demo inventory records. ${preservedEditedCount} user-modified catalogue items were preserved. Remaining inventory: ${totalAfter}.`,
      metadata: {
        deletedCount: result.deletedCount,
        preservedEditedCount,
        totalBefore,
        totalAfter,
      },
    });

    res.json({
      success: true,
      message: `Successfully removed ${result.deletedCount} auto-seeded demo inventory records. ${preservedEditedCount} user-modified items were preserved.`,
      deletedCount: result.deletedCount,
      preservedCount: preservedEditedCount,
      totalBefore,
      totalAfter,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
