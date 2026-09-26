import Inventory from '../models/Inventory.js';
import Order from '../models/Order.js';
import { ensureWholesalerInventory } from '../services/commonInventoryService.js';

export const getMyInventory = async (req, res) => {
  try {
    await ensureWholesalerInventory(req.user._id);
    const items = await Inventory.find({ wholesaler: req.user._id }).sort({ productName: 1 });
    res.json({ success: true, inventory: items, count: items.length });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const addInventoryItem = async (req, res) => {
  const { productName, category, brand, unit, stockQuantity, unitPrice, minStockThreshold, leadTimeDays, reorderQuantity } = req.body;

  if (!productName || !category || !unit || stockQuantity === undefined || unitPrice === undefined) {
    return res.status(400).json({ success: false, message: 'Required fields missing' });
  }

  try {
    const existing = await Inventory.findOne({ wholesaler: req.user._id, productName: { $regex: new RegExp(`^${productName.trim()}$`, 'i') } });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Item already exists in your inventory. Update it instead.' });
    }

    const item = await Inventory.create({
      wholesaler: req.user._id,
      productName: productName.trim(),
      category: category.trim(),
      brand: brand ? brand.trim() : '',
      unit: unit.trim(),
      stockQuantity: Math.max(0, Number(stockQuantity)),
      unitPrice: Math.max(0, Number(unitPrice)),
      minStockThreshold: minStockThreshold !== undefined ? Number(minStockThreshold) : 10,
      leadTimeDays: leadTimeDays !== undefined ? Number(leadTimeDays) : 3,
      reorderQuantity: reorderQuantity !== undefined ? Number(reorderQuantity) : 50,
      isAvailable: Number(stockQuantity) > 0,
    });

    res.status(201).json({ success: true, message: 'Inventory item added', item });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateInventoryItem = async (req, res) => {
  const { id } = req.params;
  const { stockQuantity, unitPrice, isAvailable, minStockThreshold, leadTimeDays, reorderQuantity } = req.body;

  try {
    const item = await Inventory.findOne({ _id: id, wholesaler: req.user._id });
    if (!item) {
      return res.status(404).json({ success: false, message: 'Inventory item not found' });
    }

    if (stockQuantity !== undefined) item.stockQuantity = Math.max(0, Number(stockQuantity));
    if (unitPrice !== undefined) item.unitPrice = Math.max(0, Number(unitPrice));
    if (minStockThreshold !== undefined) item.minStockThreshold = Math.max(0, Number(minStockThreshold));
    if (leadTimeDays !== undefined) item.leadTimeDays = Math.max(1, Number(leadTimeDays));
    if (reorderQuantity !== undefined) item.reorderQuantity = Math.max(1, Number(reorderQuantity));
    if (isAvailable !== undefined) item.isAvailable = Boolean(isAvailable);
    else if (stockQuantity !== undefined) item.isAvailable = Number(stockQuantity) > 0;

    await item.save();

    res.json({ success: true, message: 'Inventory updated successfully', item });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteInventoryItem = async (req, res) => {
  const { id } = req.params;
  try {
    const item = await Inventory.findOneAndDelete({ _id: id, wholesaler: req.user._id });
    if (!item) {
      return res.status(404).json({ success: false, message: 'Inventory item not found' });
    }
    res.json({ success: true, message: 'Inventory item removed' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * FEATURE 1: Wholesaler Inventory Depletion & Stockout Predictions
 * Real calculation from MongoDB order fulfillment history
 */
export const getInventoryPredictions = async (req, res) => {
  try {
    const items = await Inventory.find({ wholesaler: req.user._id });
    if (!items || items.length === 0) {
      return res.json({ success: true, predictions: [], message: 'No inventory items recorded yet' });
    }

    const predictions = await Promise.all(
      items.map(async (item) => {
        // Query real completed / fulfilled orders for this product by this wholesaler
        const fulfilledOrders = await Order.find({
          wholesaler: req.user._id,
          status: { $in: ['shipped', 'out_for_delivery', 'delivered'] },
          $or: [
            { productName: { $regex: new RegExp(`^${item.productName.trim()}$`, 'i') } },
            { 'items.productName': { $regex: new RegExp(`^${item.productName.trim()}$`, 'i') } },
          ],
        }).sort({ createdAt: 1 });

        let totalConsumedQuantity = 0;
        fulfilledOrders.forEach((ord) => {
          if (ord.items && ord.items.length > 0) {
            const matched = ord.items.find(
              (it) => it.productName.trim().toLowerCase() === item.productName.trim().toLowerCase()
            );
            if (matched) totalConsumedQuantity += matched.quantity;
          } else if (ord.productName.trim().toLowerCase() === item.productName.trim().toLowerCase()) {
            totalConsumedQuantity += ord.quantity;
          }
        });

        // Determine stock status and usage metrics
        const threshold = item.minStockThreshold || 10;
        const currentStock = item.stockQuantity || 0;

        if (fulfilledOrders.length === 0 || totalConsumedQuantity === 0) {
          let status = 'Healthy';
          if (currentStock === 0) status = 'Out of Stock';
          else if (currentStock <= threshold * 0.5) status = 'Critical';
          else if (currentStock <= threshold) status = 'Low';

          return {
            _id: item._id,
            productName: item.productName,
            category: item.category,
            brand: item.brand,
            unit: item.unit,
            currentStock,
            minStockThreshold: threshold,
            hasSufficientData: false,
            averageDailyUsage: null,
            predictedStockoutDays: null,
            predictedStockoutDate: null,
            recommendedReorderQuantity: Math.max(0, threshold * 2 - currentStock),
            status,
            message: 'Insufficient history for prediction',
          };
        }

        // Calculate time span across order records (at least 1 day to prevent division by zero)
        const earliestOrderDate = new Date(fulfilledOrders[0].createdAt).getTime();
        const now = Date.now();
        const daysElapsed = Math.max(1, (now - earliestOrderDate) / (1000 * 60 * 60 * 24));
        const averageDailyUsage = Number((totalConsumedQuantity / daysElapsed).toFixed(2));

        // Prevent division-by-zero
        let predictedStockoutDays = null;
        let predictedStockoutDate = null;

        if (averageDailyUsage > 0) {
          predictedStockoutDays = Number((currentStock / averageDailyUsage).toFixed(1));
          predictedStockoutDate = new Date(Date.now() + predictedStockoutDays * 24 * 60 * 60 * 1000);
        }

        // Recommended reorder quantity: target 14-day supply + threshold - current stock
        const targetSupplyDays = 14;
        const recommendedReorder = Math.max(
          0,
          Math.ceil(averageDailyUsage * targetSupplyDays + threshold - currentStock)
        );

        let status = 'Healthy';
        if (currentStock === 0) {
          status = 'Out of Stock';
        } else if (predictedStockoutDays !== null && predictedStockoutDays <= 3) {
          status = 'Critical';
        } else if (predictedStockoutDays !== null && predictedStockoutDays <= 7) {
          status = 'Low';
        } else if (currentStock <= threshold) {
          status = 'Low';
        }

        return {
          _id: item._id,
          productName: item.productName,
          category: item.category,
          brand: item.brand,
          unit: item.unit,
          currentStock,
          minStockThreshold: threshold,
          hasSufficientData: true,
          totalConsumedQuantity,
          averageDailyUsage,
          predictedStockoutDays,
          predictedStockoutDate,
          recommendedReorderQuantity: recommendedReorder,
          status,
          message: null,
        };
      })
    );

    res.json({ success: true, predictions });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * FEATURE 1: Retailer Reorder Recommendations
 * Recommends items retailer regularly procures based on real order history
 */
export const getRetailerReorderRecommendations = async (req, res) => {
  try {
    const orders = await Order.find({
      retailer: req.user._id,
      status: { $in: ['delivered', 'shipped'] },
    }).sort({ createdAt: -1 });

    if (!orders || orders.length === 0) {
      return res.json({
        success: true,
        hasSufficientData: false,
        recommendations: [],
        message: 'Insufficient history for prediction',
      });
    }

    // Group orders by product name
    const productMap = new Map();
    orders.forEach((ord) => {
      const pName = ord.productName.trim();
      if (!productMap.has(pName)) {
        productMap.set(pName, {
          productName: pName,
          unit: ord.unit,
          ordersCount: 0,
          totalQuantity: 0,
          lastOrderedAt: ord.createdAt,
          quantities: [],
          orderDates: [],
        });
      }
      const entry = productMap.get(pName);
      entry.ordersCount += 1;
      entry.totalQuantity += ord.quantity;
      entry.quantities.push(ord.quantity);
      entry.orderDates.push(new Date(ord.createdAt).getTime());
    });

    const recommendations = [];
    const now = Date.now();

    for (const [pName, data] of productMap.entries()) {
      if (data.ordersCount < 1) continue;

      const lastDate = new Date(data.lastOrderedAt).getTime();
      const daysSinceLastOrder = Math.max(0, Math.floor((now - lastDate) / (1000 * 60 * 60 * 24)));

      let averageIntervalDays = null;
      if (data.orderDates.length > 1) {
        data.orderDates.sort((a, b) => a - b);
        let totalIntervals = 0;
        for (let i = 1; i < data.orderDates.length; i++) {
          totalIntervals += (data.orderDates[i] - data.orderDates[i - 1]) / (1000 * 60 * 60 * 24);
        }
        averageIntervalDays = Math.max(1, Math.round(totalIntervals / (data.orderDates.length - 1)));
      }

      const avgOrderQty = Math.round(data.totalQuantity / data.ordersCount);
      let urgency = 'medium';
      let needsReorder = false;

      if (averageIntervalDays && daysSinceLastOrder >= averageIntervalDays) {
        urgency = 'high';
        needsReorder = true;
      } else if (daysSinceLastOrder >= 14) {
        urgency = 'medium';
        needsReorder = true;
      }

      recommendations.push({
        productName: pName,
        unit: data.unit,
        ordersCount: data.ordersCount,
        totalQuantityOrdered: data.totalQuantity,
        lastOrderedAt: data.lastOrderedAt,
        daysSinceLastOrder,
        averageIntervalDays,
        recommendedReorderQuantity: avgOrderQty,
        urgency,
        needsReorder,
      });
    }

    res.json({
      success: true,
      hasSufficientData: recommendations.length > 0,
      recommendations,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

