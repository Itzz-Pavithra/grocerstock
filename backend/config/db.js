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

  const primaryUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  const fallbackUri = 'mongodb://127.0.0.1:27017/grocery-stock-request-system';
  const uri = primaryUri || fallbackUri;

  if (!cached.promise) {
    const opts = {
      dbName: process.env.MONGODB_DB_NAME || 'grocery-stock-request-system',
      serverSelectionTimeoutMS: 8000,
    };

    cached.promise = mongoose.connect(uri, opts).then((m) => {
      console.log(`✅ MongoDB Connected Successfully: ${m.connection.host} / DB: ${m.connection.name}`);
      return m;
    }).catch(async (primaryError) => {
      // If Atlas connection failed in development (e.g. IP not whitelisted or offline), attempt local fallback
      if (process.env.NODE_ENV !== 'production' && primaryUri && primaryUri.includes('mongodb.net')) {
        console.warn(`⚠️ Warning: MongoDB Atlas connection failed (${primaryError.message}).`);
        console.warn(`👉 To use Atlas, whitelist your current IP address (or 0.0.0.0/0) in MongoDB Atlas Network Access.`);
        console.log(`🔄 Attempting local MongoDB connection fallback at ${fallbackUri}...`);
        try {
          const fallbackConn = await mongoose.connect(fallbackUri, {
            ...opts,
            serverSelectionTimeoutMS: 3000,
          });
          console.log(`✅ Local MongoDB Connected Successfully: ${fallbackConn.connection.host}`);
          return fallbackConn;
        } catch (localError) {
          console.error(`❌ Local MongoDB fallback also unavailable: ${localError.message}`);
          throw primaryError;
        }
      }
      throw primaryError;
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


