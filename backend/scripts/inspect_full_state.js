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
import Wholesaler from '../models/Wholesaler.js';
import Retailer from '../models/Retailer.js';
import Inventory from '../models/Inventory.js';
import RetailerInventory from '../models/RetailerInventory.js';
import Product from '../models/Product.js';
import StockRequest from '../models/StockRequest.js';
import Response from '../models/Response.js';
import Order from '../models/Order.js';
import GroupBuy from '../models/GroupBuy.js';

async function inspectFullState() {
  try {
    await connectDB();
    console.log('Connected to DB');

    const w1 = await User.findOne({ email: 'pavithra.workss@gmail.com' });
    const w2 = await User.findOne({ email: 'ruba36847@gmail.com' });
    const ret = await User.findOne({ email: 'pavithraofficial2204@gmail.com' });

    console.log('=== USERS ===');
    console.log('Wholesaler 1 (pavithra.workss@gmail.com):', w1 ? w1._id : 'NOT FOUND');
    console.log('Wholesaler 2 (ruba36847@gmail.com):', w2 ? w2._id : 'NOT FOUND');
    console.log('Retailer (pavithraofficial2204@gmail.com):', ret ? ret._id : 'NOT FOUND');

    const w1Prof = w1 ? await Wholesaler.findOne({ user: w1._id }) : null;
    const w2Prof = w2 ? await Wholesaler.findOne({ user: w2._id }) : null;
    const retProf = ret ? await Retailer.findOne({ user: ret._id }) : null;

    console.log('=== PROFILES ===');
    console.log('W1 Profile:', w1Prof ? { id: w1Prof._id, companyName: w1Prof.companyName, verificationStatus: w1Prof.verificationStatus, location: w1Prof.location } : 'None');
    console.log('W2 Profile:', w2Prof ? { id: w2Prof._id, companyName: w2Prof.companyName, verificationStatus: w2Prof.verificationStatus, location: w2Prof.location } : 'None');
    console.log('Retailer Profile:', retProf ? { id: retProf._id, storeName: retProf.storeName, location: retProf.location } : 'None');

    const w1Inv = w1 ? await Inventory.find({ wholesaler: w1._id }) : [];
    const w2Inv = w2 ? await Inventory.find({ wholesaler: w2._id }) : [];
    const retInv = ret ? await RetailerInventory.find({ retailer: ret._id }) : [];

    console.log('=== INVENTORIES ===');
    console.log('W1 Inventory Count:', w1Inv.length, w1Inv.map(i => ({ name: i.productName, price: i.unitPrice, qty: i.stockQuantity })));
    console.log('W2 Inventory Count:', w2Inv.length, w2Inv.map(i => ({ name: i.productName, price: i.unitPrice, qty: i.stockQuantity })));
    console.log('Retailer Inventory Count:', retInv.length, retInv.map(i => ({ name: i.productName, qty: i.stockQuantity })));

    const products = await Product.find({});
    console.log('=== CATALOG PRODUCTS ===', products.length, products.map(p => ({ id: p._id, name: p.name, category: p.category, unit: p.unit })));

    const reqs = ret ? await StockRequest.find({ retailer: ret._id }) : [];
    console.log('=== RETAILER REQUESTS ===', reqs.length, reqs.map(r => ({ id: r._id, product: r.productName, status: r.status })));

    const responses = ret ? await Response.find({ retailer: ret._id }) : [];
    console.log('=== RESPONSES FOR RETAILER ===', responses.length, responses.map(r => ({ id: r._id, wholesaler: r.wholesaler, price: r.price, status: r.status })));

    const orders = ret ? await Order.find({ retailer: ret._id }) : [];
    console.log('=== ORDERS FOR RETAILER ===', orders.length, orders.map(o => ({ id: o._id, product: o.productName, status: o.status, amount: o.totalAmount })));

    const groupBuys = await GroupBuy.find({});
    console.log('=== GROUP BUYS ===', groupBuys.length, groupBuys.map(g => ({ id: g._id, title: g.title, status: g.status, product: g.productName })));

  } catch (err) {
    console.error('Inspection error:', err);
  } finally {
    process.exit(0);
  }
}

inspectFullState();
