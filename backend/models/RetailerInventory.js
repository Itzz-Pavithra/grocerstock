import mongoose from 'mongoose';

const stockMovementSchema = new mongoose.Schema(
  {
    movementType: {
      type: String,
      enum: ['initial_stock', 'procurement_delivery', 'manual_adjustment', 'retail_sale', 'wastage'],
      required: true,
    },
    quantityChange: {
      type: Number,
      required: true,
    },
    balanceAfter: {
      type: Number,
      required: true,
    },
    referenceId: {
      type: String,
      default: '',
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    unitCost: {
      type: Number,
      default: 0,
    },
    sellingPrice: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

const retailerInventorySchema = new mongoose.Schema(
  {
    retailer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    productName: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      trim: true,
    },
    brand: {
      type: String,
      trim: true,
      default: '',
    },
    unit: {
      type: String,
      required: [true, 'Unit is required (e.g. kg, box, packet, liter)'],
      trim: true,
      lowercase: true,
    },
    stockQuantity: {
      type: Number,
      required: [true, 'Stock quantity is required'],
      min: [0, 'Stock quantity cannot be negative'],
      default: 0,
    },
    minStockThreshold: {
      type: Number,
      default: 10,
      min: [0, 'Minimum stock threshold cannot be negative'],
    },
    averageCostPrice: {
      type: Number,
      default: 0,
      min: [0, 'Cost price cannot be negative'],
    },
    sellingPrice: {
      type: Number,
      default: 0,
      min: [0, 'Selling price cannot be negative'],
    },
    lastRestockedAt: {
      type: Date,
      default: null,
    },
    lastSaleAt: {
      type: Date,
      default: null,
    },
    stockMovements: [stockMovementSchema],
  },
  {
    timestamps: true,
  }
);

// Unique compound index: one stock record per product name + retailer
retailerInventorySchema.index({ retailer: 1, productName: 1 }, { unique: true });

const RetailerInventory =
  mongoose.models.RetailerInventory || mongoose.model('RetailerInventory', retailerInventorySchema);

export default RetailerInventory;
