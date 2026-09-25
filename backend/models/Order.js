import mongoose from 'mongoose';

const VALID_TRANSITIONS = {
  pending: ['accepted', 'cancelled'],
  accepted: ['processing', 'cancelled'],
  processing: ['packed', 'shipped', 'cancelled'],
  packed: ['shipped', 'out_for_delivery', 'cancelled'],
  shipped: ['out_for_delivery', 'delivered'],
  out_for_delivery: ['delivered'],
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
    // Multi-item order details
    items: [
      {
        productName: { type: String, required: true },
        category: { type: String },
        brand: { type: String },
        quantity: { type: Number, required: true },
        unit: { type: String, required: true },
        unitPrice: { type: Number, required: true },
        totalPrice: { type: Number, required: true },
      },
    ],
    status: {
      type: String,
      enum: ['pending', 'accepted', 'processing', 'packed', 'shipped', 'out_for_delivery', 'delivered', 'cancelled'],
      default: 'accepted',
    },
    expectedDeliveryDate: {
      type: Date,
    },
    actualDeliveryDate: {
      type: Date,
    },
    packedAt: {
      type: Date,
    },
    shippedAt: {
      type: Date,
    },
    outForDeliveryAt: {
      type: Date,
    },
    deliveredAt: {
      type: Date,
    },
    deliveryNotes: {
      type: String,
      trim: true,
    },
    inventoryDeducted: {
      type: Boolean,
      default: false,
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

