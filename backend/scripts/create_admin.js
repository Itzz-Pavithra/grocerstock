import dns from 'dns';
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch {}

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

import connectDB from '../config/db.js';
import User from '../models/User.js';

async function createAdmin() {
  try {
    await connectDB();
    console.log('Connected to MongoDB Atlas');

    const existing = await User.findOne({ email: 'admin@grocery.com' });
    if (existing) {
      console.log('Admin user already exists:', existing.email);
      existing.role = 'admin';
      existing.isEmailVerified = true;
      existing.isActive = true;
      existing.password = 'password123'; // triggers pre('save') bcrypt hash
      await existing.save();
      console.log('✅ Admin password updated to password123');
    } else {
      const admin = new User({
        email: 'admin@grocery.com',
        password: 'password123',
        role: 'admin',
        isEmailVerified: true,
        isActive: true,
      });
      await admin.save();
      console.log('✅ Default Admin created successfully:', admin.email);
    }
  } catch (err) {
    console.error('❌ Error creating admin:', err.message);
  } finally {
    process.exit(0);
  }
}

createAdmin();
