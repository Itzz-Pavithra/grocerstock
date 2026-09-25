import mongoose from 'mongoose';

const responseSchema = new mongoose.Schema(
  {
    stockRequest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StockRequest',
      required: true,
    },
    wholesaler: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    availability: {
      type: String,
      enum: ['available', 'partial', 'unavailable'],
      required: [true, 'Availability is required'],
    },
    quantity: {
      type: Number,
      required: [true, 'Offered quantity is required'],
      min: [0, 'Offered quantity cannot be negative'],
    },
    price: {
      type: Number,
      required: [true, 'Unit price is required'],
      min: [0, 'Price cannot be negative'],
    },
    deliveryTime: {
      type: String,
      required: [true, 'Delivery time is required'],
      trim: true,
    },
    remarks: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected'],
      default: 'pending',
    },
    // Multi-Product quotation details
    items: [
      {
        productName: { type: String, required: true },
        requestedQuantity: { type: Number, required: true },
        offeredQuantity: { type: Number, required: true, min: 0 },
        price: { type: Number, required: true, min: 0 },
        availability: {
          type: String,
          enum: ['available', 'partial', 'unavailable'],
          default: 'available',
        },
        remarks: { type: String, trim: true },
      },
    ],
  },
  {
    timestamps: true,
  }
);

const Response = mongoose.models.Response || mongoose.model('Response', responseSchema);
export default Response;
