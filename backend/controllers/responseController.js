import Response from '../models/Response.js';
import StockRequest from '../models/StockRequest.js';
import Wholesaler from '../models/Wholesaler.js';
import Notification from '../models/Notification.js';
import Order from '../models/Order.js';

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

  // Default to 2 days
  return new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
}

export const createResponse = async (req, res) => {
  const { availability, quantity, price, deliveryTime, remarks, items } = req.body;
  const { requestId } = req.params;

  try {
    const stockRequest = await StockRequest.findById(requestId);
    if (!stockRequest) {
      return res.status(404).json({ success: false, message: 'Stock request not found' });
    }

    const existingResponse = await Response.findOne({ stockRequest: requestId, wholesaler: req.user._id });
    if (existingResponse) {
      return res.status(400).json({ success: false, message: 'You have already submitted a quotation for this request' });
    }

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

    if (finalQty < 0 || finalPrice < 0) {
      return res.status(400).json({ success: false, message: 'Quantity and price cannot be negative' });
    }

    const response = await Response.create({
      stockRequest: requestId,
      wholesaler: req.user._id,
      availability: availability || (finalQty < (stockRequest.remainingQuantity || stockRequest.quantity) ? 'partial' : 'available'),
      quantity: finalQty,
      price: finalPrice,
      deliveryTime: deliveryTime || '24-48 hours',
      remarks,
      items: finalItems,
      status: 'pending',
    });

    if (stockRequest.status === 'pending') {
      stockRequest.status = 'responded';
      await stockRequest.save();
    }

    const wholesalerProfile = await Wholesaler.findOne({ user: req.user._id });
    const companyName = wholesalerProfile ? wholesalerProfile.companyName : 'A Wholesaler';

    await Notification.create({
      user: stockRequest.retailer,
      message: `New bid submitted for your request "${stockRequest.productName}" by ${companyName}.`,
      type: 'response_received',
    });

    res.status(201).json({ success: true, response });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const getResponsesForRequest = async (req, res) => {
  const { requestId } = req.params;

  try {
    const responses = await Response.find({ stockRequest: requestId });

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

export const acceptResponse = async (req, res) => {
  const { id } = req.params;

  try {
    const responseToAccept = await Response.findById(id);
    if (!responseToAccept) {
      return res.status(404).json({ success: false, message: 'Quotation not found' });
    }

    const stockRequest = await StockRequest.findById(responseToAccept.stockRequest);
    if (!stockRequest) {
      return res.status(404).json({ success: false, message: 'Stock request not found' });
    }

    if (stockRequest.retailer.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'You are not authorized to accept bids for this request' });
    }

    responseToAccept.status = 'accepted';
    await responseToAccept.save();

    // FEATURE 5 & 8: Real Partial Fulfillment Calculations
    const totalRequested = stockRequest.requestedQuantity || stockRequest.quantity || 1;
    const acceptedQty = responseToAccept.quantity;
    const previouslyFulfilled = stockRequest.fulfilledQuantity || 0;
    const newlyFulfilled = previouslyFulfilled + acceptedQty;
    const remainingQty = Math.max(0, totalRequested - newlyFulfilled);

    stockRequest.fulfilledQuantity = newlyFulfilled;
    stockRequest.remainingQuantity = remainingQty;

    const isPartiallyFulfilled = remainingQty > 0;

    if (isPartiallyFulfilled) {
      stockRequest.status = 'partially_fulfilled';
      // Keep request open so other quotations can fulfill the remaining quantity!
    } else {
      stockRequest.status = 'accepted';
      // When 100% fulfilled, reject other pending quotations
      await Response.updateMany(
        { stockRequest: stockRequest._id, _id: { $ne: responseToAccept._id }, status: 'pending' },
        { status: 'rejected' }
      );
    }

    await stockRequest.save();

    // Calculate total order amount & items
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

    // Create Order Record for the actual fulfilled quantity
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
      statusHistory: [
        {
          status: 'accepted',
          notes: isPartiallyFulfilled
            ? `Partial order created for ${acceptedQty} ${stockRequest.unit} (${remainingQty} ${stockRequest.unit} remaining)`
            : 'Order created upon quotation acceptance',
        },
      ],
    });

    // Notify Wholesaler
    const fulfillmentLabel = isPartiallyFulfilled
      ? `Partially accepted (${acceptedQty} of ${totalRequested} ${stockRequest.unit})`
      : 'Accepted';

    await Notification.create({
      user: responseToAccept.wholesaler,
      message: `Your bid on "${stockRequest.productName}" was ${fulfillmentLabel}! Order #${order._id.toString().slice(-6)} created.`,
      type: 'request_accepted',
    });

    // Notify rejected wholesalers only if order was completely fulfilled
    if (!isPartiallyFulfilled) {
      const rejectedResponses = await Response.find({
        stockRequest: stockRequest._id,
        _id: { $ne: responseToAccept._id },
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

