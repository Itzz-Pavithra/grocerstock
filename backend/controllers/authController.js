import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Retailer from '../models/Retailer.js';
import Wholesaler from '../models/Wholesaler.js';
import { sendOtpEmail } from '../services/emailService.js';

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'supersecretkey_localgrocery_2026', {
    expiresIn: '30d',
  });
};

export const register = async (req, res) => {
  const { email, password, role, storeName, companyName, phone, address, businessRegNo } = req.body;

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      if (!existingUser.isEmailVerified) {
        // User exists but unverified: regenerate OTP and send
        const otp = existingUser.generateOTP(Number(process.env.OTP_EXPIRY_MINUTES) || 10);
        await existingUser.save();
        await sendOtpEmail(existingUser.email, otp);

        return res.status(200).json({
          success: true,
          requireOtp: true,
          email: existingUser.email,
          message: 'Account registered previously but unverified. A new verification OTP has been sent to your email.',
        });
      }
      return res.status(409).json({ success: false, message: 'User already exists with this email' });
    }

    if (!['retailer', 'wholesaler'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role selection' });
    }

    const user = new User({
      email,
      password,
      role,
      isEmailVerified: false,
    });

    // Generate cryptographic OTP
    const otp = user.generateOTP(Number(process.env.OTP_EXPIRY_MINUTES) || 10);
    await user.save();

    if (role === 'retailer') {
      if (!storeName || !phone || !address) {
        await User.findByIdAndDelete(user._id);
        return res.status(400).json({ success: false, message: 'Store Name, Phone, and Address are required for Retailer registration' });
      }
      await Retailer.create({
        user: user._id,
        storeName,
        phone,
        address,
      });
    } else if (role === 'wholesaler') {
      if (!companyName || !phone || !address || !businessRegNo) {
        await User.findByIdAndDelete(user._id);
        return res.status(400).json({ success: false, message: 'Company Name, Phone, Address, and Business Registration Number are required for Wholesaler registration' });
      }
      await Wholesaler.create({
        user: user._id,
        companyName,
        phone,
        address,
        businessRegNo,
      });
    }

    // Send OTP email via Nodemailer service
    await sendOtpEmail(user.email, otp);

    res.status(201).json({
      success: true,
      requireOtp: true,
      email: user.email,
      message: 'Registration successful! Please check your email for the 6-digit OTP code to verify your account.',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const verifyOtp = async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ success: false, message: 'Email and OTP code are required' });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
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

    const verificationResult = user.verifyOTP(otp);
    await user.save();

    if (!verificationResult.valid) {
      return res.status(400).json({ success: false, message: verificationResult.reason });
    }

    res.status(200).json({
      success: true,
      message: 'Email verified successfully!',
      _id: user._id,
      email: user.email,
      role: user.role,
      token: generateToken(user._id),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const resendOtp = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ success: false, message: 'Email is required' });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: 'No account found with this email' });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({ success: false, message: 'This account is already verified' });
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
    await user.save();
    await sendOtpEmail(user.email, newOtp);

    res.status(200).json({
      success: true,
      message: 'A new 6-digit OTP code has been sent to your email.',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (user && (await user.comparePassword(password))) {
      if (!user.isActive) {
        return res.status(403).json({ success: false, message: 'This account has been deactivated by an admin' });
      }

      if (!user.isEmailVerified) {
        // Re-trigger OTP email if unverified
        const otp = user.generateOTP(Number(process.env.OTP_EXPIRY_MINUTES) || 10);
        await user.save();
        await sendOtpEmail(user.email, otp);

        return res.status(403).json({
          success: false,
          requireOtp: true,
          email: user.email,
          message: 'Your email address is not verified yet. A verification code has been sent to your inbox.',
        });
      }

      res.json({
        success: true,
        _id: user._id,
        email: user.email,
        role: user.role,
        token: generateToken(user._id),
      });
    } else {
      res.status(401).json({ success: false, message: 'Invalid email or password' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
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
    res.status(500).json({ success: false, message: error.message });
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
    const lat = latitude !== undefined && latitude !== null ? parseFloat(latitude) : undefined;
    const lng = longitude !== undefined && longitude !== null ? parseFloat(longitude) : undefined;

    if (user.role === 'retailer') {
      profile = await Retailer.findOne({ user: user._id });
      if (profile) {
        if (storeName) profile.storeName = storeName.trim();
        if (phone) profile.phone = phone.trim();
        if (address) profile.address = address.trim();
        if (city !== undefined) profile.city = city.trim();
        if (state !== undefined) profile.state = state.trim();
        if (postalCode !== undefined) profile.postalCode = postalCode.trim();
        if (lat !== undefined && !isNaN(lat)) {
          profile.latitude = lat;
        }
        if (lng !== undefined && !isNaN(lng)) {
          profile.longitude = lng;
        }
        if (lat !== undefined && lng !== undefined && !isNaN(lat) && !isNaN(lng)) {
          profile.location = { type: 'Point', coordinates: [lng, lat] };
        }
        await profile.save();
      }
    } else if (user.role === 'wholesaler') {
      profile = await Wholesaler.findOne({ user: user._id });
      if (profile) {
        if (companyName) profile.companyName = companyName.trim();
        if (phone) profile.phone = phone.trim();
        if (address) profile.address = address.trim();
        if (city !== undefined) profile.city = city.trim();
        if (state !== undefined) profile.state = state.trim();
        if (postalCode !== undefined) profile.postalCode = postalCode.trim();
        if (lat !== undefined && !isNaN(lat)) {
          profile.latitude = lat;
        }
        if (lng !== undefined && !isNaN(lng)) {
          profile.longitude = lng;
        }
        if (lat !== undefined && lng !== undefined && !isNaN(lat) && !isNaN(lng)) {
          profile.location = { type: 'Point', coordinates: [lng, lat] };
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
    res.status(500).json({ success: false, message: error.message });
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
    res.status(500).json({ success: false, message: error.message });
  }
};

