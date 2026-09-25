import mongoose from 'mongoose';

const pendingRegistrationSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ['retailer', 'wholesaler'],
      required: true,
    },
    profileData: {
      storeName: { type: String, trim: true, default: '' },
      companyName: { type: String, trim: true, default: '' },
      businessRegNo: { type: String, trim: true, default: '' },
      phone: { type: String, required: true, trim: true },
      address: { type: String, required: true, trim: true },
    },
    otpHash: {
      type: String,
      required: true,
    },
    otpExpires: {
      type: Date,
      required: true,
    },
    otpAttempts: {
      type: Number,
      default: 0,
    },
    otpLastSentAt: {
      type: Date,
      default: Date.now,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 3600, // Document auto-expires after 1 hour if not verified
    },
  },
  {
    timestamps: true,
  }
);

const PendingRegistration =
  mongoose.models.PendingRegistration ||
  mongoose.model('PendingRegistration', pendingRegistrationSchema);

export default PendingRegistration;
