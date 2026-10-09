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
import retailerInventoryRoutes from './routes/retailerInventory.js';
import groupBuyRoutes from './routes/groupBuy.js';
import analyticsRoutes from './routes/analytics.js';
import { validateSecurityConfigAtStartup } from './config/security.js';

// Validate JWT Secret & Security parameters at startup
validateSecurityConfigAtStartup();

const app = express();

// Parse frontend URLs from environment (supporting comma-separated list)
const envFrontendUrls = (process.env.FRONTEND_URL || '')
  .split(',')
  .map((u) => u.trim())
  .filter(Boolean);

const allowedOrigins = [
  ...envFrontendUrls,
  'https://grocerstock.vercel.app',
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

      // Check if origin is explicitly in allowed list (strict, no arbitrary wildcard preview domains)
      const isAllowed = allowedOrigins.includes(origin) || origin.includes('localhost');

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
app.use('/api/retailer-inventory', retailerInventoryRoutes);
app.use('/api/group-buy', groupBuyRoutes);
app.use('/api/group-buys', groupBuyRoutes);
app.use('/api/analytics', analyticsRoutes);
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

// 404 handler for unknown API routes
app.use('/api', (req, res) => {
  res.status(404).json({ success: false, message: `API endpoint not found: ${req.method} ${req.originalUrl}` });
});

// Centralized Error Handling Middleware
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
