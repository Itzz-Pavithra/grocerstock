import mongoose from 'mongoose';
import dns from 'dns';

// Fix Node.js DNS SRV lookup on Windows local networks for MongoDB Atlas
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (dnsErr) {
  // Ignore if DNS server override is restricted
}

let cached = global.mongoose;
if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

const connectDB = async () => {
  if (cached.conn && mongoose.connection.readyState >= 1) {
    return cached.conn;
  }

  const uri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/grocery-stock-request-system';
  if (!uri) {
    throw new Error('MONGODB_URI environment variable is not defined.');
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(uri, {
      dbName: process.env.MONGODB_DB_NAME || 'grocery-stock-request-system',
      serverSelectionTimeoutMS: 10000,
    }).then((m) => {
      console.log(`✅ MongoDB Connected Successfully: ${m.connection.host} / DB: ${m.connection.name}`);
      return m;
    });
  }

  try {
    cached.conn = await cached.promise;
    return cached.conn;
  } catch (error) {
    cached.promise = null;
    console.error(`❌ Error connecting to MongoDB: ${error.message}`);
    throw error;
  }
};

export default connectDB;

