import Wholesaler from '../models/Wholesaler.js';
import User from '../models/User.js';
import Order from '../models/Order.js';
import Response from '../models/Response.js';
import StockRequest from '../models/StockRequest.js';
import Inventory from '../models/Inventory.js';

// Haversine formula to compute great-circle distance in kilometers between two lat/lng points
function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  if (lat1 === null || lat1 === undefined || lon1 === null || lon1 === undefined ||
      lat2 === null || lat2 === undefined || lon2 === null || lon2 === undefined) {
    return null;
  }

  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(1));
}

/**
 * Calculates real performance analytics for a wholesaler from database records
 */
async function computeWholesalerScorecard(userId) {
  let wholesalerProfile = await Wholesaler.findOne({ user: userId });
  if (!wholesalerProfile) {
    const user = await User.findById(userId);
    if (!user || user.role !== 'wholesaler') {
      return null;
    }
    // Return empty scorecard structure for newly registered wholesaler
    return {
      wholesalerId: userId,
      companyName: user.name || 'Wholesale Supplier',
      phone: '',
      address: '',
      city: '',
      state: '',
      categoriesSupplied: [],
      deliveryRadiusKm: 25,
      hasData: false,
      metrics: {
        totalOrders: 0,
        completedOrders: 0,
        cancelledOrders: 0,
        totalOrderValue: 0,
        fulfillmentRate: 'N/A',
        fulfillmentRateNumber: null,
        onTimeDeliveryRate: 'N/A',
        onTimeDeliveryRateNumber: null,
        onTimeDeliveries: 0,
        lateDeliveries: 0,
        averageDeliveryDays: 'N/A',
        averageDeliveryDaysNumber: null,
        avgQuotationTurnaroundHours: 'N/A',
        quotationResponseTimeHours: null,
        totalQuotationsSubmitted: 0,
      },
      message: 'Insufficient historical order records to evaluate supplier performance',
    };
  }

  // Fetch all orders for this wholesaler
  const orders = await Order.find({ wholesaler: userId }).sort({ createdAt: -1 });

  const totalOrders = orders.length;
  const completedOrders = orders.filter((o) => o.status === 'delivered').length;
  const cancelledOrders = orders.filter((o) => o.status === 'cancelled').length;

  const totalOrderValue = orders
    .filter((o) => o.status !== 'cancelled')
    .reduce((sum, o) => sum + (o.totalAmount || 0), 0);

  const fulfillmentRate = totalOrders > 0 ? Math.round((completedOrders / totalOrders) * 100) : null;

  // On-time vs Late deliveries
  let onTimeDeliveries = 0;
  let lateDeliveries = 0;
  let evaluatedDeliveries = 0;
  let totalDeliveryDurationHours = 0;
  let completedWithTimestampsCount = 0;

  orders
    .filter((o) => o.status === 'delivered')
    .forEach((ord) => {
      const deliveredTime = ord.actualDeliveryDate || ord.deliveredAt;
      if (deliveredTime) {
        // Duration calculation
        const durationHours = (new Date(deliveredTime).getTime() - new Date(ord.createdAt).getTime()) / (1000 * 60 * 60);
        if (durationHours >= 0) {
          totalDeliveryDurationHours += durationHours;
          completedWithTimestampsCount += 1;
        }

        // On-time comparison
        if (ord.expectedDeliveryDate) {
          evaluatedDeliveries += 1;
          if (new Date(deliveredTime).getTime() <= new Date(ord.expectedDeliveryDate).getTime() + 60 * 60 * 1000) {
            onTimeDeliveries += 1;
          } else {
            lateDeliveries += 1;
          }
        }
      }
    });

  const onTimeDeliveryRate = evaluatedDeliveries > 0 ? Math.round((onTimeDeliveries / evaluatedDeliveries) * 100) : null;

  const averageDeliveryDays =
    completedWithTimestampsCount > 0
      ? Number((totalDeliveryDurationHours / (completedWithTimestampsCount * 24)).toFixed(1))
      : null;

  // Quotation response turnaround time
  const wholesalerResponses = await Response.find({ wholesaler: userId });
  let totalTurnaroundHours = 0;
  let responseCount = 0;

  for (const resp of wholesalerResponses) {
    const req = await StockRequest.findById(resp.stockRequest);
    if (req) {
      const diffHours = (new Date(resp.createdAt).getTime() - new Date(req.createdAt).getTime()) / (1000 * 60 * 60);
      if (diffHours >= 0) {
        totalTurnaroundHours += diffHours;
        responseCount += 1;
      }
    }
  }

  const avgQuotationTurnaroundHours =
    responseCount > 0 ? Number((totalTurnaroundHours / responseCount).toFixed(1)) : null;

  const hasData = totalOrders > 0 || responseCount > 0;

  return {
    wholesalerId: userId,
    companyName: wholesalerProfile.companyName || 'Wholesaler',
    phone: wholesalerProfile.phone || '',
    address: wholesalerProfile.address || '',
    city: wholesalerProfile.city || '',
    state: wholesalerProfile.state || '',
    categoriesSupplied: wholesalerProfile.categoriesSupplied || [],
    deliveryRadiusKm: wholesalerProfile.deliveryRadiusKm || 25,
    hasData,
    metrics: {
      totalOrders,
      completedOrders,
      cancelledOrders,
      totalOrderValue,
      fulfillmentRate: fulfillmentRate !== null ? `${fulfillmentRate}%` : 'N/A',
      fulfillmentRateNumber: fulfillmentRate,
      onTimeDeliveryRate: onTimeDeliveryRate !== null ? `${onTimeDeliveryRate}%` : 'N/A',
      onTimeDeliveryRateNumber: onTimeDeliveryRate,
      onTimeDeliveries,
      lateDeliveries,
      averageDeliveryDays: averageDeliveryDays !== null ? `${averageDeliveryDays} days` : 'N/A',
      averageDeliveryDaysNumber: averageDeliveryDays,
      avgQuotationTurnaroundHours: avgQuotationTurnaroundHours !== null ? `${avgQuotationTurnaroundHours} hrs` : 'N/A',
      quotationResponseTimeHours: avgQuotationTurnaroundHours,
      totalQuotationsSubmitted: wholesalerResponses.length,
    },
    message: hasData ? null : 'Insufficient historical order records to evaluate supplier performance',
  };
}

export const getWholesalerPerformance = async (req, res) => {
  const { id } = req.params;
  try {
    const scorecard = await computeWholesalerScorecard(id);
    if (!scorecard) {
      return res.status(404).json({ success: false, message: 'Wholesaler not found' });
    }
    res.json({ success: true, scorecard, performance: scorecard });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getMyPerformance = async (req, res) => {
  try {
    const scorecard = await computeWholesalerScorecard(req.user._id);
    if (!scorecard) {
      return res.json({
        success: true,
        scorecard: {
          wholesalerId: req.user._id,
          companyName: req.user.name || 'Wholesale Supplier',
          phone: '',
          address: '',
          city: '',
          state: '',
          categoriesSupplied: [],
          deliveryRadiusKm: 25,
          hasData: false,
          metrics: {
            totalOrders: 0,
            completedOrders: 0,
            cancelledOrders: 0,
            totalOrderValue: 0,
            fulfillmentRate: 'N/A',
            fulfillmentRateNumber: null,
            onTimeDeliveryRate: 'N/A',
            onTimeDeliveryRateNumber: null,
            onTimeDeliveries: 0,
            lateDeliveries: 0,
            averageDeliveryDays: 'N/A',
            averageDeliveryDaysNumber: null,
            avgQuotationTurnaroundHours: 'N/A',
            quotationResponseTimeHours: null,
            totalQuotationsSubmitted: 0,
          },
          message: 'Insufficient historical order records to evaluate supplier performance',
        },
        performance: null,
      });
    }
    res.json({ success: true, scorecard, performance: scorecard });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * FEATURE 10 & 11: Map-Based Supplier Discovery
 * Returns wholesalers with real coordinates, distances, and performance highlights
 */
export const getNearbyWholesalers = async (req, res) => {
  const { latitude, longitude, radius, category, search } = req.query;

  try {
    const userLat = latitude ? parseFloat(latitude) : null;
    const userLng = longitude ? parseFloat(longitude) : null;
    const maxRadius = radius ? parseFloat(radius) : 50;

    // Fetch active wholesalers
    const activeWholesalerUsers = await User.find({ role: 'wholesaler', isActive: true });
    const userIds = activeWholesalerUsers.map((u) => u._id);

    const wholesalers = await Wholesaler.find({ user: { $in: userIds } });

    const results = [];

    for (const w of wholesalers) {
      // Coordinate fallback: use latitude/longitude or location.coordinates
      let lat = w.latitude;
      let lng = w.longitude;

      if ((lat === null || lat === undefined) && w.location && w.location.coordinates && w.location.coordinates.length === 2) {
        lng = w.location.coordinates[0];
        lat = w.location.coordinates[1];
      }

      // Calculate distance if user coordinates provided
      const distanceKm = userLat !== null && userLng !== null && lat !== null && lng !== null
        ? calculateHaversineDistance(userLat, userLng, lat, lng)
        : null;

      // Filter by radius if user provided coordinates and radius
      if (distanceKm !== null && radius && distanceKm > maxRadius) {
        continue;
      }

      // Filter by search query (company, address, city, state, postal code, categories)
      if (search && search.trim()) {
        const query = search.trim().toLowerCase();
        const matchesName = (w.companyName || '').toLowerCase().includes(query);
        const matchesAddress = (w.address || '').toLowerCase().includes(query);
        const matchesCity = (w.city || '').toLowerCase().includes(query);
        const matchesState = (w.state || '').toLowerCase().includes(query);
        const matchesPostal = (w.postalCode || '').toLowerCase().includes(query);
        const matchesCat = (w.categoriesSupplied || []).some((c) => (c || '').toLowerCase().includes(query));
        if (!matchesName && !matchesAddress && !matchesCity && !matchesState && !matchesPostal && !matchesCat) {
          continue;
        }
      }

      // Filter by category
      if (category && category !== 'All') {
        const matchesCategory = (w.categoriesSupplied || []).some(
          (c) => c.toLowerCase() === category.toLowerCase()
        );
        if (!matchesCategory) {
          continue;
        }
      }

      // Quick performance metrics summary
      const completedOrdersCount = await Order.countDocuments({ wholesaler: w.user, status: 'delivered' });
      const totalOrdersCount = await Order.countDocuments({ wholesaler: w.user });
      const fulfillmentRate = totalOrdersCount > 0 ? Math.round((completedOrdersCount / totalOrdersCount) * 100) : null;

      // Real Inventory stock items for this wholesaler
      const stockRecords = await Inventory.find({
        wholesaler: w.user,
        isAvailable: true,
        stockQuantity: { $gt: 0 },
      }).limit(5);

      const deliveryRadius = w.deliveryRadiusKm || 25;
      const isDeliveryAvailable = distanceKm !== null ? distanceKm <= deliveryRadius : true;
      const deliveryStatus = isDeliveryAvailable ? 'Delivery Available' : 'Outside Delivery Area';

      results.push({
        _id: w._id,
        wholesalerId: w.user,
        companyName: w.companyName,
        phone: w.phone,
        address: w.address,
        city: w.city,
        state: w.state,
        postalCode: w.postalCode,
        latitude: lat,
        longitude: lng,
        categoriesSupplied: w.categoriesSupplied || [],
        deliveryRadiusKm: deliveryRadius,
        distanceKm,
        isDeliveryAvailable,
        deliveryStatus,
        availableStock: stockRecords.map((item) => ({
          _id: item._id,
          productName: item.productName,
          category: item.category,
          quantity: item.stockQuantity,
          unit: item.unit,
          unitPrice: item.unitPrice,
        })),
        performance: {
          totalOrders: totalOrdersCount,
          completedOrders: completedOrdersCount,
          fulfillmentRate: fulfillmentRate !== null ? `${fulfillmentRate}%` : 'N/A',
        },
      });
    }

    // Sort by distance if available, otherwise by name
    results.sort((a, b) => {
      if (a.distanceKm !== null && b.distanceKm !== null) {
        return a.distanceKm - b.distanceKm;
      }
      return a.companyName.localeCompare(b.companyName);
    });

    res.json({ success: true, wholesalers: results, count: results.length });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
