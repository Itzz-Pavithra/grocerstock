import Order from '../models/Order.js';
import Inventory from '../models/Inventory.js';
import Notification from '../models/Notification.js';
import Retailer from '../models/Retailer.js';
import Wholesaler from '../models/Wholesaler.js';

export const getMyOrders = async (req, res) => {
  try {
    let query = {};
    if (req.user.role === 'retailer') {
      query.retailer = req.user._id;
    } else if (req.user.role === 'wholesaler') {
      query.wholesaler = req.user._id;
    } else if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .populate('stockRequest');

    const formattedOrders = await Promise.all(
      orders.map(async (ord) => {
        const retailerProfile = await Retailer.findOne({ user: ord.retailer });
        const wholesalerProfile = await Wholesaler.findOne({ user: ord.wholesaler });
        return {
          ...ord.toObject(),
          retailerProfile,
          wholesalerProfile,
        };
      })
    );

    res.json({ success: true, orders: formattedOrders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateOrderStatus = async (req, res) => {
  const { id } = req.params;
  const { status, notes } = req.body;

  try {
    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Role check: Wholesaler or Admin can update status
    if (req.user.role === 'wholesaler' && order.wholesaler.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to update this order' });
    }

    if (!order.canTransitionTo(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid state transition from '${order.status}' to '${status}'.`,
      });
    }

    const oldStatus = order.status;
    order.status = status;
    order.statusHistory.push({ status, notes: notes || `Status updated from ${oldStatus} to ${status}` });
    await order.save();

    // Inventory Deduction when order reaches shipped / delivered
    if (status === 'shipped' || status === 'delivered') {
      const invItem = await Inventory.findOne({
        wholesaler: order.wholesaler,
        productName: { $regex: new RegExp(`^${order.productName}$`, 'i') },
      });

      if (invItem) {
        invItem.stockQuantity = Math.max(0, invItem.stockQuantity - order.quantity);
        if (invItem.stockQuantity <= 0) {
          invItem.isAvailable = false;
        }
        await invItem.save();
      }
    }

    // Notify Retailer
    const wholesalerProfile = await Wholesaler.findOne({ user: order.wholesaler });
    const companyName = wholesalerProfile ? wholesalerProfile.companyName : 'Wholesaler';

    await Notification.create({
      user: order.retailer,
      message: `Order #${order._id.toString().slice(-6)} for "${order.productName}" is now ${status.toUpperCase()} by ${companyName}.`,
      type: `order_${status}`,
    });

    res.json({ success: true, message: `Order status updated to ${status}`, order });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
