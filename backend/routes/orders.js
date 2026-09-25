import express from 'express';
import { getMyOrders, updateOrderStatus } from '../controllers/orderController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

router.get('/', getMyOrders);
router.put('/:id/status', updateOrderStatus);

export default router;
