import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import Retailer from '../models/Retailer.js';
import Wholesaler from '../models/Wholesaler.js';
import Category from '../models/Category.js';
import Product from '../models/Product.js';
import StockRequest from '../models/StockRequest.js';
import Response from '../models/Response.js';
import Notification from '../models/Notification.js';

dotenv.config();

const seedDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/grocery-stock-request-system');
    console.log('Connected to DB for seeding...');

    await User.deleteMany();
    await Retailer.deleteMany();
    await Wholesaler.deleteMany();
    await Category.deleteMany();
    await Product.deleteMany();
    await StockRequest.deleteMany();
    await Response.deleteMany();
    await Notification.deleteMany();

    console.log('Database cleared.');

    const categoriesData = [
      { name: 'Fruits & Vegetables', description: 'Fresh farm produce and greens' },
      { name: 'Dairy & Eggs', description: 'Milk, cheese, butter, and eggs' },
      { name: 'Bakery & Bread', description: 'Fresh loaves, buns, and pastries' },
      { name: 'Beverages', description: 'Juices, sodas, water, and energy drinks' },
      { name: 'Pantry Staples', description: 'Flour, rice, pasta, oil, and spices' },
      { name: 'Canned Goods', description: 'Preserved vegetables, soups, and beans' },
    ];

    const seededCategories = await Category.insertMany(categoriesData);
    console.log('Categories seeded.');

    const getCatId = (name) => seededCategories.find((c) => c.name === name)._id;

    const productsData = [
      { name: 'Red Gala Apples', category: getCatId('Fruits & Vegetables'), brand: 'Organic Farms', defaultUnit: 'kg' },
      { name: 'Cavendish Bananas', category: getCatId('Fruits & Vegetables'), brand: 'Chiquita', defaultUnit: 'box' },
      { name: 'Fresh Whole Milk 1 Gal', category: getCatId('Dairy & Eggs'), brand: 'DairyPure', defaultUnit: 'case' },
      { name: 'Large Grade A White Eggs', category: getCatId('Dairy & Eggs'), brand: 'Eggland Best', defaultUnit: 'box' },
      { name: 'Sliced White Sandwich Bread', category: getCatId('Bakery & Bread'), brand: 'Wonder Bread', defaultUnit: 'case' },
      { name: 'Coca-Cola 12oz 24-Pack', category: getCatId('Beverages'), brand: 'Coca-Cola', defaultUnit: 'case' },
      { name: 'Long Grain White Rice 20lb', category: getCatId('Pantry Staples'), brand: 'Mahatma', defaultUnit: 'bag' },
      { name: 'Canned Black Beans 15oz', category: getCatId('Canned Goods'), brand: 'Goya', defaultUnit: 'case' },
    ];

    await Product.insertMany(productsData);
    console.log('Products seeded.');

    const adminUser = new User({
      email: 'admin@grocery.com',
      password: 'password123',
      role: 'admin',
    });
    await adminUser.save();

    const retUser1 = new User({
      email: 'retail1@grocery.com',
      password: 'password123',
      role: 'retailer',
    });
    await retUser1.save();
    await Retailer.create({
      user: retUser1._id,
      storeName: 'Metro Corner Store',
      phone: '555-0199',
      address: '123 Main St, Metroville',
    });

    const retUser2 = new User({
      email: 'retail2@grocery.com',
      password: 'password123',
      role: 'retailer',
    });
    await retUser2.save();
    await Retailer.create({
      user: retUser2._id,
      storeName: 'Green Valley Grocers',
      phone: '555-0144',
      address: '456 Oak Rd, Springfield',
    });

    const wholeUser1 = new User({
      email: 'whole1@grocery.com',
      password: 'password123',
      role: 'wholesaler',
    });
    await wholeUser1.save();
    await Wholesaler.create({
      user: wholeUser1._id,
      companyName: 'Apex Foods Wholesalers',
      phone: '555-0900',
      address: '789 Industrial Pkwy, Logistics City',
      businessRegNo: 'AP-992384',
    });

    const wholeUser2 = new User({
      email: 'whole2@grocery.com',
      password: 'password123',
      role: 'wholesaler',
    });
    await wholeUser2.save();
    await Wholesaler.create({
      user: wholeUser2._id,
      companyName: 'Choice Products Distrib',
      phone: '555-0811',
      address: '101 Warehouse Blvd, Distrib Zone',
      businessRegNo: 'CP-440129',
    });

    console.log('Users and Profiles seeded.');

    const sampleRequest = await StockRequest.create({
      retailer: retUser1._id,
      productName: 'Fresh Whole Milk 1 Gal',
      category: 'Dairy & Eggs',
      brand: 'DairyPure',
      quantity: 15,
      unit: 'case',
      urgency: 'high',
      preferredDeliveryDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      remarks: 'Need before weekend rush. Please state delivery terms.',
      status: 'responded',
    });

    await Response.create({
      stockRequest: sampleRequest._id,
      wholesaler: wholeUser1._id,
      availability: 'available',
      quantity: 15,
      price: 24.50,
      deliveryTime: '24 hours',
      remarks: 'We can deliver this tomorrow morning by 8 AM.',
    });

    await Response.create({
      stockRequest: sampleRequest._id,
      wholesaler: wholeUser2._id,
      availability: 'partial',
      quantity: 10,
      price: 22.00,
      deliveryTime: '2 days',
      remarks: 'Currently running short. Can provide 10 cases by Friday.',
    });

    console.log('Sample stock requests and responses seeded.');
    
    mongoose.connection.close();
    console.log('Seeding finished. Database connection closed.');
  } catch (error) {
    console.error('Error during seeding:', error);
    process.exit(1);
  }
};

seedDB();
