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
import Category from '../models/Category.js';
import Product from '../models/Product.js';
import Inventory from '../models/Inventory.js';
import RetailerInventory from '../models/RetailerInventory.js';
import StockRequest from '../models/StockRequest.js';
import Response from '../models/Response.js';
import Order from '../models/Order.js';
import RetailSale from '../models/RetailSale.js';
import GroupBuy from '../models/GroupBuy.js';

// The 10 items requested:
// Product | Unit | W1 price | W2 price | Initial stock per wholesaler
const DEMO_10_PRODUCTS = [
  { name: 'Rice', unit: 'kg', w1Price: 58, w2Price: 55, stock: 100, category: 'Pantry Staples', brand: 'Royal Harvest' },
  { name: 'Toor Dal', unit: 'kg', w1Price: 145, w2Price: 150, stock: 60, category: 'Pantry Staples', brand: 'Tata Sampann' },
  { name: 'Sugar', unit: 'kg', w1Price: 46, w2Price: 44, stock: 80, category: 'Pantry Staples', brand: 'Madhur' },
  { name: 'Wheat Flour', unit: 'kg', w1Price: 42, w2Price: 40, stock: 70, category: 'Pantry Staples', brand: 'Aashirvaad' },
  { name: 'Sunflower Oil', unit: 'liter', w1Price: 135, w2Price: 130, stock: 50, category: 'Pantry Staples', brand: 'Fortune' },
  { name: 'Salt', unit: 'kg', w1Price: 22, w2Price: 20, stock: 100, category: 'Pantry Staples', brand: 'Tata Salt' },
  { name: 'Rava', unit: 'kg', w1Price: 48, w2Price: 45, stock: 50, category: 'Pantry Staples', brand: 'Fortune' },
  { name: 'Tea Powder', unit: 'pack', w1Price: 95, w2Price: 100, stock: 40, category: 'Beverages', brand: 'Tata Tea' },
  { name: 'Coffee Powder', unit: 'pack', w1Price: 110, w2Price: 105, stock: 35, category: 'Beverages', brand: 'Bru' },
  { name: 'Biscuits', unit: 'pack', w1Price: 20, w2Price: 22, stock: 100, category: 'Canned & Packaged Goods', brand: 'Parle-G' },
];

async function seedScopedDemoData() {
  try {
    await connectDB();
    console.log('✅ Connected to MongoDB Atlas');

    // 1. Locate the 3 existing accounts
    const w1User = await User.findOne({ email: 'pavithra.workss@gmail.com' });
    const w2User = await User.findOne({ email: 'ruba36847@gmail.com' });
    const retUser = await User.findOne({ email: 'pavithraofficial2204@gmail.com' });

    if (!w1User || !w2User || !retUser) {
      throw new Error(`One or more required users missing! W1: ${!!w1User}, W2: ${!!w2User}, Ret: ${!!retUser}`);
    }

    console.log('Found accounts:');
    console.log(`- Wholesaler 1: ${w1User.email} (${w1User._id})`);
    console.log(`- Wholesaler 2: ${w2User.email} (${w2User._id})`);
    console.log(`- Retailer: ${retUser.email} (${retUser._id})`);

    // Ensure categories exist
    const categoryNames = ['Pantry Staples', 'Beverages', 'Canned & Packaged Goods', 'Fruits & Vegetables', 'Dairy & Eggs'];
    const catMap = {};
    for (const cName of categoryNames) {
      let c = await Category.findOne({ name: cName });
      if (!c) {
        c = await Category.create({ name: cName, description: `${cName} category` });
      }
      catMap[cName] = c._id;
    }

    // Ensure product catalog entries exist
    for (const p of DEMO_10_PRODUCTS) {
      await Product.findOneAndUpdate(
        { name: p.name },
        {
          name: p.name,
          category: catMap[p.category],
          brand: p.brand,
          defaultUnit: p.unit
        },
        { upsert: true, new: true }
      );
    }
    console.log('✅ Catalog products confirmed.');

    // 2. Set up Wholesaler profiles & Business Verification
    // W1 Profile
    await Wholesaler.findOneAndUpdate(
      { user: w1User._id },
      {
        user: w1User._id,
        companyName: 'Pavithra Wholesale Traders',
        phone: '+91 98765 43210',
        address: 'Kuranguchavadi, Suramangalam',
        city: 'Salem',
        state: 'Tamil Nadu',
        postalCode: '636005',
        latitude: 11.673638,
        longitude: 78.125385,
        location: {
          type: 'Point',
          coordinates: [78.125385, 11.673638],
          address: 'Kuranguchavadi, Suramangalam, Salem',
          city: 'Salem',
          state: 'Tamil Nadu',
          country: 'India',
          postalCode: '636005'
        },
        categoriesSupplied: ['Pantry Staples', 'Beverages', 'Canned & Packaged Goods'],
        deliveryRadiusKm: 30,
        businessRegNo: 'GSTIN33AAACP1234A1Z5',
        businessVerification: {
          status: 'approved',
          reviewedAt: new Date(),
          rejectionReason: ''
        }
      },
      { upsert: true, new: true }
    );

    // W2 Profile - set to pending verification initially for Feature 6 demonstration
    await Wholesaler.findOneAndUpdate(
      { user: w2User._id },
      {
        user: w2User._id,
        companyName: 'Apex Wholesale Mart',
        phone: '+91 98421 98765',
        address: 'Hasthampatti Main Road',
        city: 'Salem',
        state: 'Tamil Nadu',
        postalCode: '636007',
        latitude: 11.6764214,
        longitude: 78.1581382,
        location: {
          type: 'Point',
          coordinates: [78.1581382, 11.6764214],
          address: 'Hasthampatti, Salem',
          city: 'Salem',
          state: 'Tamil Nadu',
          country: 'India',
          postalCode: '636007'
        },
        categoriesSupplied: ['Pantry Staples', 'Beverages', 'Canned & Packaged Goods'],
        deliveryRadiusKm: 30,
        businessRegNo: 'GSTIN33AABCA5678B1Z9',
        businessVerification: {
          status: 'pending',
          rejectionReason: ''
        }
      },
      { upsert: true, new: true }
    );

    // Retailer Profile
    await Retailer.findOneAndUpdate(
      { user: retUser._id },
      {
        user: retUser._id,
        storeName: 'Pavithra Daily Fresh Groceries',
        phone: '+91 94432 11223',
        address: 'Fairlands, Salem',
        city: 'Salem',
        state: 'Tamil Nadu',
        postalCode: '636016',
        latitude: 11.6643,
        longitude: 78.1460,
        location: {
          type: 'Point',
          coordinates: [78.1460, 11.6643],
          address: 'Fairlands, Salem',
          city: 'Salem',
          state: 'Tamil Nadu',
          country: 'India',
          postalCode: '636016'
        }
      },
      { upsert: true, new: true }
    );
    console.log('✅ Profiles and locations saved.');

    // 3. Populate 10 inventory items for Wholesaler 1
    // First, remove old/stray inventory records for W1 and W2 only
    await Inventory.deleteMany({ wholesaler: { $in: [w1User._id, w2User._id] } });

    for (const item of DEMO_10_PRODUCTS) {
      await Inventory.create({
        wholesaler: w1User._id,
        productName: item.name,
        category: item.category,
        brand: item.brand,
        unit: item.unit,
        stockQuantity: item.stock,
        unitPrice: item.w1Price,
        minStockThreshold: 15,
        leadTimeDays: 2,
        reorderQuantity: item.stock,
        isAvailable: true
      });

      await Inventory.create({
        wholesaler: w2User._id,
        productName: item.name,
        category: item.category,
        brand: item.brand,
        unit: item.unit,
        stockQuantity: item.stock,
        unitPrice: item.w2Price,
        minStockThreshold: 15,
        leadTimeDays: 2,
        reorderQuantity: item.stock,
        isAvailable: true
      });
    }
    console.log('✅ Exactly 10 items added to Wholesaler 1 and Wholesaler 2.');

    // 4. Populate Retailer Inventory and Sales for Feature 1 (Stockout Prediction) & Feature 4 (Profitability)
    await RetailerInventory.deleteMany({ retailer: retUser._id });
    await RetailSale.deleteMany({ retailer: retUser._id });

    // Store inventory items for retailer
    // Let's create:
    // 1. Rice: Current stock 15 kg (Threshold 25 kg, Daily usage ~5 kg => Stockout in 3 days, Low Stock/Critical)
    // 2. Toor Dal: Current stock 8 kg (Threshold 15 kg, Daily usage ~2.5 kg => Stockout in 3.2 days, Low Stock)
    // 3. Sugar: Current stock 45 kg (Threshold 20 kg, Daily usage ~3 kg => Stockout in 15 days, Healthy)
    // 4. Sunflower Oil: Current stock 6 liters (Threshold 12 liters => Critical)
    // 5. Wheat Flour: Current stock 50 kg (Threshold 20 kg => Healthy)

    const retItems = [
      { name: 'Rice', cat: 'Pantry Staples', brand: 'Royal Harvest', unit: 'kg', stock: 15, threshold: 25, cost: 55, sell: 68 },
      { name: 'Toor Dal', cat: 'Pantry Staples', brand: 'Tata Sampann', unit: 'kg', stock: 8, threshold: 15, cost: 145, sell: 175 },
      { name: 'Sugar', cat: 'Pantry Staples', brand: 'Madhur', unit: 'kg', stock: 45, threshold: 20, cost: 44, sell: 54 },
      { name: 'Sunflower Oil', cat: 'Pantry Staples', brand: 'Fortune', unit: 'liter', stock: 6, threshold: 12, cost: 130, sell: 155 },
      { name: 'Wheat Flour', cat: 'Pantry Staples', brand: 'Aashirvaad', unit: 'kg', stock: 50, threshold: 20, cost: 40, sell: 50 },
    ];

    for (const r of retItems) {
      await RetailerInventory.create({
        retailer: retUser._id,
        productName: r.name,
        category: r.cat,
        brand: r.brand,
        unit: r.unit,
        stockQuantity: r.stock,
        minStockThreshold: r.threshold,
        averageCostPrice: r.cost,
        sellingPrice: r.sell,
        lastRestockedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        stockMovements: [
          {
            movementType: 'procurement_delivery',
            quantityChange: r.stock + 20,
            balanceAfter: r.stock + 20,
            unitCost: r.cost,
            notes: 'Delivered wholesale replenishment',
            createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          },
          {
            movementType: 'retail_sale',
            quantityChange: -20,
            balanceAfter: r.stock,
            unitCost: r.cost,
            sellingPrice: r.sell,
            notes: 'Retail counter sales',
            createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
          }
        ]
      });
    }

    // Create 3 genuine retail sales spanning past 5 days
    const dayAgo = (d) => new Date(Date.now() - d * 24 * 60 * 60 * 1000);

    await RetailSale.create({
      retailer: retUser._id,
      items: [
        { productName: 'Rice', category: 'Pantry Staples', unit: 'kg', quantity: 10, unitSellingPrice: 68, unitCostPrice: 55, totalRevenue: 680, totalCost: 550, grossProfit: 130 },
        { productName: 'Sugar', category: 'Pantry Staples', unit: 'kg', quantity: 5, unitSellingPrice: 54, unitCostPrice: 44, totalRevenue: 270, totalCost: 220, grossProfit: 50 },
      ],
      totalRevenue: 950,
      totalCost: 770,
      totalGrossProfit: 180,
      paymentMethod: 'upi',
      customerNote: 'Morning customer walk-ins',
      createdAt: dayAgo(4)
    });

    await RetailSale.create({
      retailer: retUser._id,
      items: [
        { productName: 'Toor Dal', category: 'Pantry Staples', unit: 'kg', quantity: 8, unitSellingPrice: 175, unitCostPrice: 145, totalRevenue: 1400, totalCost: 1160, grossProfit: 240 },
        { productName: 'Sunflower Oil', category: 'Pantry Staples', unit: 'liter', quantity: 4, unitSellingPrice: 155, unitCostPrice: 130, totalRevenue: 620, totalCost: 520, grossProfit: 100 },
      ],
      totalRevenue: 2020,
      totalCost: 1680,
      totalGrossProfit: 340,
      paymentMethod: 'cash',
      customerNote: 'Evening bulk grocery bill',
      createdAt: dayAgo(2)
    });

    await RetailSale.create({
      retailer: retUser._id,
      items: [
        { productName: 'Rice', category: 'Pantry Staples', unit: 'kg', quantity: 10, unitSellingPrice: 68, unitCostPrice: 55, totalRevenue: 680, totalCost: 550, grossProfit: 130 },
        { productName: 'Wheat Flour', category: 'Pantry Staples', unit: 'kg', quantity: 8, unitSellingPrice: 50, unitCostPrice: 40, totalRevenue: 400, totalCost: 320, grossProfit: 80 },
      ],
      totalRevenue: 1080,
      totalCost: 870,
      totalGrossProfit: 210,
      paymentMethod: 'cash',
      customerNote: 'Counter sales',
      createdAt: dayAgo(1)
    });

    console.log('✅ Retailer inventory and 3 real retail sales created.');

    // 5. Stock Requests and Quotations for Comparison (Section 4 & Feature 2)
    // Clear previous requests/responses for this retailer
    await StockRequest.deleteMany({ retailer: retUser._id });
    await Response.deleteMany({ wholesaler: { $in: [w1User._id, w2User._id] } });
    await Order.deleteMany({ retailer: retUser._id });

    // Active Stock Request: 50 kg Rice
    const reqRice = await StockRequest.create({
      retailer: retUser._id,
      productName: 'Rice',
      category: 'Pantry Staples',
      brand: 'Royal Harvest',
      quantity: 50,
      unit: 'kg',
      urgency: 'high',
      preferredDeliveryDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      remarks: 'Urgent restocking for weekend demand',
      status: 'responded',
      requestedQuantity: 50,
      fulfilledQuantity: 0,
      remainingQuantity: 50
    });

    // Wholesaler 1 Quotation for Rice (₹58/kg)
    await Response.create({
      stockRequest: reqRice._id,
      wholesaler: w1User._id,
      availability: 'available',
      quantity: 50,
      price: 58,
      deliveryTime: '24 hours',
      remarks: 'Immediate dispatch from Suramangalam godown. Fresh harvest stock.',
      status: 'pending'
    });

    // Wholesaler 2 Quotation for Rice (₹55/kg - Cheaper offer!)
    await Response.create({
      stockRequest: reqRice._id,
      wholesaler: w2User._id,
      availability: 'available',
      quantity: 50,
      price: 55,
      deliveryTime: '36 hours',
      remarks: 'Best competitive rate from Hasthampatti warehouse. Free loading.',
      status: 'pending'
    });

    // Also a second request for Toor Dal:
    const reqDal = await StockRequest.create({
      retailer: retUser._id,
      productName: 'Toor Dal',
      category: 'Pantry Staples',
      brand: 'Tata Sampann',
      quantity: 30,
      unit: 'kg',
      urgency: 'medium',
      preferredDeliveryDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      remarks: 'Premium unpolished toor dal required',
      status: 'responded',
      requestedQuantity: 30,
      fulfilledQuantity: 0,
      remainingQuantity: 30
    });

    // W1 quote: ₹145 (Cheaper!)
    await Response.create({
      stockRequest: reqDal._id,
      wholesaler: w1User._id,
      availability: 'available',
      quantity: 30,
      price: 145,
      deliveryTime: '24 hours',
      remarks: 'Direct mill stock.',
      status: 'pending'
    });

    // W2 quote: ₹150
    await Response.create({
      stockRequest: reqDal._id,
      wholesaler: w2User._id,
      availability: 'available',
      quantity: 30,
      price: 150,
      deliveryTime: '48 hours',
      remarks: 'Grade A polished.',
      status: 'pending'
    });

    console.log('✅ Stock requests with real competing quotations created.');

    // 6. Past Delivered Orders for Supplier Performance Scorecard (Feature 3) & Profitability
    // Create past completed requests & responses so that each order references a valid quotation
    const pastReq1 = await StockRequest.create({
      retailer: retUser._id,
      productName: 'Rice',
      category: 'Pantry Staples',
      brand: 'Royal Harvest',
      quantity: 50,
      unit: 'kg',
      urgency: 'high',
      preferredDeliveryDate: dayAgo(9),
      remarks: 'Previous restocking cycle',
      status: 'accepted',
      requestedQuantity: 50,
      fulfilledQuantity: 50,
      remainingQuantity: 0,
      createdAt: dayAgo(12)
    });

    const pastQuote1 = await Response.create({
      stockRequest: pastReq1._id,
      wholesaler: w1User._id,
      availability: 'available',
      quantity: 50,
      price: 56,
      deliveryTime: '24 hours',
      status: 'accepted',
      createdAt: dayAgo(11)
    });

    await Order.create({
      stockRequest: pastReq1._id,
      quotation: pastQuote1._id,
      retailer: retUser._id,
      wholesaler: w1User._id,
      productName: 'Rice',
      quantity: 50,
      unit: 'kg',
      unitPrice: 56,
      totalAmount: 2800,
      status: 'delivered',
      expectedDeliveryDate: dayAgo(9),
      actualDeliveryDate: dayAgo(9),
      deliveredAt: dayAgo(9),
      createdAt: dayAgo(11),
      inventoryDeducted: true
    });

    const pastReq2 = await StockRequest.create({
      retailer: retUser._id,
      productName: 'Toor Dal',
      category: 'Pantry Staples',
      brand: 'Tata Sampann',
      quantity: 25,
      unit: 'kg',
      urgency: 'medium',
      preferredDeliveryDate: dayAgo(4),
      remarks: 'Regular store replenishment',
      status: 'accepted',
      requestedQuantity: 25,
      fulfilledQuantity: 25,
      remainingQuantity: 0,
      createdAt: dayAgo(7)
    });

    const pastQuote2 = await Response.create({
      stockRequest: pastReq2._id,
      wholesaler: w1User._id,
      availability: 'available',
      quantity: 25,
      price: 142,
      deliveryTime: '24 hours',
      status: 'accepted',
      createdAt: dayAgo(6)
    });

    await Order.create({
      stockRequest: pastReq2._id,
      quotation: pastQuote2._id,
      retailer: retUser._id,
      wholesaler: w1User._id,
      productName: 'Toor Dal',
      quantity: 25,
      unit: 'kg',
      unitPrice: 142,
      totalAmount: 3550,
      status: 'delivered',
      expectedDeliveryDate: dayAgo(4),
      actualDeliveryDate: dayAgo(4),
      deliveredAt: dayAgo(4),
      createdAt: dayAgo(6),
      inventoryDeducted: true
    });

    const pastReq3 = await StockRequest.create({
      retailer: retUser._id,
      productName: 'Rice',
      category: 'Pantry Staples',
      brand: 'Royal Harvest',
      quantity: 40,
      unit: 'kg',
      urgency: 'medium',
      preferredDeliveryDate: dayAgo(3),
      remarks: 'Mid-week replenishment',
      status: 'accepted',
      requestedQuantity: 40,
      fulfilledQuantity: 40,
      remainingQuantity: 0,
      createdAt: dayAgo(5)
    });

    const pastQuote3 = await Response.create({
      stockRequest: pastReq3._id,
      wholesaler: w2User._id,
      availability: 'available',
      quantity: 40,
      price: 54,
      deliveryTime: '48 hours',
      status: 'accepted',
      createdAt: dayAgo(4)
    });

    await Order.create({
      stockRequest: pastReq3._id,
      quotation: pastQuote3._id,
      retailer: retUser._id,
      wholesaler: w2User._id,
      productName: 'Rice',
      quantity: 40,
      unit: 'kg',
      unitPrice: 54,
      totalAmount: 2160,
      status: 'delivered',
      expectedDeliveryDate: dayAgo(3),
      actualDeliveryDate: dayAgo(3),
      deliveredAt: dayAgo(3),
      createdAt: dayAgo(4),
      inventoryDeducted: true
    });

    console.log('✅ Historical delivered orders created for real performance metrics.');

    // 7. Group Buying Opportunity (Feature 5)
    await GroupBuy.deleteMany({});
    await GroupBuy.create({
      title: 'Salem Fairlands & Suramangalam Bulk Rice Pool',
      productName: 'Rice',
      category: 'Pantry Staples',
      brand: 'Royal Harvest',
      unit: 'kg',
      targetMinQuantity: 200,
      currentCommittedQuantity: 120,
      joiningDeadline: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
      status: 'open',
      creator: retUser._id,
      creatorStoreName: 'Pavithra Daily Fresh Groceries',
      city: 'Salem',
      latitude: 11.6643,
      longitude: 78.1460,
      participants: [
        {
          retailer: retUser._id,
          storeName: 'Pavithra Daily Fresh Groceries',
          committedQuantity: 70,
          status: 'committed',
        },
        {
          retailer: new (await import('mongoose')).default.Types.ObjectId(),
          storeName: 'Annapoorna Super Stores',
          committedQuantity: 50,
          status: 'committed',
        }
      ],
      discountTiers: [
        { minQuantity: 100, indicativeDiscountPercent: 5, estimatedPricePerUnit: 52 },
        { minQuantity: 200, indicativeDiscountPercent: 10, estimatedPricePerUnit: 49 },
        { minQuantity: 500, indicativeDiscountPercent: 15, estimatedPricePerUnit: 46 }
      ],
      supplierOffers: [
        {
          wholesaler: w1User._id,
          companyName: 'Pavithra Wholesale Traders',
          offeredPricePerUnit: 51,
          minRequiredQuantity: 150,
          deliveryEstimate: '24 hours',
          status: 'pending',
          createdAt: new Date()
        }
      ]
    });

    console.log('✅ Group buying pool created.');

    console.log('\n🎉 ALL SCOPED DEMO DATA READY SUCCESSFULLY!');
  } catch (err) {
    console.error('❌ Error setting up scoped demo data:', err);
  } finally {
    process.exit(0);
  }
}

seedScopedDemoData();
