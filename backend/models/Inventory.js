import mongoose from 'mongoose';

const inventorySchema = new mongoose.Schema(
  {
    wholesaler: {
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
      required: [true, 'Category is required'],
      trim: true,
    },
    brand: {
      type: String,
      trim: true,
    },
    unit: {
      type: String,
      required: [true, 'Unit is required (e.g. kg, box, bag, liter)'],
      trim: true,
    },
    stockQuantity: {
      type: Number,
      required: [true, 'Stock quantity is required'],
      min: [0, 'Stock quantity cannot be negative'],
      default: 0,
    },
    unitPrice: {
      type: Number,
      required: [true, 'Unit price is required'],
      min: [0, 'Price cannot be negative'],
    },
    minStockThreshold: {
      type: Number,
      default: 10,
    },
    leadTimeDays: {
      type: Number,
      default: 3,
    },
    reorderQuantity: {
      type: Number,
      default: 50,
    },
    isAvailable: {
      type: Boolean,
      default: true,
    },

  },
  {
    timestamps: true,
  }
);

inventorySchema.index({ wholesaler: 1, productName: 1 }, { unique: true });

const Inventory = mongoose.model('Inventory', inventorySchema);
export default Inventory;
