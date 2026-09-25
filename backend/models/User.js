import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
    },
    role: {
      type: String,
      enum: ['retailer', 'wholesaler', 'admin'],
      required: [true, 'Role is required'],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    otpHash: {
      type: String,
      default: null,
    },
    otpExpires: {
      type: Date,
      default: null,
    },
    otpAttempts: {
      type: Number,
      default: 0,
    },
    otpLastSentAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

userSchema.pre('save', async function () {
  if (!this.isModified('password')) {
    return;
  }
  // Prevent double-hashing if password is already a valid bcrypt hash
  if (
    typeof this.password === 'string' &&
    (this.password.startsWith('$2a$') ||
      this.password.startsWith('$2b$') ||
      this.password.startsWith('$2y$')) &&
    this.password.length === 60
  ) {
    return;
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Cryptographically secure OTP generation helper
userSchema.methods.generateOTP = function (expiryMinutes = 10) {
  // Generate secure 6-digit integer (100000 - 999999)
  const otpNumber = crypto.randomInt(100000, 1000000).toString();
  
  // Store hashed OTP in database for security
  this.otpHash = crypto.createHash('sha256').update(otpNumber).digest('hex');
  this.otpExpires = new Date(Date.now() + expiryMinutes * 60 * 1000);
  this.otpAttempts = 0;
  this.otpLastSentAt = new Date();

  return otpNumber; // Return unhashed code ONLY to send via email
};

userSchema.methods.verifyOTP = function (enteredOTP) {
  if (!this.otpHash || !this.otpExpires) return { valid: false, reason: 'No OTP generated' };
  
  if (Date.now() > this.otpExpires.getTime()) {
    return { valid: false, reason: 'OTP has expired' };
  }

  if (this.otpAttempts >= 5) {
    return { valid: false, reason: 'Maximum OTP verification attempts exceeded. Please request a new code.' };
  }

  const enteredHash = crypto.createHash('sha256').update(enteredOTP.toString().trim()).digest('hex');
  
  if (enteredHash === this.otpHash) {
    this.isEmailVerified = true;
    this.otpHash = null;
    this.otpExpires = null;
    this.otpAttempts = 0;
    return { valid: true };
  } else {
    this.otpAttempts += 1;
    return { valid: false, reason: 'Invalid verification code' };
  }
};

const User = mongoose.models.User || mongoose.model('User', userSchema);
export default User;
