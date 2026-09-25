import Order from '../models/Order.js';
import Response from '../models/Response.js';
import Wholesaler from '../models/Wholesaler.js';

/**
 * FEATURE 2: Real Historical Purchase Price Comparison & Price History
 * Computes historical averages, extremes, recent price, and comparison trends from real MongoDB records.
 */
export const getPriceHistory = async (req, res) => {
  const { productName, requestId } = req.query;

  if (!productName || productName.trim() === '') {
    return res.status(400).json({ success: false, message: 'productName query parameter is required' });
  }

  try {
    const cleanProductName = productName.trim();
    const regex = new RegExp(`^${cleanProductName}$`, 'i');

    // 1. Fetch completed or accepted orders for this product across the system
    const orders = await Order.find({
      status: { $ne: 'cancelled' },
      $or: [
        { productName: regex },
        { 'items.productName': regex },
      ],
    }).sort({ createdAt: -1 });

    const pricePoints = [];
    orders.forEach((ord) => {
      if (ord.items && ord.items.length > 0) {
        const matchedItem = ord.items.find(
          (it) => it.productName.trim().toLowerCase() === cleanProductName.toLowerCase()
        );
        if (matchedItem && matchedItem.unitPrice > 0) {
          pricePoints.push({
            orderId: ord._id,
            price: matchedItem.unitPrice,
            quantity: matchedItem.quantity,
            unit: matchedItem.unit,
            wholesalerId: ord.wholesaler,
            date: ord.createdAt,
          });
        }
      } else if (ord.unitPrice > 0) {
        pricePoints.push({
          orderId: ord._id,
          price: ord.unitPrice,
          quantity: ord.quantity,
          unit: ord.unit,
          wholesalerId: ord.wholesaler,
          date: ord.createdAt,
        });
      }
    });

    // Populate wholesaler company names
    const populatedPoints = await Promise.all(
      pricePoints.map(async (pt) => {
        const ws = await Wholesaler.findOne({ user: pt.wholesalerId });
        return {
          ...pt,
          wholesalerName: ws ? ws.companyName : 'Wholesaler',
        };
      })
    );

    // 2. If a requestId is provided, also fetch current pending/submitted quotations for comparison
    let currentQuotations = [];
    if (requestId) {
      const activeQuotes = await Response.find({ stockRequest: requestId }).sort({ price: 1 });
      currentQuotations = await Promise.all(
        activeQuotes.map(async (q) => {
          const ws = await Wholesaler.findOne({ user: q.wholesaler });
          return {
            _id: q._id,
            wholesalerId: q.wholesaler,
            wholesalerName: ws ? ws.companyName : 'Wholesaler',
            price: q.price,
            quantity: q.quantity,
            availability: q.availability,
            deliveryTime: q.deliveryTime,
            status: q.status,
            items: q.items || [],
          };
        })
      );
    }

    if (pricePoints.length === 0) {
      return res.json({
        success: true,
        hasHistory: false,
        productName: cleanProductName,
        currentQuotations,
        message: 'No historical price data available for this product yet.',
        stats: null,
        history: [],
      });
    }

    const prices = pricePoints.map((p) => p.price);
    const sum = prices.reduce((acc, p) => acc + p, 0);
    const historicalAverage = Number((sum / prices.length).toFixed(2));
    const historicalLowest = Math.min(...prices);
    const historicalHighest = Math.max(...prices);
    const recentPurchasePrice = prices[0]; // First in sorted by createdAt: -1

    // Evaluate recent purchase vs historical average
    let recentTrend = 'Near historical average';
    if (recentPurchasePrice < historicalAverage * 0.97) {
      recentTrend = 'Below historical average';
    } else if (recentPurchasePrice > historicalAverage * 1.03) {
      recentTrend = 'Above historical average';
    }

    // Attach trend evaluation to current quotations if present
    const evaluatedQuotations = currentQuotations.map((q) => {
      let quoteTrend = 'Near historical average';
      if (q.price < historicalAverage * 0.97) {
        quoteTrend = 'Below historical average';
      } else if (q.price > historicalAverage * 1.03) {
        quoteTrend = 'Above historical average';
      }
      const pctDiff = Number((((q.price - historicalAverage) / historicalAverage) * 100).toFixed(1));
      return {
        ...q,
        trend: quoteTrend,
        percentageVsAverage: pctDiff,
      };
    });

    res.json({
      success: true,
      hasHistory: true,
      productName: cleanProductName,
      currentQuotations: evaluatedQuotations,
      stats: {
        totalPurchases: pricePoints.length,
        historicalAverage,
        historicalLowest,
        historicalHighest,
        recentPurchasePrice,
        recentTrend,
      },
      history: populatedPoints,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
