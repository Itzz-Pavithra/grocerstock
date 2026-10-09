import express from 'express';
import {
  getStockoutPredictions,
  getRetailerProfitability,
  getWholesalerProfitability,
} from '../controllers/analyticsController.js';
import { protect, restrictTo } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

// Feature 1: Lead-Time-Aware Stockout Predictions
router.get('/stockout-predictions', restrictTo('retailer'), getStockoutPredictions);

// Part 5.A: Retailer Profitability Dashboard
router.get('/retailer-profitability', restrictTo('retailer'), getRetailerProfitability);

// Part 5.B: Wholesaler Profitability Dashboard
router.get('/wholesaler-profitability', restrictTo('wholesaler'), getWholesalerProfitability);

export default router;
