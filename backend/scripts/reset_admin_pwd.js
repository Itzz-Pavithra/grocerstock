import dns from 'dns';
try { dns.setServers(['8.8.8.8', '1.1.1.1']); } catch {}
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

import connectDB from '../config/db.js';
import User from '../models/User.js';
import bcrypt from 'bcryptjs';

async function resetAdminPassword() {
  await connectDB();
  
  const admin = await User.findOne({ role: 'admin' }).select('+password');
  console.log('Admin found:', admin?.email, '| Has password:', !!admin?.password);
  
  // Set password to Admin@123
  const hashed = await bcrypt.hash('Admin@123', 12);
  const result = await User.updateOne({ role: 'admin' }, { password: hashed });
  console.log('Password reset result:', result.modifiedCount, 'modified');
  console.log('New admin password: Admin@123');
  console.log('Admin email:', admin?.email);
  
  process.exit(0);
}

resetAdminPassword().catch(e => { console.error(e); process.exit(1); });
