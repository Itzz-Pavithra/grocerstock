import connectDB from '../backend/config/db.js';
import app from '../backend/app.js';

export default async function handler(req, res) {
  try {
    await connectDB();
  } catch (err) {
    console.error('Failed to establish MongoDB connection in Vercel serverless function:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to connect to database service. Please verify MONGODB_URI in Vercel environment variables.',
      error: process.env.NODE_ENV === 'production' ? null : err.message,
    });
  }

  return app(req, res);
}
