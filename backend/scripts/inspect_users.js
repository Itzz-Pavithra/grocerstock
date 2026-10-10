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

async function inspect() {
  try {
    await connectDB();
    console.log('Connected to MongoDB Atlas');

    const targetEmails = [
      'pavithra.workss@gmail.com',
      'ruba36847@gmail.com',
      'pavithraofficial2204@gmail.com',
      'admin@grocery.com'
    ];

    const users = await User.find({ email: { $in: targetEmails } });
    console.log('--- FOUND USERS ---');
    for (const u of users) {
      console.log(JSON.stringify({
        id: u._id,
        email: u.email,
        name: u.name,
        role: u.role,
        businessName: u.businessName,
        isEmailVerified: u.isEmailVerified,
        isActive: u.isActive,
        verificationStatus: u.verificationStatus
      }, null, 2));
    }

    const allAdmins = await User.find({ role: 'admin' });
    console.log('--- ADMIN USERS ---', allAdmins.map(a => ({ id: a._id, email: a.email, role: a.role })));

  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit(0);
  }
}

inspect();
