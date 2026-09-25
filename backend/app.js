import express from 'express';
import cors from 'cors';

import authRoutes from './routes/auth.js';
import requestRoutes from './routes/requests.js';
import responseRoutes from './routes/responses.js';
import notificationRoutes from './routes/notifications.js';
import adminRoutes from './routes/admin.js';
import commonRoutes from './routes/common.js';
import orderRoutes from './routes/orders.js';
import inventoryRoutes from './routes/inventory.js';
import wholesalerRoutes from './routes/wholesalers.js';
import locationRoutes from './routes/location.js';

const app = express();

// Parse frontend URLs from environment (supporting comma-separated list)
const envFrontendUrls = (process.env.FRONTEND_URL || '')
  .split(',')
  .map((u) => u.trim())
  .filter(Boolean);

const allowedOrigins = [
  ...envFrontendUrls,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://localhost:3000',
];

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (e.g. mobile apps, curl, same-origin serverless)
      if (!origin) return callback(null, true);

      // Check if origin is explicitly in allowed list or is a Vercel preview/production deployment
      const isAllowed =
        allowedOrigins.includes(origin) ||
        origin.endsWith('.vercel.app') ||
        origin.includes('localhost');

      if (isAllowed) {
        callback(null, true);
      } else {
        callback(new Error(`Origin '${origin}' not allowed by CORS policy`));
      }
    },
    credentials: true,
  })
);

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// API Route Mounts
app.use('/api/auth', authRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/responses', responseRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/wholesalers', wholesalerRoutes);
app.use('/api/location', locationRoutes);
app.use('/api/directions', locationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/common', commonRoutes);

// Health check endpoints
app.get('/api', (req, res) => {
  res.json({
    status: 'online',
    message: 'GrocerStock API is running',
    timestamp: new Date().toISOString(),
  });
});

app.get('/', (req, res) => {
  res.send('GrocerStock — Local Stock Grocery Management System API is running...');
});

// 404 handler for unknown API routes (prevents Express returning HTML for JSON APIs)
app.use('/api', (req, res) => {
  res.status(404).json({ success: false, message: `API endpoint not found: ${req.method} ${req.originalUrl}` });
});

// Centralized Error Handling Middleware (4 params required for Express error middleware)
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const statusCode = err.status || err.statusCode || (res.statusCode === 200 ? 500 : res.statusCode);
  console.error(`[Error] ${req.method} ${req.originalUrl}:`, err.message);
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal Server Error',
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  });
});

export default app;
