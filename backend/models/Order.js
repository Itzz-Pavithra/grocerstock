import mongoose from 'mongoose';

const VALID_TRANSITIONS = {
  pending: ['accepted', 'cancelled'],
  accepted: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
};

const orderSchema = new mongoose.Schema(
  {
    stockRequest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StockRequest',
      required: true,
    },
    quotation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Response',
      required: true,
    },
    retailer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    wholesaler: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    productName: {
      type: String,
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    unit: {
      type: String,
      required: true,
    },
    unitPrice: {
      type: Number,
      required: true,
    },
    totalAmount: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'processing', 'shipped', 'delivered', 'cancelled'],
      default: 'accepted',
    },
    statusHistory: [
      {
        status: { type: String, required: true },
        updatedAt: { type: Date, default: Date.now },
        notes: { type: String },
      },
    ],
  },
  {
    timestamps: true,
  }
);

orderSchema.methods.canTransitionTo = function (nextStatus) {
  const current = this.status;
  const allowed = VALID_TRANSITIONS[current] || [];
  return allowed.includes(nextStatus);
};

const Order = mongoose.model('Order', orderSchema);
export default Order;
