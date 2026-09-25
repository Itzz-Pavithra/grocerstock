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
  const { status, notes, expectedDeliveryDate, deliveryNotes } = req.body;

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

    const now = new Date();
    if (status === 'packed' && !order.packedAt) order.packedAt = now;
    if (status === 'shipped' && !order.shippedAt) order.shippedAt = now;
    if (status === 'out_for_delivery' && !order.outForDeliveryAt) order.outForDeliveryAt = now;
    if (status === 'delivered') {
      if (!order.deliveredAt) order.deliveredAt = now;
      if (!order.actualDeliveryDate) order.actualDeliveryDate = now;
    }

    if (expectedDeliveryDate) {
      order.expectedDeliveryDate = new Date(expectedDeliveryDate);
    }
    if (deliveryNotes) {
      order.deliveryNotes = deliveryNotes;
    }

    order.statusHistory.push({
      status,
      updatedAt: now,
      notes: notes || deliveryNotes || `Status updated from ${oldStatus} to ${status}`,
    });

    // Deduct inventory ONCE when order reaches shipped, out_for_delivery, or delivered
    if (!order.inventoryDeducted && ['shipped', 'out_for_delivery', 'delivered'].includes(status)) {
      if (order.items && order.items.length > 0) {
        for (const item of order.items) {
          const invItem = await Inventory.findOne({
            wholesaler: order.wholesaler,
            productName: { $regex: new RegExp(`^${item.productName.trim()}$`, 'i') },
          });
          if (invItem) {
            invItem.stockQuantity = Math.max(0, invItem.stockQuantity - item.quantity);
            if (invItem.stockQuantity <= 0) {
              invItem.isAvailable = false;
            }
            await invItem.save();
          }
        }
      } else {
        const invItem = await Inventory.findOne({
          wholesaler: order.wholesaler,
          productName: { $regex: new RegExp(`^${order.productName.trim()}$`, 'i') },
        });

        if (invItem) {
          invItem.stockQuantity = Math.max(0, invItem.stockQuantity - order.quantity);
          if (invItem.stockQuantity <= 0) {
            invItem.isAvailable = false;
          }
          await invItem.save();
        }
      }
      order.inventoryDeducted = true;
    }

    await order.save();

    // Notify Retailer
    const wholesalerProfile = await Wholesaler.findOne({ user: order.wholesaler });
    const companyName = wholesalerProfile ? wholesalerProfile.companyName : 'Wholesaler';

    const humanStatus = status.replace(/_/g, ' ').toUpperCase();
    await Notification.create({
      user: order.retailer,
      message: `Order #${order._id.toString().slice(-6)} for "${order.productName}" is now ${humanStatus} by ${companyName}.`,
      type: `order_${status}`,
    });

    res.json({ success: true, message: `Order status updated to ${status}`, order });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getOrderTracking = async (req, res) => {
  const { id } = req.params;

  try {
    const order = await Order.findById(id).populate('stockRequest');
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Role check: Only order retailer, wholesaler, or admin can track
    const isRetailer = order.retailer.toString() === req.user._id.toString();
    const isWholesaler = order.wholesaler.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isRetailer && !isWholesaler && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Access denied to this order tracking' });
    }

    const retailerProfile = await Retailer.findOne({ user: order.retailer });
    const wholesalerProfile = await Wholesaler.findOne({ user: order.wholesaler });

    const timelineSteps = [
      { key: 'accepted', label: 'Order Accepted', timestamp: order.createdAt },
      { key: 'processing', label: 'Processing', timestamp: order.statusHistory.find(h => h.status === 'processing')?.updatedAt || null },
      { key: 'packed', label: 'Packed', timestamp: order.packedAt || order.statusHistory.find(h => h.status === 'packed')?.updatedAt || null },
      { key: 'shipped', label: 'Shipped', timestamp: order.shippedAt || order.statusHistory.find(h => h.status === 'shipped')?.updatedAt || null },
      { key: 'out_for_delivery', label: 'Out for Delivery', timestamp: order.outForDeliveryAt || order.statusHistory.find(h => h.status === 'out_for_delivery')?.updatedAt || null },
      { key: 'delivered', label: 'Delivered', timestamp: order.deliveredAt || order.actualDeliveryDate || order.statusHistory.find(h => h.status === 'delivered')?.updatedAt || null },
    ];

    res.json({
      success: true,
      tracking: {
        orderId: order._id,
        status: order.status,
        productName: order.productName,
        quantity: order.quantity,
        unit: order.unit,
        unitPrice: order.unitPrice,
        totalAmount: order.totalAmount,
        expectedDeliveryDate: order.expectedDeliveryDate,
        actualDeliveryDate: order.actualDeliveryDate,
        deliveryNotes: order.deliveryNotes,
        retailerStore: retailerProfile ? retailerProfile.storeName : 'Retailer',
        retailerAddress: retailerProfile ? retailerProfile.address : '',
        wholesalerCompany: wholesalerProfile ? wholesalerProfile.companyName : 'Wholesaler',
        wholesalerPhone: wholesalerProfile ? wholesalerProfile.phone : '',
        timelineSteps,
        statusHistory: order.statusHistory,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

