import express from 'express';
import {
  createResponse,
  getResponsesForRequest,
  getMyResponses,
  acceptResponse,
  getRecommendationsForRequest,
  getProcurementOptimizer,
} from '../controllers/responseController.js';
import { protect, restrictTo } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

// Wholesaler submits quotation
router.post('/:requestId', restrictTo('wholesaler'), createResponse);
router.post('/request/:requestId', restrictTo('wholesaler'), createResponse);

// Wholesaler views their own submitted quotations
router.get('/my-quotations', restrictTo('wholesaler'), getMyResponses);

// Get all quotations for a request
router.get('/request/:requestId', getResponsesForRequest);

// Feature 2: Price-Versus-Distance Recommendations
router.get('/request/:requestId/recommendations', getRecommendationsForRequest);

// Feature 3: Smart Procurement Optimizer
router.get('/request/:requestId/optimizer', getProcurementOptimizer);

// Retailer accepts quotation
router.post('/:id/accept', restrictTo('retailer'), acceptResponse);
router.put('/:id/accept', restrictTo('retailer'), acceptResponse);

export default router;
