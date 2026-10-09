import Response from '../models/Response.js';
import StockRequest from '../models/StockRequest.js';
import Wholesaler from '../models/Wholesaler.js';
import Retailer from '../models/Retailer.js';
import Notification from '../models/Notification.js';
import Order from '../models/Order.js';
import { calculateHaversineDistance, extractCoordinates } from '../utils/geo.js';

// Helper to calculate expected delivery date from deliveryTime text
function parseDeliveryTimeToDate(deliveryTimeStr) {
  const now = new Date();
  if (!deliveryTimeStr) return new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);

  const lower = deliveryTimeStr.toLowerCase().trim();
  const numMatch = lower.match(/\d+/);
  const num = numMatch ? parseInt(numMatch[0]) : 1;

  if (lower.includes('hour')) {
    return new Date(now.getTime() + num * 60 * 60 * 1000);
  }
  if (lower.includes('day')) {
    return new Date(now.getTime() + num * 24 * 60 * 60 * 1000);
  }
  if (lower.includes('week')) {
    return new Date(now.getTime() + num * 7 * 24 * 60 * 60 * 1000);
  }

  return new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
}

// Helper to estimate hours from delivery time string for sorting
function parseDeliveryTimeToHours(deliveryTimeStr) {
  if (!deliveryTimeStr) return 48;
  const lower = deliveryTimeStr.toLowerCase().trim();
  const numMatch = lower.match(/\d+/);
  const num = numMatch ? parseInt(numMatch[0]) : 24;

  if (lower.includes('hour')) return num;
  if (lower.includes('day')) return num * 24;
  if (lower.includes('week')) return num * 7 * 24;
  return 48;
}

/**
 * PROBLEM 1 & 5 FIX: Wholesaler quotation submission with business verification enforcement
 */
export const createResponse = async (req, res) => {
  const { availability, quantity, price, deliveryTime, remarks, items } = req.body;
  const { requestId } = req.params;

  try {
    // 1. Business verification check: Wholesaler must be approved by admin
    const wholesalerProfile = await Wholesaler.findOne({ user: req.user._id });
    if (!wholesalerProfile) {
      return res.status(404).json({ success: false, message: 'Wholesaler profile not found' });
    }

    if (wholesalerProfile.businessVerification?.status === 'pending') {
      return res.status(403).json({
        success: false,
        message: 'Your business account is pending administrator verification. Bidding is restricted until approved.',
      });
    }

    if (wholesalerProfile.businessVerification?.status === 'rejected') {
      return res.status(403).json({
        success: false,
        message: `Your business verification was rejected: "${wholesalerProfile.businessVerification.rejectionReason || 'Non-compliant documents'}". You cannot submit quotations.`,
      });
    }

    // 2. Stock Request eligibility
    const stockRequest = await StockRequest.findById(requestId);
    if (!stockRequest) {
      return res.status(404).json({ success: false, message: 'Stock request not found' });
    }

    if (['accepted', 'rejected'].includes(stockRequest.status)) {
      return res.status(400).json({
        success: false,
        message: `This request is already ${stockRequest.status}. No further quotations can be accepted.`,
      });
    }

    const remainingAllowed =
      stockRequest.remainingQuantity !== undefined && stockRequest.remainingQuantity !== null
        ? stockRequest.remainingQuantity
        : stockRequest.quantity;

    if (remainingAllowed <= 0) {
      return res.status(400).json({
        success: false,
        message: 'This stock request has already been fully fulfilled by accepted orders.',
      });
    }

    // 3. Prevent duplicate quotation from same wholesaler
    const existingResponse = await Response.findOne({ stockRequest: requestId, wholesaler: req.user._id });
    if (existingResponse) {
      return res.status(400).json({
        success: false,
        message: 'You have already submitted a quotation for this request.',
      });
    }

    // 4. Validate items and quantities
    let finalItems = [];
    let finalQty = Number(quantity) || 0;
    let finalPrice = Number(price) || 0;

    if (items && Array.isArray(items) && items.length > 0) {
      finalItems = items.map((it) => ({
        productName: (it.productName || '').trim(),
        requestedQuantity: Number(it.requestedQuantity) || 1,
        offeredQuantity: Math.max(0, Number(it.offeredQuantity) || 0),
        price: Math.max(0, Number(it.price) || 0),
        availability: it.availability || (Number(it.offeredQuantity) > 0 ? 'available' : 'unavailable'),
        remarks: (it.remarks || '').trim(),
      }));

      finalQty = finalItems.reduce((acc, it) => acc + it.offeredQuantity, 0);
      const totalItemVal = finalItems.reduce((acc, it) => acc + it.offeredQuantity * it.price, 0);
      finalPrice = finalQty > 0 ? Number((totalItemVal / finalQty).toFixed(2)) : 0;
    }

    if (finalQty <= 0) {
      return res.status(400).json({ success: false, message: 'Offered quantity must be greater than zero.' });
    }

    if (finalPrice <= 0) {
      return res.status(400).json({ success: false, message: 'Unit price must be greater than zero.' });
    }

    // Cannot quote more than remaining quantity required
    if (finalQty > remainingAllowed) {
      return res.status(400).json({
        success: false,
        message: `Offered quantity (${finalQty} ${stockRequest.unit}) cannot exceed the remaining needed quantity (${remainingAllowed} ${stockRequest.unit}).`,
      });
    }

    const response = await Response.create({
      stockRequest: requestId,
      wholesaler: req.user._id,
      availability: availability || (finalQty < remainingAllowed ? 'partial' : 'available'),
      quantity: finalQty,
      price: finalPrice,
      deliveryTime: (deliveryTime || '24-48 hours').trim(),
      remarks: (remarks || '').trim(),
      items: finalItems,
      status: 'pending',
    });

    if (stockRequest.status === 'pending') {
      stockRequest.status = 'responded';
      await stockRequest.save();
    }

    const companyName = wholesalerProfile.companyName || 'A Wholesaler';

    await Notification.create({
      user: stockRequest.retailer,
      message: `New quotation submitted for "${stockRequest.productName}" by ${companyName}: ${finalQty} ${stockRequest.unit} @ ₹${finalPrice}/${stockRequest.unit}.`,
      type: 'response_received',
    });

    res.status(201).json({
      success: true,
      message: 'Quotation submitted successfully',
      response,
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * Get all quotations submitted for a specific stock request
 */
export const getResponsesForRequest = async (req, res) => {
  const { requestId } = req.params;

  try {
    const responses = await Response.find({ stockRequest: requestId }).sort({ price: 1 });

    const formattedResponses = await Promise.all(
      responses.map(async (resp) => {
        const profile = await Wholesaler.findOne({ user: resp.wholesaler });
        return {
          ...resp.toObject(),
          wholesalerProfile: profile,
        };
      })
    );

    res.json({ success: true, responses: formattedResponses });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get all quotations submitted by the logged-in wholesaler
 */
export const getMyResponses = async (req, res) => {
  try {
    const responses = await Response.find({ wholesaler: req.user._id })
      .populate('stockRequest')
      .sort({ createdAt: -1 });

    const formatted = await Promise.all(
      responses.map(async (resp) => {
        let retailerProfile = null;
        if (resp.stockRequest?.retailer) {
          retailerProfile = await Retailer.findOne({ user: resp.stockRequest.retailer });
        }
        const order = await Order.findOne({ quotation: resp._id });

        return {
          ...resp.toObject(),
          retailerProfile: retailerProfile
            ? {
                storeName: retailerProfile.storeName,
                city: retailerProfile.city,
                address: retailerProfile.address,
              }
            : null,
          associatedOrder: order ? { _id: order._id, status: order.status, totalAmount: order.totalAmount } : null,
        };
      })
    );

    res.json({ success: true, quotations: formatted, count: formatted.length });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * PROBLEM 3 FIX: Atomic Quotation Acceptance & Race Condition Safeguard
 * Idempotently and atomically updates quotation and creates exactly one Order.
 */
export const acceptResponse = async (req, res) => {
  const { id } = req.params;

  try {
    // 1. Idempotency check: Has an order already been created for this quotation?
    const existingOrder = await Order.findOne({ quotation: id });
    if (existingOrder) {
      return res.status(409).json({
        success: false,
        message: `An order (#${existingOrder._id.toString().slice(-6)}) has already been generated for this quotation.`,
        order: existingOrder,
      });
    }

    // 2. Atomic state lock: Atomically change quotation from 'pending' to 'accepted'
    // This prevents any concurrent double-click or simultaneous race condition!
    const responseToAccept = await Response.findOneAndUpdate(
      { _id: id, status: 'pending' },
      { $set: { status: 'accepted' } },
      { new: true }
    );

    if (!responseToAccept) {
      const alreadyAccepted = await Response.findById(id);
      if (alreadyAccepted && alreadyAccepted.status === 'accepted') {
        return res.status(400).json({
          success: false,
          message: 'This quotation has already been accepted.',
        });
      }
      return res.status(400).json({
        success: false,
        message: 'Quotation not found, rejected, or no longer eligible for acceptance.',
      });
    }

    // 3. Verify stock request ownership and remaining capacity
    const stockRequest = await StockRequest.findById(responseToAccept.stockRequest);
    if (!stockRequest) {
      // Rollback quotation status if request is missing
      await Response.findByIdAndUpdate(id, { $set: { status: 'pending' } });
      return res.status(404).json({ success: false, message: 'Stock request not found' });
    }

    if (stockRequest.retailer.toString() !== req.user._id.toString()) {
      // Rollback quotation status
      await Response.findByIdAndUpdate(id, { $set: { status: 'pending' } });
      return res.status(403).json({ success: false, message: 'You are not authorized to accept bids for this request' });
    }

    const totalRequested = stockRequest.requestedQuantity || stockRequest.quantity || 1;
    const acceptedQty = responseToAccept.quantity;
    const previouslyFulfilled = stockRequest.fulfilledQuantity || 0;
    const remainingQtyBefore =
      stockRequest.remainingQuantity !== undefined ? stockRequest.remainingQuantity : totalRequested;

    // Check that accepted quantity does not exceed remaining quantity
    if (acceptedQty > remainingQtyBefore) {
      // Rollback quotation status
      await Response.findByIdAndUpdate(id, { $set: { status: 'pending' } });
      return res.status(400).json({
        success: false,
        message: `Quotation quantity (${acceptedQty} ${stockRequest.unit}) exceeds remaining needed quantity (${remainingQtyBefore} ${stockRequest.unit}).`,
      });
    }

    const newlyFulfilled = previouslyFulfilled + acceptedQty;
    const remainingQty = Math.max(0, totalRequested - newlyFulfilled);

    stockRequest.fulfilledQuantity = newlyFulfilled;
    stockRequest.remainingQuantity = remainingQty;

    const isPartiallyFulfilled = remainingQty > 0;

    if (isPartiallyFulfilled) {
      stockRequest.status = 'partially_fulfilled';
    } else {
      stockRequest.status = 'accepted';
      // When 100% fulfilled, reject other pending quotations
      await Response.updateMany(
        { stockRequest: stockRequest._id, _id: { $ne: responseToAccept._id }, status: 'pending' },
        { $set: { status: 'rejected' } }
      );
    }

    await stockRequest.save();

    // 4. Calculate total order amount & line items
    let orderItems = [];
    let orderTotalAmount = acceptedQty * responseToAccept.price;

    if (responseToAccept.items && responseToAccept.items.length > 0) {
      orderItems = responseToAccept.items.map((it) => ({
        productName: it.productName,
        category: stockRequest.category,
        brand: stockRequest.brand,
        quantity: it.offeredQuantity,
        unit: stockRequest.unit,
        unitPrice: it.price,
        totalPrice: it.offeredQuantity * it.price,
      }));
      orderTotalAmount = orderItems.reduce((acc, it) => acc + it.totalPrice, 0);
    }

    const expectedDelivery = parseDeliveryTimeToDate(responseToAccept.deliveryTime);

    // 5. Create Order Record exactly once
    const order = await Order.create({
      stockRequest: stockRequest._id,
      quotation: responseToAccept._id,
      retailer: req.user._id,
      wholesaler: responseToAccept.wholesaler,
      productName: stockRequest.productName,
      quantity: acceptedQty,
      unit: stockRequest.unit,
      unitPrice: responseToAccept.price,
      totalAmount: orderTotalAmount,
      items: orderItems,
      expectedDeliveryDate: expectedDelivery,
      status: 'accepted',
      retailerInventoryUpdated: false,
      inventoryDeducted: false,
      statusHistory: [
        {
          status: 'accepted',
          notes: isPartiallyFulfilled
            ? `Partial order created for ${acceptedQty} ${stockRequest.unit} (${remainingQty} ${stockRequest.unit} remaining)`
            : 'Order created upon quotation acceptance',
        },
      ],
    });

    // 6. Notifications
    const fulfillmentLabel = isPartiallyFulfilled
      ? `Partially accepted (${acceptedQty} of ${totalRequested} ${stockRequest.unit})`
      : 'Accepted';

    await Notification.create({
      user: responseToAccept.wholesaler,
      message: `Your bid on "${stockRequest.productName}" was ${fulfillmentLabel}! Order #${order._id.toString().slice(-6)} created.`,
      type: 'request_accepted',
    });

    if (!isPartiallyFulfilled) {
      const rejectedResponses = await Response.find({
        stockRequest: stockRequest._id,
        _id: { $ne: responseToAccept._id },
        status: 'rejected',
      });

      const rejectNotifications = rejectedResponses.map((rej) => ({
        user: rej.wholesaler,
        message: `Your bid on "${stockRequest.productName}" was not selected. Request is now fully fulfilled.`,
        type: 'request_rejected',
      }));

      if (rejectNotifications.length > 0) {
        await Notification.insertMany(rejectNotifications);
      }
    }

    res.json({
      success: true,
      message: isPartiallyFulfilled
        ? `Quotation accepted for ${acceptedQty} ${stockRequest.unit}. Remaining ${remainingQty} ${stockRequest.unit} stays open for bids.`
        : 'Bid accepted successfully and order generated',
      response: responseToAccept,
      order,
      partialFulfillment: {
        totalRequested,
        fulfilledQuantity: newlyFulfilled,
        remainingQuantity: remainingQty,
        isPartiallyFulfilled,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * FEATURE 2: Price-Versus-Distance Recommendations
 * Multi-factor decision support comparing quotations with transparent, explainable scoring.
 */
export const getRecommendationsForRequest = async (req, res) => {
  const { requestId } = req.params;

  try {
    const stockRequest = await StockRequest.findById(requestId);
    if (!stockRequest) {
      return res.status(404).json({ success: false, message: 'Stock request not found' });
    }

    const retailerProfile = await Retailer.findOne({ user: stockRequest.retailer });
    const retCoords = extractCoordinates(retailerProfile);

    const quotations = await Response.find({ stockRequest: requestId, status: { $ne: 'rejected' } });
    if (quotations.length === 0) {
      return res.json({
        success: true,
        hasQuotations: false,
        message: 'No quotations submitted yet for this request.',
        recommendations: [],
      });
    }

    // Evaluate each quotation against multi-factor metrics
    const evaluated = await Promise.all(
      quotations.map(async (q) => {
        const wholesalerProfile = await Wholesaler.findOne({ user: q.wholesaler });
        const wCoords = extractCoordinates(wholesalerProfile);

        let distanceKm = null;
        if (
          retCoords.latitude !== null &&
          retCoords.longitude !== null &&
          wCoords.latitude !== null &&
          wCoords.longitude !== null
        ) {
          distanceKm = calculateHaversineDistance(
            retCoords.latitude,
            retCoords.longitude,
            wCoords.latitude,
            wCoords.longitude
          );
        }

        // Supplier reliability from actual completed orders
        const totalOrders = await Order.countDocuments({ wholesaler: q.wholesaler });
        const deliveredOrders = await Order.countDocuments({ wholesaler: q.wholesaler, status: 'delivered' });
        const reliabilityRate = totalOrders > 0 ? Math.round((deliveredOrders / totalOrders) * 100) : null;

        // Estimated delivery charge: baseline ₹30 + ₹5/km if distance > 3km
        const estimatedDeliveryCharge = distanceKm !== null ? Number((Math.max(30, distanceKm * 6)).toFixed(2)) : null;
        const totalProductPrice = Number((q.quantity * q.price).toFixed(2));
        const estimatedTotalProcurementCost =
          estimatedDeliveryCharge !== null ? Number((totalProductPrice + estimatedDeliveryCharge).toFixed(2)) : totalProductPrice;

        const deliveryHours = parseDeliveryTimeToHours(q.deliveryTime);

        return {
          quotationId: q._id,
          wholesalerId: q.wholesaler,
          companyName: wholesalerProfile?.companyName || 'Wholesale Supplier',
          phone: wholesalerProfile?.phone || '',
          address: wholesalerProfile?.address || '',
          quotedUnitPrice: q.price,
          quotedQuantity: q.quantity,
          totalProductPrice,
          distanceKm,
          estimatedDeliveryCharge,
          estimatedTotalProcurementCost,
          deliveryTime: q.deliveryTime,
          deliveryHours,
          totalCompletedOrders: deliveredOrders,
          reliabilityRate,
          status: q.status,
          createdAt: q.createdAt,
        };
      })
    );

    // Compute rankings & best tags
    const minPrice = Math.min(...evaluated.map((e) => e.quotedUnitPrice));
    const validDistances = evaluated.filter((e) => e.distanceKm !== null).map((e) => e.distanceKm);
    const minDistance = validDistances.length > 0 ? Math.min(...validDistances) : null;
    const minHours = Math.min(...evaluated.map((e) => e.deliveryHours));

    const scored = evaluated.map((item) => {
      // Multi-factor value score (out of 100):
      // Price factor (40% weight): lower is better
      const priceScore = minPrice > 0 ? Math.max(0, 100 - ((item.quotedUnitPrice - minPrice) / minPrice) * 100) : 100;

      // Distance factor (25% weight): closer is better
      let distanceScore = 50; // neutral default if coordinates missing
      if (minDistance !== null && item.distanceKm !== null && minDistance > 0) {
        distanceScore = Math.max(0, 100 - ((item.distanceKm - minDistance) / minDistance) * 50);
      }

      // Speed factor (20% weight): faster delivery
      const speedScore = Math.max(0, 100 - ((item.deliveryHours - minHours) / Math.max(1, minHours)) * 50);

      // Reliability factor (15% weight)
      const reliabilityScore = item.reliabilityRate !== null ? item.reliabilityRate : 70; // 70 baseline for new suppliers

      const compositeScore = Number(
        (priceScore * 0.4 + distanceScore * 0.25 + speedScore * 0.2 + reliabilityScore * 0.15).toFixed(1)
      );

      const badges = [];
      if (item.quotedUnitPrice === minPrice) badges.push({ tag: 'Lowest Price', icon: '₹', color: 'mustard' });
      if (minDistance !== null && item.distanceKm === minDistance)
        badges.push({ tag: 'Nearest Supplier', icon: '📍', color: 'paleBlue' });
      if (item.deliveryHours === minHours)
        badges.push({ tag: 'Fastest Delivery', icon: '⚡', color: 'mustard' });
      if (item.reliabilityRate !== null && item.reliabilityRate >= 90)
        badges.push({ tag: 'Highly Reliable', icon: '🛡️', color: 'charcoal' });

      return {
        ...item,
        compositeScore,
        badges,
        scoreFactors: {
          priceFactor: Number((priceScore * 0.4).toFixed(1)),
          distanceFactor: Number((distanceScore * 0.25).toFixed(1)),
          speedFactor: Number((speedScore * 0.2).toFixed(1)),
          reliabilityFactor: Number((reliabilityScore * 0.15).toFixed(1)),
        },
      };
    });

    // Sort by best overall composite score descending
    scored.sort((a, b) => b.compositeScore - a.compositeScore);
    if (scored.length > 0) {
      scored[0].badges.unshift({ tag: 'Best Overall Value', icon: '⭐', color: 'mustard' });
    }

    res.json({
      success: true,
      hasQuotations: true,
      requestId,
      productName: stockRequest.productName,
      unit: stockRequest.unit,
      requestedQuantity: stockRequest.quantity,
      recommendations: scored,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * FEATURE 3: Smart Procurement Optimizer
 * Evaluates single-supplier vs feasible multi-supplier split combinations for procurement optimization.
 */
export const getProcurementOptimizer = async (req, res) => {
  const { requestId } = req.params;

  try {
    const stockRequest = await StockRequest.findById(requestId);
    if (!stockRequest) {
      return res.status(404).json({ success: false, message: 'Stock request not found' });
    }

    const totalNeeded = stockRequest.remainingQuantity || stockRequest.quantity || 1;
    const quotations = await Response.find({ stockRequest: requestId, status: 'pending' }).sort({ price: 1 });

    if (quotations.length === 0) {
      return res.json({
        success: true,
        hasQuotations: false,
        message: 'No open quotations available to optimize strategy.',
        strategy: null,
      });
    }

    // Populate supplier details
    const populated = await Promise.all(
      quotations.map(async (q) => {
        const profile = await Wholesaler.findOne({ user: q.wholesaler });
        const deliveredCount = await Order.countDocuments({ wholesaler: q.wholesaler, status: 'delivered' });
        const totalOrders = await Order.countDocuments({ wholesaler: q.wholesaler });
        const reliability = totalOrders > 0 ? Math.round((deliveredCount / totalOrders) * 100) : 75;

        return {
          quotationId: q._id,
          wholesalerId: q.wholesaler,
          companyName: profile?.companyName || 'Supplier',
          price: q.price,
          availableQuantity: q.quantity,
          deliveryTime: q.deliveryTime,
          deliveryHours: parseDeliveryTimeToHours(q.deliveryTime),
          reliability,
          items: q.items || [],
        };
      })
    );

    // Baseline calculation: Average quoted price * total needed
    const avgPrice = populated.reduce((s, p) => s + p.price, 0) / populated.length;
    const baselineCost = Number((avgPrice * totalNeeded).toFixed(2));

    // Option A: Best Single Supplier (must have >= totalNeeded or highest available)
    const singleFullSuppliers = populated.filter((p) => p.availableQuantity >= totalNeeded);
    let bestSingle = null;

    if (singleFullSuppliers.length > 0) {
      // Pick cheapest among suppliers who can fulfill 100%
      singleFullSuppliers.sort((a, b) => a.price - b.price);
      const chosen = singleFullSuppliers[0];
      const cost = Number((chosen.price * totalNeeded).toFixed(2));
      const savings = Number((baselineCost - cost).toFixed(2));

      bestSingle = {
        type: 'Single Supplier Full Fulfillment',
        isFeasible: true,
        suppliers: [
          {
            wholesalerId: chosen.wholesalerId,
            companyName: chosen.companyName,
            assignedQuantity: totalNeeded,
            unitPrice: chosen.price,
            subtotal: cost,
            deliveryTime: chosen.deliveryTime,
          },
        ],
        totalCost: cost,
        savingsVsBaseline: Math.max(0, savings),
        maxFulfillmentHours: chosen.deliveryHours,
        fulfillmentPercent: 100,
        unfulfilledQuantity: 0,
        rationale: `${chosen.companyName} can fulfill the complete order of ${totalNeeded} ${stockRequest.unit} at ₹${chosen.price}/${stockRequest.unit} with a single shipment, eliminating split delivery overhead.`,
      };
    }

    // Option B: Multi-Supplier Split Combination (Greedy optimal allocation)
    // Allocates cheapest quantities first up to total needed
    let remainingToAllocate = totalNeeded;
    const splitAssignments = [];
    let splitTotalCost = 0;
    let splitMaxHours = 0;

    const sortedByPrice = [...populated].sort((a, b) => a.price - b.price);

    for (const sup of sortedByPrice) {
      if (remainingToAllocate <= 0) break;
      const alloc = Math.min(sup.availableQuantity, remainingToAllocate);
      if (alloc > 0) {
        const subtotal = Number((alloc * sup.price).toFixed(2));
        splitAssignments.push({
          wholesalerId: sup.wholesalerId,
          companyName: sup.companyName,
          assignedQuantity: alloc,
          unitPrice: sup.price,
          subtotal,
          deliveryTime: sup.deliveryTime,
        });
        splitTotalCost += subtotal;
        splitMaxHours = Math.max(splitMaxHours, sup.deliveryHours);
        remainingToAllocate -= alloc;
      }
    }

    const splitFulfillmentPercent = Math.round(((totalNeeded - remainingToAllocate) / totalNeeded) * 100);
    const splitSavings = Number((baselineCost - splitTotalCost).toFixed(2));

    // Multi-shipment overhead cost: add ₹50 per extra delivery to account for logistics friction
    const splitLogisticsOverhead = splitAssignments.length > 1 ? (splitAssignments.length - 1) * 50 : 0;
    const netSplitCost = splitTotalCost + splitLogisticsOverhead;

    const bestSplit = {
      type: splitAssignments.length === 1 ? 'Single Supplier Strategy' : 'Optimized Multi-Supplier Split',
      suppliersCount: splitAssignments.length,
      suppliers: splitAssignments,
      totalProductCost: Number(splitTotalCost.toFixed(2)),
      logisticsOverheadEstimate: splitLogisticsOverhead,
      netTotalCost: Number(netSplitCost.toFixed(2)),
      savingsVsBaseline: Math.max(0, Number((baselineCost - netSplitCost).toFixed(2))),
      maxFulfillmentHours: splitMaxHours,
      fulfillmentPercent: splitFulfillmentPercent,
      unfulfilledQuantity: remainingToAllocate,
      rationale:
        splitAssignments.length > 1
          ? `Splits procurement across ${splitAssignments.length} suppliers to capture the lowest available unit prices. Note: entails ${splitAssignments.length} separate deliveries.`
          : `Optimal allocation achieved via ${splitAssignments[0]?.companyName}.`,
    };

    // Determine overall recommendation:
    // If single supplier exists and cost is within 5% of split strategy, prefer single to avoid delivery complexity!
    let recommendedStrategy = 'single';
    let recommendationReason = '';

    if (bestSingle) {
      if (bestSplit.suppliersCount > 1 && bestSplit.netTotalCost < bestSingle.totalCost * 0.95) {
        recommendedStrategy = 'split';
        recommendationReason = `Multi-supplier split saves ₹${(bestSingle.totalCost - bestSplit.netTotalCost).toFixed(2)} even after accounting for multiple deliveries.`;
      } else {
        recommendedStrategy = 'single';
        recommendationReason = `Single delivery from ${bestSingle.suppliers[0].companyName} is simpler and faster without significant cost difference.`;
      }
    } else {
      recommendedStrategy = 'split';
      recommendationReason = `No single supplier has sufficient inventory (${totalNeeded} ${stockRequest.unit}). Multi-supplier split is required to fulfill the request.`;
    }

    res.json({
      success: true,
      hasQuotations: true,
      stockRequest: {
        id: stockRequest._id,
        productName: stockRequest.productName,
        quantity: totalNeeded,
        unit: stockRequest.unit,
      },
      baselineCost,
      recommendedStrategy,
      recommendationReason,
      options: {
        singleSupplier: bestSingle,
        splitCombination: bestSplit,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
