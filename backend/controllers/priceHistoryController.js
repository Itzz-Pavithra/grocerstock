import Order from '../models/Order.js';
import Response from '../models/Response.js';
import Wholesaler from '../models/Wholesaler.js';
import { safeExactRegex } from '../utils/regex.js';

/**
 * FEATURE 5: Explainable Price Intelligence
 * Real historical agreed prices, volatility, statistical anomaly detection, and explainable flags.
 */
export const getPriceHistory = async (req, res) => {
  const { productName, requestId } = req.query;

  if (!productName || productName.trim() === '') {
    return res.status(400).json({ success: false, message: 'productName query parameter is required' });
  }

  try {
    const cleanProductName = productName.trim();
    const regex = safeExactRegex(cleanProductName);

    // 1. Fetch completed or accepted orders for this product across the system
    const orders = await Order.find({
      status: { $ne: 'cancelled' },
      $or: [{ productName: regex }, { 'items.productName': regex }],
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
            status: ord.status,
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
          status: ord.status,
        });
      }
    });

    // Populate wholesaler company names
    const populatedPoints = await Promise.all(
      pricePoints.map(async (pt) => {
        const ws = await Wholesaler.findOne({ user: pt.wholesalerId });
        return {
          ...pt,
          wholesalerName: ws ? ws.companyName : 'Wholesale Supplier',
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
        message: 'No historical procurement transactions recorded for this product yet.',
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

    // Calculate Standard Deviation & Volatility
    const variance =
      prices.reduce((acc, p) => acc + Math.pow(p - historicalAverage, 2), 0) / Math.max(1, prices.length);
    const standardDeviation = Number(Math.sqrt(variance).toFixed(2));
    const coefficientOfVariation =
      historicalAverage > 0 ? Number(((standardDeviation / historicalAverage) * 100).toFixed(1)) : 0;

    let volatilityLevel = 'Stable';
    if (coefficientOfVariation > 25) {
      volatilityLevel = 'High Volatility';
    } else if (coefficientOfVariation > 12) {
      volatilityLevel = 'Moderate Volatility';
    }

    // Recent purchase trend
    let recentTrend = 'Near historical average';
    const recentDiff = Number((recentPurchasePrice - historicalAverage).toFixed(2));
    const recentPctDiff = Number((((recentPurchasePrice - historicalAverage) / historicalAverage) * 100).toFixed(1));

    if (recentPurchasePrice < historicalAverage * 0.96) {
      recentTrend = `Below historical average (-₹${Math.abs(recentDiff)} / ${recentPctDiff}%)`;
    } else if (recentPurchasePrice > historicalAverage * 1.04) {
      recentTrend = `Above historical average (+₹${recentDiff} / +${recentPctDiff}%)`;
    }

    // Evaluate each current quotation with Explainable Anomaly Detection
    const evaluatedQuotations = currentQuotations.map((q) => {
      const diffRupees = Number((q.price - historicalAverage).toFixed(2));
      const pctDiff = Number((((q.price - historicalAverage) / historicalAverage) * 100).toFixed(1));

      let anomalyFlag = 'Normal';
      let explanation = `Quotation is in line with historical baseline average of ₹${historicalAverage}.`;

      if (q.price < historicalAverage * 0.8) {
        anomalyFlag = 'Deep Discount';
        explanation = `Quotation is ${Math.abs(pctDiff)}% below historical average. Exceptional value; verify product grade and delivery terms.`;
      } else if (q.price < historicalAverage * 0.95) {
        anomalyFlag = 'Competitive Price';
        explanation = `Quotation is ${Math.abs(pctDiff)}% below historical average of ₹${historicalAverage}.`;
      } else if (q.price > historicalAverage * 1.25) {
        anomalyFlag = 'High Price Alert';
        explanation = `Quotation is ₹${diffRupees} (${pctDiff}%) above the historical average of ₹${historicalAverage}. Consider requesting a revision or comparing other bids.`;
      } else if (q.price > historicalAverage * 1.05) {
        anomalyFlag = 'Above Average';
        explanation = `Quotation is slightly above historical average (+${pctDiff}%). May reflect packaging or expedited delivery.`;
      }

      return {
        ...q,
        diffRupees,
        percentageVsAverage: pctDiff,
        anomalyFlag,
        explanation,
      };
    });

    // Chronological dated history points for charting
    const chartSeries = [...populatedPoints]
      .reverse()
      .map((pt) => ({
        date: new Date(pt.date).toISOString().split('T')[0],
        price: pt.price,
        wholesaler: pt.wholesalerName,
        quantity: pt.quantity,
      }));

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
        standardDeviation,
        volatilityLevel,
        coefficientOfVariation,
      },
      chartSeries,
      history: populatedPoints,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
