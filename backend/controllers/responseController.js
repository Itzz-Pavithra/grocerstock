import Response from '../models/Response.js';
import StockRequest from '../models/StockRequest.js';
import Wholesaler from '../models/Wholesaler.js';
import Notification from '../models/Notification.js';
import Order from '../models/Order.js';

export const createResponse = async (req, res) => {
  const { availability, quantity, price, deliveryTime, remarks } = req.body;
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

    const response = await Response.create({
      stockRequest: requestId,
      wholesaler: req.user._id,
      availability,
      quantity,
      price,
      deliveryTime,
      remarks,
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

    stockRequest.status = 'accepted';
    await stockRequest.save();

    await Response.updateMany(
      { stockRequest: stockRequest._id, _id: { $ne: responseToAccept._id } },
      { status: 'rejected' }
    );

    // Create Order Record
    const order = await Order.create({
      stockRequest: stockRequest._id,
      quotation: responseToAccept._id,
      retailer: req.user._id,
      wholesaler: responseToAccept.wholesaler,
      productName: stockRequest.productName,
      quantity: responseToAccept.quantity || stockRequest.quantity,
      unit: stockRequest.unit,
      unitPrice: responseToAccept.price,
      totalAmount: (responseToAccept.quantity || stockRequest.quantity) * responseToAccept.price,
      status: 'accepted',
      statusHistory: [{ status: 'accepted', notes: 'Order created upon quotation acceptance' }],
    });

    await Notification.create({
      user: responseToAccept.wholesaler,
      message: `Your bid on "${stockRequest.productName}" has been accepted! Order #${order._id.toString().slice(-6)} created.`,
      type: 'request_accepted',
    });

    const rejectedResponses = await Response.find({
      stockRequest: stockRequest._id,
      _id: { $ne: responseToAccept._id },
    });

    const rejectNotifications = rejectedResponses.map((rej) => ({
      user: rej.wholesaler,
      message: `Your bid on "${stockRequest.productName}" was not selected.`,
      type: 'request_rejected',
    }));

    if (rejectNotifications.length > 0) {
      await Notification.insertMany(rejectNotifications);
    }

    res.json({ success: true, message: 'Bid accepted successfully and order generated', response: responseToAccept, order });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
