import Order from '../models/Order.js';
import RetailerInventory from '../models/RetailerInventory.js';
import RetailSale from '../models/RetailSale.js';
import Inventory from '../models/Inventory.js';
import StockRequest from '../models/StockRequest.js';
import Wholesaler from '../models/Wholesaler.js';
import Retailer from '../models/Retailer.js';

/**
 * FEATURE 1: Lead-Time-Aware Stockout Prediction for Retailers
 * Uses actual retailer store inventory, sales velocity, and lead times.
 */
export const getStockoutPredictions = async (req, res) => {
  try {
    const items = await RetailerInventory.find({ retailer: req.user._id });
    if (!items || items.length === 0) {
      return res.json({
        success: true,
        predictions: [],
        message: 'No store inventory items found. Add products to inventory to view predictions.',
      });
    }

    const salesHistory = await RetailSale.find({ retailer: req.user._id }).sort({ createdAt: 1 });

    const predictions = items.map((item) => {
      const currentStock = item.stockQuantity || 0;
      const threshold = item.minStockThreshold || 10;
      const leadTimeDays = 3; // Standard wholesale reorder lead time
      const safetyStock = Math.ceil(threshold * 0.5);

      // Calculate consumption from recorded sales
      let totalSoldQuantity = 0;
      salesHistory.forEach((sale) => {
        sale.items.forEach((line) => {
          if (line.productName.trim().toLowerCase() === item.productName.trim().toLowerCase()) {
            totalSoldQuantity += line.quantity;
          }
        });
      });

      // Data quality indicator
      let dataQuality = 'insufficient';
      let dailyConsumption = 0;
      let daysUntilStockout = null;
      let reorderPoint = threshold;
      let recommendedReorderQty = Math.max(0, threshold * 2 - currentStock);
      let isAtRisk = false;
      let riskReason = '';

      if (salesHistory.length > 0 && totalSoldQuantity > 0) {
        const earliestSale = new Date(salesHistory[0].createdAt).getTime();
        const daysTracked = Math.max(1, (Date.now() - earliestSale) / (1000 * 60 * 60 * 24));
        dailyConsumption = Number((totalSoldQuantity / daysTracked).toFixed(2));

        if (daysTracked >= 14) {
          dataQuality = 'high';
        } else if (daysTracked >= 3) {
          dataQuality = 'moderate';
        } else {
          dataQuality = 'early_data';
        }

        if (dailyConsumption > 0) {
          daysUntilStockout = Number((currentStock / dailyConsumption).toFixed(1));
          reorderPoint = Math.ceil(dailyConsumption * leadTimeDays + safetyStock);
          recommendedReorderQty = Math.max(0, Math.ceil(dailyConsumption * 14 + reorderPoint - currentStock));
        }
      }

      // Determine stock status and risk
      let status = 'Healthy';
      if (currentStock === 0) {
        status = 'Out of Stock';
        isAtRisk = true;
        riskReason = 'Inventory is completely exhausted. Immediate procurement required.';
      } else if (daysUntilStockout !== null && daysUntilStockout <= leadTimeDays) {
        status = 'Critical';
        isAtRisk = true;
        riskReason = `Stock will run out in ~${daysUntilStockout} days, which is less than supplier lead time (${leadTimeDays} days).`;
      } else if (currentStock <= threshold || (daysUntilStockout !== null && daysUntilStockout <= 7)) {
        status = 'Low Stock';
        isAtRisk = true;
        riskReason = `Stock is at or below reorder threshold (${threshold} ${item.unit}).`;
      }

      const recommendedReorderDate =
        daysUntilStockout !== null && daysUntilStockout > leadTimeDays
          ? new Date(Date.now() + (daysUntilStockout - leadTimeDays) * 24 * 60 * 60 * 1000)
          : new Date();

      return {
        _id: item._id,
        productName: item.productName,
        category: item.category,
        brand: item.brand,
        unit: item.unit,
        currentStock,
        minStockThreshold: threshold,
        safetyStock,
        leadTimeDays,
        dailyConsumption,
        daysUntilStockout,
        reorderPoint,
        recommendedReorderQty,
        recommendedReorderDate,
        dataQuality,
        hasSufficientData: totalSoldQuantity > 0,
        status,
        isAtRisk,
        riskReason,
      };
    });

    res.json({ success: true, predictions });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * PART 5.A: Retailer Profitability & Financial Performance Dashboard
 */
export const getRetailerProfitability = async (req, res) => {
  try {
    const retailerId = req.user._id;

    // 1. Procurement Orders Analysis
    const orders = await Order.find({ retailer: retailerId, status: { $ne: 'cancelled' } });
    const deliveredOrders = orders.filter((o) => o.status === 'delivered');

    const totalProcurementSpend = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    const costOfGoodsReceived = deliveredOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);

    // 2. Current Inventory Valuation from RetailerInventory
    const inventoryItems = await RetailerInventory.find({ retailer: retailerId });
    const currentInventoryValuation = inventoryItems.reduce(
      (sum, item) => sum + (item.stockQuantity || 0) * (item.averageCostPrice || 0),
      0
    );

    // 3. Retail Sales Records Analysis
    const sales = await RetailSale.find({ retailer: retailerId }).sort({ createdAt: -1 });

    const totalSalesRevenue = sales.reduce((sum, s) => sum + (s.totalRevenue || 0), 0);
    const costOfGoodsSold = sales.reduce((sum, s) => sum + (s.totalCost || 0), 0);
    const grossProfit = Number((totalSalesRevenue - costOfGoodsSold).toFixed(2));
    const grossProfitMargin =
      totalSalesRevenue > 0 ? Number(((grossProfit / totalSalesRevenue) * 100).toFixed(1)) : 0;

    const hasSalesData = sales.length > 0;

    // Category-wise sales breakdown
    const categoryMap = new Map();
    sales.forEach((s) => {
      s.items.forEach((item) => {
        const cat = item.category || 'General';
        if (!categoryMap.has(cat)) {
          categoryMap.set(cat, { revenue: 0, cost: 0, profit: 0, unitsSold: 0 });
        }
        const data = categoryMap.get(cat);
        data.revenue += item.totalRevenue;
        data.cost += item.totalCost;
        data.profit += item.grossProfit;
        data.unitsSold += item.quantity;
      });
    });

    const categoryBreakdown = Array.from(categoryMap.entries()).map(([cat, val]) => ({
      category: cat,
      revenue: Number(val.revenue.toFixed(2)),
      cost: Number(val.cost.toFixed(2)),
      profit: Number(val.profit.toFixed(2)),
      margin: val.revenue > 0 ? Number(((val.profit / val.revenue) * 100).toFixed(1)) : 0,
      unitsSold: val.unitsSold,
    }));

    res.json({
      success: true,
      hasSalesData,
      metrics: {
        totalProcurementSpend: Number(totalProcurementSpend.toFixed(2)),
        costOfGoodsReceived: Number(costOfGoodsReceived.toFixed(2)),
        currentInventoryValuation: Number(currentInventoryValuation.toFixed(2)),
        salesRevenue: Number(totalSalesRevenue.toFixed(2)),
        costOfGoodsSold: Number(costOfGoodsSold.toFixed(2)),
        grossProfit: hasSalesData ? grossProfit : null,
        grossProfitMargin: hasSalesData ? grossProfitMargin : null,
        totalOrdersCount: orders.length,
        deliveredOrdersCount: deliveredOrders.length,
        totalSalesCount: sales.length,
        stockItemsCount: inventoryItems.length,
      },
      categoryBreakdown,
      disclosure: hasSalesData
        ? 'Gross profit and gross margin are computed from recorded retail store sales minus cost of goods sold.'
        : 'Note: True gross profit requires recording retail store sales. To calculate gross profit, record store sales in the My Inventory > Record Sale tab.',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * PART 5.B: Wholesaler Profitability & Operational Performance Dashboard
 */
export const getWholesalerProfitability = async (req, res) => {
  try {
    const wholesalerId = req.user._id;

    // Fetch all orders for this wholesaler
    const orders = await Order.find({ wholesaler: wholesalerId }).sort({ createdAt: -1 });

    const totalOrders = orders.length;
    const deliveredOrders = orders.filter((o) => o.status === 'delivered');
    const cancelledOrders = orders.filter((o) => o.status === 'cancelled');

    const totalFulfilledRevenue = deliveredOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);

    // Wholesaler inventory valuation
    const stockItems = await Inventory.find({ wholesaler: wholesalerId });
    const inventoryValuation = stockItems.reduce(
      (sum, item) => sum + (item.stockQuantity || 0) * (item.unitPrice || 0),
      0
    );

    // Cost base: default 75% product cost baseline for recognized wholesale revenue
    const estimatedWholesaleCost = Number((totalFulfilledRevenue * 0.75).toFixed(2));
    const estimatedGrossProfit = Number((totalFulfilledRevenue - estimatedWholesaleCost).toFixed(2));
    const grossMarginPercent = totalFulfilledRevenue > 0 ? 25.0 : 0;

    const fulfillmentRate = totalOrders > 0 ? Math.round((deliveredOrders.length / totalOrders) * 100) : 0;
    const cancellationRate = totalOrders > 0 ? Math.round((cancelledOrders.length / totalOrders) * 100) : 0;
    const averageOrderValue =
      deliveredOrders.length > 0 ? Number((totalFulfilledRevenue / deliveredOrders.length).toFixed(2)) : 0;

    // On-time delivery rate
    let onTimeCount = 0;
    let evaluatedDeliveryCount = 0;
    deliveredOrders.forEach((o) => {
      const deliveredTime = o.actualDeliveryDate || o.deliveredAt;
      if (deliveredTime && o.expectedDeliveryDate) {
        evaluatedDeliveryCount += 1;
        if (new Date(deliveredTime).getTime() <= new Date(o.expectedDeliveryDate).getTime() + 60 * 60 * 1000) {
          onTimeCount += 1;
        }
      }
    });

    const onTimeDeliveryRate =
      evaluatedDeliveryCount > 0 ? Math.round((onTimeCount / evaluatedDeliveryCount) * 100) : null;

    // Product revenue breakdown
    const productRevenueMap = new Map();
    deliveredOrders.forEach((o) => {
      const pName = o.productName.trim();
      if (!productRevenueMap.has(pName)) {
        productRevenueMap.set(pName, { productName: pName, quantity: 0, revenue: 0, unit: o.unit });
      }
      const entry = productRevenueMap.get(pName);
      entry.quantity += o.quantity;
      entry.revenue += o.totalAmount;
    });

    const productBreakdown = Array.from(productRevenueMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    res.json({
      success: true,
      metrics: {
        totalFulfilledRevenue: Number(totalFulfilledRevenue.toFixed(2)),
        inventoryValuation: Number(inventoryValuation.toFixed(2)),
        estimatedCostOfGoodsFulfilled: estimatedWholesaleCost,
        estimatedGrossProfit,
        grossMarginPercent,
        totalOrders,
        completedOrders: deliveredOrders.length,
        cancelledOrders: cancelledOrders.length,
        fulfillmentRate,
        cancellationRate,
        onTimeDeliveryRate,
        averageOrderValue,
      },
      productBreakdown,
      disclosure:
        'Financial figures reflect realized wholesale revenue from delivered orders. Gross profit is calculated prior to operational overhead and logistics expenses.',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
