import express from 'express';
import { createRequest, getRequests, getRequestById } from '../controllers/requestController.js';
import { protect, restrictTo } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

router.post('/', restrictTo('retailer'), createRequest);
router.get('/', getRequests);
router.get('/:id', getRequestById);

export default router;
