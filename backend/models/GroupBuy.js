import mongoose from 'mongoose';

const participantSchema = new mongoose.Schema(
  {
    retailer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    storeName: {
      type: String,
      required: true,
      trim: true,
    },
    committedQuantity: {
      type: Number,
      required: true,
      min: [1, 'Committed quantity must be at least 1'],
    },
    committedAt: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ['committed', 'withdrawn', 'confirmed'],
      default: 'committed',
    },
  },
  {
    _id: true,
    timestamps: true,
  }
);

const bulkOfferSchema = new mongoose.Schema(
  {
    wholesaler: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    companyName: {
      type: String,
      required: true,
      trim: true,
    },
    offeredPricePerUnit: {
      type: Number,
      required: true,
      min: [0, 'Offered price cannot be negative'],
    },
    minRequiredQuantity: {
      type: Number,
      default: 0,
    },
    deliveryEstimate: {
      type: String,
      default: '2-3 days',
      trim: true,
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected'],
      default: 'pending',
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    _id: true,
  }
);

const groupBuySchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Group buy title is required'],
      trim: true,
    },
    productName: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
    },
    brand: {
      type: String,
      trim: true,
      default: '',
    },
    unit: {
      type: String,
      required: true,
      trim: true,
    },
    targetMinQuantity: {
      type: Number,
      required: [true, 'Target minimum quantity is required'],
      min: [2, 'Target minimum quantity must be at least 2'],
    },
    currentCommittedQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },
    joiningDeadline: {
      type: Date,
      required: [true, 'Joining deadline is required'],
    },
    status: {
      type: String,
      enum: ['open', 'target_reached', 'awarded', 'expired', 'cancelled'],
      default: 'open',
    },
    creator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    creatorStoreName: {
      type: String,
      default: 'Retailer Store',
    },
    city: {
      type: String,
      trim: true,
      default: '',
    },
    latitude: {
      type: Number,
      default: null,
    },
    longitude: {
      type: Number,
      default: null,
    },
    participants: [participantSchema],
    discountTiers: [
      {
        minQuantity: Number,
        indicativeDiscountPercent: Number,
        estimatedPricePerUnit: Number,
      },
    ],
    supplierOffers: [bulkOfferSchema],
    awardedOffer: {
      type: bulkOfferSchema,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

groupBuySchema.index({ status: 1, joiningDeadline: 1 });
groupBuySchema.index({ 'participants.retailer': 1 });

const GroupBuy = mongoose.models.GroupBuy || mongoose.model('GroupBuy', groupBuySchema);

export default GroupBuy;
