import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import connectDB from '../config/db.js';
import User from '../models/User.js';
import Retailer from '../models/Retailer.js';
import Wholesaler from '../models/Wholesaler.js';
import Category from '../models/Category.js';
import Product from '../models/Product.js';
import StockRequest from '../models/StockRequest.js';
import Response from '../models/Response.js';
import Order from '../models/Order.js';
import Inventory from '../models/Inventory.js';
import Notification from '../models/Notification.js';
import { ensureWholesalerInventory } from '../services/commonInventoryService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config();

const seedDB = async () => {
  try {
    await connectDB();
    console.log('🌱 Connected to database for seeding...');

    await User.deleteMany();
    await Retailer.deleteMany();
    await Wholesaler.deleteMany();
    await Category.deleteMany();
    await Product.deleteMany();
    await StockRequest.deleteMany();
    await Response.deleteMany();
    await Order.deleteMany();
    await Inventory.deleteMany();
    await Notification.deleteMany();

    console.log('🗑️ Existing collections cleared.');

    const categoriesData = [
      { name: 'Fruits & Vegetables', description: 'Fresh farm produce and greens' },
      { name: 'Dairy & Eggs', description: 'Milk, curd, butter, cheese, and eggs' },
      { name: 'Bakery & Bread', description: 'Fresh loaves, buns, and bakery goods' },
      { name: 'Beverages', description: 'Juices, water, soft drinks, and tea' },
      { name: 'Pantry Staples', description: 'Flour, rice, dal, edible oil, and spices' },
      { name: 'Canned & Packaged Goods', description: 'Preserved foods, noodles, and biscuits' },
    ];

    const seededCategories = await Category.insertMany(categoriesData);
    console.log('✅ Categories seeded.');

    const getCatId = (name) => seededCategories.find((c) => c.name === name)._id;

    const productsData = [
      { name: 'Sona Masoori Raw Rice', category: getCatId('Pantry Staples'), brand: 'Royal Harvest', defaultUnit: 'kg' },
      { name: 'Aashirvaad Superior MP Atta', category: getCatId('Pantry Staples'), brand: 'Aashirvaad', defaultUnit: 'kg' },
      { name: 'Fortune Sunlite Refined Sunflower Oil', category: getCatId('Pantry Staples'), brand: 'Fortune', defaultUnit: 'liter' },
      { name: 'Toor Dal Premium Unpolished', category: getCatId('Pantry Staples'), brand: 'Tata Sampann', defaultUnit: 'kg' },
      { name: 'Fresh Farm Whole Milk', category: getCatId('Dairy & Eggs'), brand: 'Amul Taaza', defaultUnit: 'liter' },
      { name: 'Farm Fresh White Eggs 30-Pack', category: getCatId('Dairy & Eggs'), brand: 'Eggoz', defaultUnit: 'tray' },
      { name: 'Red Delicious Apples', category: getCatId('Fruits & Vegetables'), brand: 'FreshFarms', defaultUnit: 'kg' },
      { name: 'Cavendish Bananas', category: getCatId('Fruits & Vegetables'), brand: 'Robusta', defaultUnit: 'kg' },
    ];

    await Product.insertMany(productsData);
    console.log('✅ Products seeded.');

    // Seed Admin
    const adminUser = new User({
      email: 'admin@grocery.com',
      password: 'password123',
      role: 'admin',
      isEmailVerified: true,
      isActive: true,
    });
    await adminUser.save();

    // Seed Retailer 1 (Metro Supermart)
    const retUser1 = new User({
      email: 'retail1@grocery.com',
      password: 'password123',
      role: 'retailer',
      isEmailVerified: true,
      isActive: true,
    });
    await retUser1.save();
    await Retailer.create({
      user: retUser1._id,
      storeName: 'Metro Fresh Supermart',
      phone: '+91 98450 12345',
      address: 'Shop 12, Brigade Road',
      city: 'Bengaluru',
      state: 'Karnataka',
      postalCode: '560001',
      latitude: 12.9716,
      longitude: 77.5946,
      location: { type: 'Point', coordinates: [77.5946, 12.9716] },
    });

    // Seed Retailer 2 (Green Valley Groceries)
    const retUser2 = new User({
      email: 'retail2@grocery.com',
      password: 'password123',
      role: 'retailer',
      isEmailVerified: true,
      isActive: true,
    });
    await retUser2.save();
    await Retailer.create({
      user: retUser2._id,
      storeName: 'Green Valley Daily Needs',
      phone: '+91 98450 67890',
      address: 'Plot 45, 12th Main, Indiranagar',
      city: 'Bengaluru',
      state: 'Karnataka',
      postalCode: '560038',
      latitude: 12.9784,
      longitude: 77.6408,
      location: { type: 'Point', coordinates: [77.6408, 12.9784] },
    });

    // Seed Wholesaler 1 (Apex Logistics Wholesale)
    const wholeUser1 = new User({
      email: 'whole1@grocery.com',
      password: 'password123',
      role: 'wholesaler',
      isEmailVerified: true,
      isActive: true,
    });
    await wholeUser1.save();
    await Wholesaler.create({
      user: wholeUser1._id,
      companyName: 'Apex Wholesale Mart & Logistics',
      phone: '+91 98110 44556',
      address: '78 Industrial Area, Whitefield',
      city: 'Bengaluru',
      state: 'Karnataka',
      postalCode: '560066',
      latitude: 12.9698,
      longitude: 77.7499,
      location: { type: 'Point', coordinates: [77.7499, 12.9698] },
      categoriesSupplied: ['Pantry Staples', 'Dairy & Eggs', 'Beverages'],
      deliveryRadiusKm: 30,
      businessRegNo: 'GSTIN29ABCDE1234F1Z5',
    });

    // Seed Wholesaler 2 (Kaveri Agro Distributors)
    const wholeUser2 = new User({
      email: 'whole2@grocery.com',
      password: 'password123',
      role: 'wholesaler',
      isEmailVerified: true,
      isActive: true,
    });
    await wholeUser2.save();
    await Wholesaler.create({
      user: wholeUser2._id,
      companyName: 'Kaveri Agro & FMCG Distributors',
      phone: '+91 98220 99887',
      address: '102 APMC Yard, Yeshwanthpur',
      city: 'Bengaluru',
      state: 'Karnataka',
      postalCode: '560022',
      latitude: 13.0238,
      longitude: 77.5501,
      location: { type: 'Point', coordinates: [77.5501, 13.0238] },
      categoriesSupplied: ['Pantry Staples', 'Fruits & Vegetables', 'Canned & Packaged Goods'],
      deliveryRadiusKm: 40,
      businessRegNo: 'GSTIN29XYZAB5678C1Z2',
    });

    console.log('✅ Users and business profiles seeded with locations.');

    // Seed Common 100-Unit Inventory Catalogue for Wholesalers
    await ensureWholesalerInventory(wholeUser1._id);
    await ensureWholesalerInventory(wholeUser2._id);
    console.log('✅ Common 100-stock inventory seeded for wholesalers.');

    // Seed Wholesaler 2 Inventory
    await Inventory.insertMany([
      {
        wholesaler: wholeUser2._id,
        productName: 'Sona Masoori Raw Rice',
        category: 'Pantry Staples',
        brand: 'Royal Harvest',
        unit: 'kg',
        stockQuantity: 200,
        unitPrice: 50,
        minStockThreshold: 40,
        leadTimeDays: 3,
        reorderQuantity: 200,
        isAvailable: true,
      },
      {
        wholesaler: wholeUser2._id,
        productName: 'Toor Dal Premium Unpolished',
        category: 'Pantry Staples',
        brand: 'Tata Sampann',
        unit: 'kg',
        stockQuantity: 8,
        unitPrice: 142,
        minStockThreshold: 20,
        leadTimeDays: 4,
        reorderQuantity: 50,
        isAvailable: true,
      },
      {
        wholesaler: wholeUser2._id,
        productName: 'Red Delicious Apples',
        category: 'Fruits & Vegetables',
        brand: 'FreshFarms',
        unit: 'kg',
        stockQuantity: 95,
        unitPrice: 110,
        minStockThreshold: 25,
        leadTimeDays: 2,
        reorderQuantity: 80,
        isAvailable: true,
      },
    ]);

    console.log('✅ Wholesaler inventories seeded.');

    // Seed Historical Requests & Past Delivered Orders for Metrics, Predictions & Price Comparison
    const pastRequest1 = await StockRequest.create({
      retailer: retUser1._id,
      productName: 'Sona Masoori Raw Rice',
      category: 'Pantry Staples',
      brand: 'Royal Harvest',
      quantity: 100,
      unit: 'kg',
      urgency: 'high',
      preferredDeliveryDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      remarks: 'Bulk requirement for store stocking',
      status: 'accepted',
      requestedQuantity: 100,
      fulfilledQuantity: 100,
      remainingQuantity: 0,
      createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
    });

    const pastResponse1 = await Response.create({
      stockRequest: pastRequest1._id,
      wholesaler: wholeUser1._id,
      availability: 'available',
      quantity: 100,
      price: 51,
      deliveryTime: '24 hours',
      status: 'accepted',
      createdAt: new Date(Date.now() - 13 * 24 * 60 * 60 * 1000),
    });

    const pastOrder1 = await Order.create({
      stockRequest: pastRequest1._id,
      quotation: pastResponse1._id,
      retailer: retUser1._id,
      wholesaler: wholeUser1._id,
      productName: 'Sona Masoori Raw Rice',
      quantity: 100,
      unit: 'kg',
      unitPrice: 51,
      totalAmount: 5100,
      status: 'delivered',
      expectedDeliveryDate: new Date(Date.now() - 11 * 24 * 60 * 60 * 1000),
      actualDeliveryDate: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000), // On-time!
      packedAt: new Date(Date.now() - 13 * 24 * 60 * 60 * 1000),
      shippedAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000),
      outForDeliveryAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000),
      deliveredAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000),
      deliveryNotes: 'Delivered in clean sealed sacks',
      inventoryDeducted: true,
      statusHistory: [
        { status: 'accepted', updatedAt: new Date(Date.now() - 13 * 24 * 60 * 60 * 1000) },
        { status: 'processing', updatedAt: new Date(Date.now() - 13 * 24 * 60 * 60 * 1000) },
        { status: 'packed', updatedAt: new Date(Date.now() - 13 * 24 * 60 * 60 * 1000) },
        { status: 'shipped', updatedAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000) },
        { status: 'delivered', updatedAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000) },
      ],
      createdAt: new Date(Date.now() - 13 * 24 * 60 * 60 * 1000),
    });

    // Past Order 2
    const pastRequest2 = await StockRequest.create({
      retailer: retUser2._id,
      productName: 'Sona Masoori Raw Rice',
      category: 'Pantry Staples',
      brand: 'Royal Harvest',
      quantity: 50,
      unit: 'kg',
      urgency: 'medium',
      preferredDeliveryDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      status: 'accepted',
      requestedQuantity: 50,
      fulfilledQuantity: 50,
      remainingQuantity: 0,
      createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    });

    const pastResponse2 = await Response.create({
      stockRequest: pastRequest2._id,
      wholesaler: wholeUser2._id,
      availability: 'available',
      quantity: 50,
      price: 49.50,
      deliveryTime: '48 hours',
      status: 'accepted',
      createdAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
    });

    await Order.create({
      stockRequest: pastRequest2._id,
      quotation: pastResponse2._id,
      retailer: retUser2._id,
      wholesaler: wholeUser2._id,
      productName: 'Sona Masoori Raw Rice',
      quantity: 50,
      unit: 'kg',
      unitPrice: 49.50,
      totalAmount: 2475,
      status: 'delivered',
      expectedDeliveryDate: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
      actualDeliveryDate: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
      inventoryDeducted: true,
      statusHistory: [
        { status: 'accepted', updatedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000) },
        { status: 'shipped', updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) },
        { status: 'delivered', updatedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000) },
      ],
      createdAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
    });

    console.log('🎉 Seeding successfully completed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during seeding:', error);
    process.exit(1);
  }
};

seedDB();
