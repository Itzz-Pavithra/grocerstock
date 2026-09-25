import express from 'express';
import { getMyOrders, updateOrderStatus, getOrderTracking } from '../controllers/orderController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

router.get('/', getMyOrders);
router.get('/:id/tracking', getOrderTracking);
router.put('/:id/status', updateOrderStatus);

export default router;

