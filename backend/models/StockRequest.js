import mongoose from 'mongoose';

const stockRequestSchema = new mongoose.Schema(
  {
    retailer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    productName: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
    },
    category: {
      type: String,
      required: [true, 'Category name is required'],
      trim: true,
    },
    brand: {
      type: String,
      trim: true,
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [1, 'Quantity must be at least 1'],
    },
    unit: {
      type: String,
      required: [true, 'Unit is required'],
      trim: true,
    },
    urgency: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium',
    },
    preferredDeliveryDate: {
      type: Date,
      required: [true, 'Preferred delivery date is required'],
    },
    remarks: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['pending', 'responded', 'partially_fulfilled', 'accepted', 'rejected'],
      default: 'pending',
    },
    // Multi-Product procurement support
    items: [
      {
        productName: { type: String, required: true, trim: true },
        category: { type: String, required: true, trim: true },
        brand: { type: String, trim: true },
        quantity: { type: Number, required: true, min: 1 },
        unit: { type: String, required: true, trim: true },
        fulfilledQuantity: { type: Number, default: 0 },
        remainingQuantity: { type: Number },
        remarks: { type: String, trim: true },
      },
    ],
    // Partial fulfillment tracking
    requestedQuantity: {
      type: Number,
    },
    fulfilledQuantity: {
      type: Number,
      default: 0,
    },
    remainingQuantity: {
      type: Number,
    },
  },
  {
    timestamps: true,
  }
);

stockRequestSchema.pre('save', function (next) {
  if (this.requestedQuantity === undefined || this.requestedQuantity === null) {
    this.requestedQuantity = this.quantity;
  }
  if (this.remainingQuantity === undefined || this.remainingQuantity === null) {
    this.remainingQuantity = Math.max(0, this.requestedQuantity - (this.fulfilledQuantity || 0));
  }
  next();
});

const StockRequest = mongoose.model('StockRequest', stockRequestSchema);
export default StockRequest;
