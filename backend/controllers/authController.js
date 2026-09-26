import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import User from '../models/User.js';
import Retailer from '../models/Retailer.js';
import Wholesaler from '../models/Wholesaler.js';
import PendingRegistration from '../models/PendingRegistration.js';
import { sendOtpEmail } from '../services/emailService.js';
import { ensureWholesalerInventory } from '../services/commonInventoryService.js';

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'supersecretkey_localgrocery_2026', {
    expiresIn: '30d',
  });
};

export const register = async (req, res) => {
  const {
    email,
    password,
    role,
    storeName,
    companyName,
    phone,
    address,
    businessRegNo,
    city,
    state,
    postalCode,
    latitude,
    longitude,
  } = req.body || {};

  try {
    // 1. Strict Server-Side Validation
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ success: false, message: 'Email is required.' });
    }
    const normalizedEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return res.status(400).json({ success: false, message: 'Please provide a valid email address.' });
    }

    if (!password || typeof password !== 'string') {
      return res.status(400).json({ success: false, message: 'Password is required.' });
    }
    const hasMin8 = password.length >= 8;
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasDigit = /[0-9]/.test(password);
    if (!hasMin8 || !hasUpper || !hasLower || !hasDigit) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long and contain uppercase, lowercase, and numeric characters.',
      });
    }

    if (!role || !['retailer', 'wholesaler'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Role must be either retailer or wholesaler.' });
    }

    if (!phone || typeof phone !== 'string' || !phone.trim()) {
      return res.status(400).json({ success: false, message: 'Phone number is required.' });
    }

    if (!address || typeof address !== 'string' || !address.trim()) {
      return res.status(400).json({ success: false, message: 'Address is required.' });
    }

    let parsedLat = undefined;
    let parsedLng = undefined;
    if (latitude !== undefined && latitude !== null && latitude !== '') {
      const num = parseFloat(latitude);
      if (isNaN(num) || num < -90 || num > 90) {
        return res.status(400).json({ success: false, message: 'Invalid latitude. Must be between -90 and 90.' });
      }
      parsedLat = num;
    }
    if (longitude !== undefined && longitude !== null && longitude !== '') {
      const num = parseFloat(longitude);
      if (isNaN(num) || num < -180 || num > 180) {
        return res.status(400).json({ success: false, message: 'Invalid longitude. Must be between -180 and 180.' });
      }
      parsedLng = num;
    }

    if (role === 'retailer') {
      if (!storeName || typeof storeName !== 'string' || !storeName.trim()) {
        return res.status(400).json({ success: false, message: 'Store Name is required for retailer registration.' });
      }
    } else if (role === 'wholesaler') {
      if (!companyName || typeof companyName !== 'string' || !companyName.trim()) {
        return res.status(400).json({ success: false, message: 'Company Name is required for wholesaler registration.' });
      }
      if (!businessRegNo || typeof businessRegNo !== 'string' || !businessRegNo.trim()) {
        return res.status(400).json({ success: false, message: 'Business Registration Number is required for wholesaler registration.' });
      }
    }

    // 2. Check if account already exists
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      if (existingUser.isEmailVerified) {
        return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
      }

      // Legacy unverified account: resend verification OTP
      const otp = existingUser.generateOTP(Number(process.env.OTP_EXPIRY_MINUTES) || 10);
      try {
        await sendOtpEmail(existingUser.email, otp);
      } catch (mailErr) {
        console.error('Failed to send verification email for legacy unverified user:', mailErr.message);
        return res.status(503).json({
          success: false,
          message: 'Unable to send verification email. Please check your email configuration or try again.',
        });
      }

      await existingUser.save();

      return res.status(200).json({
        success: true,
        requireOtp: true,
        email: existingUser.email,
        message: 'Account registered previously but unverified. A new verification OTP has been sent to your email.',
      });
    }

    // 3. Prepare Pending Registration (NO permanent User/Retailer/Wholesaler created yet)
    const otp = crypto.randomInt(100000, 1000000).toString();
    const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
    const expiryMinutes = Number(process.env.OTP_EXPIRY_MINUTES) || 10;
    const otpExpires = new Date(Date.now() + expiryMinutes * 60 * 1000);

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // 4. Send OTP email FIRST - verify email delivery succeeds before accepting registration
    try {
      await sendOtpEmail(normalizedEmail, otp);
    } catch (mailErr) {
      console.error('Failed to send registration OTP email:', mailErr.message);
      return res.status(503).json({
        success: false,
        message: 'Unable to send verification email. Please check your email configuration or try again later.',
      });
    }

    // Store unverified pending registration
    await PendingRegistration.findOneAndUpdate(
      { email: normalizedEmail },
      {
        email: normalizedEmail,
        passwordHash,
        role,
        profileData: {
          storeName: storeName ? storeName.trim() : '',
          companyName: companyName ? companyName.trim() : '',
          businessRegNo: businessRegNo ? businessRegNo.trim() : '',
          phone: phone.trim(),
          address: address.trim(),
          city: city ? city.trim() : '',
          state: state ? state.trim() : '',
          postalCode: postalCode ? postalCode.trim() : '',
          latitude: parsedLat,
          longitude: parsedLng,
        },
        otpHash,
        otpExpires,
        otpAttempts: 0,
        otpLastSentAt: new Date(),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return res.status(201).json({
      success: true,
      requireOtp: true,
      email: normalizedEmail,
      message: 'Registration successful! Please check your email for the 6-digit OTP code to verify your account.',
    });
  } catch (error) {
    console.error('Registration server error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'An unexpected server error occurred during registration. Please try again.',
    });
  }
};

export const verifyOtp = async (req, res) => {
  const { email, otp } = req.body || {};

  if (!email || !otp) {
    return res.status(400).json({ success: false, message: 'Email and 6-digit OTP code are required.' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const trimmedOtp = otp.toString().trim();

  try {
    // 1. Check PendingRegistration first (preferred architecture)
    const pending = await PendingRegistration.findOne({ email: normalizedEmail });
    if (pending) {
      if (pending.otpAttempts >= 5) {
        return res.status(429).json({
          success: false,
          message: 'Maximum OTP verification attempts exceeded. Please request a new code.',
        });
      }

      if (Date.now() > pending.otpExpires.getTime()) {
        return res.status(400).json({
          success: false,
          message: 'OTP has expired. Please request a new code.',
        });
      }

      const enteredHash = crypto.createHash('sha256').update(trimmedOtp).digest('hex');
      if (enteredHash !== pending.otpHash) {
        pending.otpAttempts += 1;
        await pending.save();
        return res.status(400).json({
          success: false,
          message: 'Invalid verification code. Please try again.',
        });
      }

      // Check if user was concurrently created in User
      let user = await User.findOne({ email: normalizedEmail });
      if (user) {
        await PendingRegistration.deleteOne({ _id: pending._id });
        return res.status(409).json({
          success: false,
          message: 'An account with this email already exists.',
        });
      }

      // Create permanent User account
      user = new User({
        email: pending.email,
        password: pending.passwordHash,
        role: pending.role,
        isEmailVerified: true,
        isActive: true,
      });
      await user.save();

      // Create role-specific profile
      if (pending.role === 'retailer') {
        const profilePayload = {
          user: user._id,
          storeName: pending.profileData.storeName,
          phone: pending.profileData.phone,
          address: pending.profileData.address,
          city: pending.profileData.city || '',
          state: pending.profileData.state || '',
          postalCode: pending.profileData.postalCode || '',
        };
        if (
          pending.profileData.latitude !== undefined &&
          pending.profileData.longitude !== undefined &&
          !isNaN(pending.profileData.latitude) &&
          !isNaN(pending.profileData.longitude)
        ) {
          profilePayload.latitude = pending.profileData.latitude;
          profilePayload.longitude = pending.profileData.longitude;
          profilePayload.location = {
            type: 'Point',
            coordinates: [pending.profileData.longitude, pending.profileData.latitude],
            address: pending.profileData.address,
            city: pending.profileData.city || '',
            state: pending.profileData.state || '',
            country: 'India',
            postalCode: pending.profileData.postalCode || '',
          };
        }
        await Retailer.create(profilePayload);
      } else if (pending.role === 'wholesaler') {
        const profilePayload = {
          user: user._id,
          companyName: pending.profileData.companyName,
          phone: pending.profileData.phone,
          address: pending.profileData.address,
          businessRegNo: pending.profileData.businessRegNo,
          city: pending.profileData.city || '',
          state: pending.profileData.state || '',
          postalCode: pending.profileData.postalCode || '',
        };
        if (
          pending.profileData.latitude !== undefined &&
          pending.profileData.longitude !== undefined &&
          !isNaN(pending.profileData.latitude) &&
          !isNaN(pending.profileData.longitude)
        ) {
          profilePayload.latitude = pending.profileData.latitude;
          profilePayload.longitude = pending.profileData.longitude;
          profilePayload.location = {
            type: 'Point',
            coordinates: [pending.profileData.longitude, pending.profileData.latitude],
            address: pending.profileData.address,
            city: pending.profileData.city || '',
            state: pending.profileData.state || '',
            country: 'India',
            postalCode: pending.profileData.postalCode || '',
          };
        }
        await Wholesaler.create(profilePayload);
        await ensureWholesalerInventory(user._id);
      }

      // Clean up pending registration
      await PendingRegistration.deleteOne({ _id: pending._id });

      const token = generateToken(user._id);

      return res.status(200).json({
        success: true,
        message: 'Email verified successfully! Account created.',
        _id: user._id,
        email: user.email,
        role: user.role,
        token,
      });
    }

    // 2. Check legacy unverified user in User collection
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No pending registration found for this email. Please register first.',
      });
    }

    if (user.isEmailVerified) {
      return res.status(200).json({
        success: true,
        alreadyVerified: true,
        message: 'Account is already verified. You can log in.',
        _id: user._id,
        email: user.email,
        role: user.role,
        token: generateToken(user._id),
      });
    }

    const verificationResult = user.verifyOTP(trimmedOtp);
    await user.save();

    if (!verificationResult.valid) {
      return res.status(400).json({ success: false, message: verificationResult.reason });
    }

    return res.status(200).json({
      success: true,
      message: 'Email verified successfully!',
      _id: user._id,
      email: user.email,
      role: user.role,
      token: generateToken(user._id),
    });
  } catch (error) {
    console.error('OTP verification server error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'An error occurred during verification. Please try again.',
    });
  }
};

export const resendOtp = async (req, res) => {
  const { email } = req.body || {};

  if (!email) {
    return res.status(400).json({ success: false, message: 'Email is required.' });
  }

  const normalizedEmail = email.trim().toLowerCase();

  try {
    // 1. Check PendingRegistration
    const pending = await PendingRegistration.findOne({ email: normalizedEmail });
    if (pending) {
      // Cooldown check: 60 seconds
      if (pending.otpLastSentAt && Date.now() - pending.otpLastSentAt.getTime() < 60 * 1000) {
        const remainingSecs = Math.ceil((60 * 1000 - (Date.now() - pending.otpLastSentAt.getTime())) / 1000);
        return res.status(429).json({
          success: false,
          message: `Please wait ${remainingSecs} seconds before requesting a new OTP.`,
        });
      }

      const newOtp = crypto.randomInt(100000, 1000000).toString();
      const newOtpHash = crypto.createHash('sha256').update(newOtp).digest('hex');
      const expiryMinutes = Number(process.env.OTP_EXPIRY_MINUTES) || 10;
      const newOtpExpires = new Date(Date.now() + expiryMinutes * 60 * 1000);

      try {
        await sendOtpEmail(pending.email, newOtp);
      } catch (mailErr) {
        console.error('Failed to send resend OTP email:', mailErr.message);
        return res.status(503).json({
          success: false,
          message: 'Unable to send verification email. Please check your email configuration or try again.',
        });
      }

      pending.otpHash = newOtpHash;
      pending.otpExpires = newOtpExpires;
      pending.otpAttempts = 0;
      pending.otpLastSentAt = new Date();
      await pending.save();

      return res.status(200).json({
        success: true,
        message: 'A new 6-digit OTP code has been sent to your email.',
      });
    }

    // 2. Check legacy user in User collection
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No pending registration found with this email. Please register first.',
      });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({ success: false, message: 'This account is already verified.' });
    }

    // Cooldown check: 60 seconds
    if (user.otpLastSentAt && Date.now() - user.otpLastSentAt.getTime() < 60 * 1000) {
      const remainingSecs = Math.ceil((60 * 1000 - (Date.now() - user.otpLastSentAt.getTime())) / 1000);
      return res.status(429).json({
        success: false,
        message: `Please wait ${remainingSecs} seconds before requesting a new OTP.`,
      });
    }

    const newOtp = user.generateOTP(Number(process.env.OTP_EXPIRY_MINUTES) || 10);
    try {
      await sendOtpEmail(user.email, newOtp);
    } catch (mailErr) {
      console.error('Failed to send resend OTP email for legacy user:', mailErr.message);
      return res.status(503).json({
        success: false,
        message: 'Unable to send verification email. Please check your email configuration or try again.',
      });
    }

    await user.save();

    return res.status(200).json({
      success: true,
      message: 'A new 6-digit OTP code has been sent to your email.',
    });
  } catch (error) {
    console.error('Resend OTP server error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while resending the OTP. Please try again.',
    });
  }
};

export const login = async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email and password are required.' });
  }

  const normalizedEmail = email.trim().toLowerCase();

  try {
    const user = await User.findOne({ email: normalizedEmail });
    if (user && (await user.comparePassword(password))) {
      if (!user.isActive) {
        return res.status(403).json({ success: false, message: 'This account has been deactivated by an admin.' });
      }

      if (!user.isEmailVerified) {
        // Re-trigger OTP email if unverified
        const otp = user.generateOTP(Number(process.env.OTP_EXPIRY_MINUTES) || 10);
        await user.save();
        try {
          await sendOtpEmail(user.email, otp);
        } catch (mailErr) {
          console.error('Failed to send login verification OTP email:', mailErr.message);
        }

        return res.status(403).json({
          success: false,
          requireOtp: true,
          email: user.email,
          message: 'Your email address is not verified yet. A verification code has been sent to your inbox.',
        });
      }

      return res.json({
        success: true,
        _id: user._id,
        email: user.email,
        role: user.role,
        token: generateToken(user._id),
      });
    } else {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }
  } catch (error) {
    console.error('Login server error:', error.message);
    return res.status(500).json({ success: false, message: 'An unexpected error occurred during login. Please try again.' });
  }
};

export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    let profile = null;

    if (user.role === 'retailer') {
      profile = await Retailer.findOne({ user: user._id });
    } else if (user.role === 'wholesaler') {
      profile = await Wholesaler.findOne({ user: user._id });
    }

    res.json({
      success: true,
      _id: user._id,
      email: user.email,
      role: user.role,
      isEmailVerified: user.isEmailVerified,
      profile,
    });
  } catch (error) {
    console.error('getMe server error:', error.message);
    res.status(500).json({ success: false, message: 'Server error retrieving user data.' });
  }
};

export const updateProfile = async (req, res) => {
  const { storeName, companyName, phone, address, city, state, postalCode, latitude, longitude, categoriesSupplied, deliveryRadiusKm } = req.body;

  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    let profile = null;
    let validLat = undefined;
    let validLng = undefined;
    if (latitude !== undefined && latitude !== null && latitude !== '') {
      const num = parseFloat(latitude);
      if (isNaN(num) || num < -90 || num > 90) {
        return res.status(400).json({ success: false, message: 'Invalid latitude. Must be between -90 and 90.' });
      }
      validLat = num;
    }
    if (longitude !== undefined && longitude !== null && longitude !== '') {
      const num = parseFloat(longitude);
      if (isNaN(num) || num < -180 || num > 180) {
        return res.status(400).json({ success: false, message: 'Invalid longitude. Must be between -180 and 180.' });
      }
      validLng = num;
    }

    if (user.role === 'retailer') {
      profile = await Retailer.findOne({ user: user._id });
      if (profile) {
        if (storeName) profile.storeName = storeName.trim();
        if (phone) profile.phone = phone.trim();
        if (address) profile.address = address.trim();
        if (city !== undefined) profile.city = city.trim();
        if (state !== undefined) profile.state = state.trim();
        if (postalCode !== undefined) profile.postalCode = postalCode.trim();
        if (validLat !== undefined) profile.latitude = validLat;
        if (validLng !== undefined) profile.longitude = validLng;
        if (validLat !== undefined && validLng !== undefined) {
          profile.location = {
            type: 'Point',
            coordinates: [validLng, validLat],
            address: profile.address,
            city: profile.city || '',
            state: profile.state || '',
            country: 'India',
            postalCode: profile.postalCode || '',
          };
        }
        await profile.save();
      }
    } else if (user.role === 'wholesaler') {
      profile = await Wholesaler.findOne({ user: user._id });
      if (!profile) {
        profile = new Wholesaler({
          user: user._id,
          companyName: companyName?.trim() || user.email.split('@')[0],
          phone: phone?.trim() || 'N/A',
          address: address?.trim() || 'Warehouse Address',
          businessRegNo: 'REG-' + user._id.toString().slice(-6),
        });
      }
      if (companyName) profile.companyName = companyName.trim();
        if (phone) profile.phone = phone.trim();
        if (address) profile.address = address.trim();
        if (city !== undefined) profile.city = city.trim();
        if (state !== undefined) profile.state = state.trim();
        if (postalCode !== undefined) profile.postalCode = postalCode.trim();
        if (validLat !== undefined) profile.latitude = validLat;
        if (validLng !== undefined) profile.longitude = validLng;
        if (validLat !== undefined && validLng !== undefined) {
          profile.location = {
            type: 'Point',
            coordinates: [validLng, validLat],
            address: profile.address,
            city: profile.city || '',
            state: profile.state || '',
            country: 'India',
            postalCode: profile.postalCode || '',
          };
        }
        if (categoriesSupplied && Array.isArray(categoriesSupplied)) {
          profile.categoriesSupplied = categoriesSupplied;
        }
        if (deliveryRadiusKm !== undefined) {
          profile.deliveryRadiusKm = Number(deliveryRadiusKm);
        }
        await profile.save();
      }
    }

    res.json({
      success: true,
      message: 'Profile updated successfully',
      profile,
    });
  } catch (error) {
    console.error('updateProfile server error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to update user profile.' });
  }
};

export const forgotPassword = async (req, res) => {
  const { email } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: 'No account found with this email' });
    }
    res.json({ success: true, message: 'Password recovery email sent successfully' });
  } catch (error) {
    console.error('forgotPassword server error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to process password recovery request.' });
  }
};

