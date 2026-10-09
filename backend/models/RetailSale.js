import mongoose from 'mongoose';

const saleItemSchema = new mongoose.Schema({
  productName: {
    type: String,
    required: true,
    trim: true,
  },
  category: {
    type: String,
    trim: true,
    default: 'General',
  },
  unit: {
    type: String,
    required: true,
    trim: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: [0.01, 'Sold quantity must be positive'],
  },
  unitSellingPrice: {
    type: Number,
    required: true,
    min: [0, 'Selling price cannot be negative'],
  },
  unitCostPrice: {
    type: Number,
    default: 0,
    min: [0, 'Cost price cannot be negative'],
  },
  totalRevenue: {
    type: Number,
    required: true,
  },
  totalCost: {
    type: Number,
    default: 0,
  },
  grossProfit: {
    type: Number,
    default: 0,
  },
});

const retailSaleSchema = new mongoose.Schema(
  {
    retailer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    items: [saleItemSchema],
    totalRevenue: {
      type: Number,
      required: true,
      min: 0,
    },
    totalCost: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalGrossProfit: {
      type: Number,
      default: 0,
    },
    paymentMethod: {
      type: String,
      enum: ['cash', 'upi', 'card', 'credit'],
      default: 'cash',
    },
    customerNote: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

retailSaleSchema.index({ retailer: 1, createdAt: -1 });

const RetailSale = mongoose.models.RetailSale || mongoose.model('RetailSale', retailSaleSchema);

export default RetailSale;
