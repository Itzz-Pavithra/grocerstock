import mongoose from 'mongoose';

const disputeSchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
    },
    disputeId: {
      type: String,
      unique: true,
      required: true,
    },
    raisedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    raisedByRole: {
      type: String,
      enum: ['retailer', 'wholesaler', 'admin'],
      required: true,
    },
    reason: {
      type: String,
      required: [true, 'Dispute reason is required'],
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Dispute description is required'],
      trim: true,
    },
    status: {
      type: String,
      enum: ['open', 'under_investigation', 'resolved', 'dismissed'],
      default: 'open',
    },
    investigationNotes: {
      type: String,
      default: '',
      trim: true,
    },
    resolutionOutcome: {
      type: String,
      default: '',
      trim: true,
    },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

disputeSchema.index({ order: 1 });
disputeSchema.index({ status: 1 });
disputeSchema.index({ raisedBy: 1 });
disputeSchema.index({ createdAt: -1 });

const Dispute = mongoose.models.Dispute || mongoose.model('Dispute', disputeSchema);
export default Dispute;
