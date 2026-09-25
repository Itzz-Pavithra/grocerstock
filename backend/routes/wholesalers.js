import express from 'express';
import {
  getWholesalerPerformance,
  getMyPerformance,
  getNearbyWholesalers,
} from '../controllers/wholesalerController.js';
import { protect, wholesalerOnly } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

// Wholesaler self-performance scorecard
router.get('/my-performance', wholesalerOnly, getMyPerformance);

// Supplier map discovery for retailers & admins
router.get('/nearby', getNearbyWholesalers);

// Wholesaler performance scorecard by ID
router.get('/:id/performance', getWholesalerPerformance);

export default router;
