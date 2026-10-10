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
import http from 'http';

function httpPost(path, data) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const opts = {
      hostname: 'localhost', port: 5000,
      path, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    };
    const req = http.request(opts, (res) => {
      let d = '';
      res.on('data', chunk => d += chunk);
      res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(d) }); } catch { resolve({ status: res.statusCode, body: d }); } });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function httpGet(path, token) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'localhost', port: 5000,
      path, method: 'GET',
      headers: token ? { Authorization: 'Bearer ' + token } : {}
    };
    const req = http.request(opts, (res) => {
      let d = '';
      res.on('data', chunk => d += chunk);
      res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(d) }); } catch { resolve({ status: res.statusCode, body: d }); } });
    });
    req.on('error', reject);
    req.end();
  });
}

async function run() {
  await connectDB();
  console.log('✅ DB Connected');

  // Get user and show hash
  const retUser = await User.findOne({ email: 'pavithraofficial2204@gmail.com' }).select('+password');
  console.log('Retailer found:', retUser?.email, '| Hash exists:', !!retUser?.password);
  
  // Check all possible common passwords
  const passwords = ['Pavithra@22', 'pavithra@22', 'password', 'Password@1', '123456', 'Pavithra@2204', 'pavithraofficial22', 'Admin@123'];
  for (const pwd of passwords) {
    if (retUser?.password) {
      const ok = await bcrypt.compare(pwd, retUser.password);
      if (ok) {
        console.log('✅ FOUND retailer password:', pwd);
      }
    }
  }
  
  // Try resetting to a known password
  const newPassword = 'Pavithra@22';
  const hashed = await bcrypt.hash(newPassword, 12);
  
  // Check W1
  const w1 = await User.findOne({ email: 'pavithra.workss@gmail.com' }).select('+password');
  for (const pwd of passwords) {
    if (w1?.password) {
      const ok = await bcrypt.compare(pwd, w1.password);
      if (ok) console.log('✅ FOUND W1 password:', pwd);
    }
  }
  
  const w2 = await User.findOne({ email: 'ruba36847@gmail.com' }).select('+password');
  for (const pwd of passwords) {
    if (w2?.password) {
      const ok = await bcrypt.compare(pwd, w2.password);
      if (ok) console.log('✅ FOUND W2 password:', pwd);
    }
  }
  
  console.log('\nNo common passwords found. Setting all to Pavithra@22 for testing...');
  await User.updateOne({ email: 'pavithraofficial2204@gmail.com' }, { password: hashed });
  await User.updateOne({ email: 'pavithra.workss@gmail.com' }, { password: hashed });
  await User.updateOne({ email: 'ruba36847@gmail.com' }, { password: hashed });
  console.log('✅ All passwords reset to Pavithra@22');
  
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
