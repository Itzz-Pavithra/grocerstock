import express from 'express';
import { createRequest, getRequests, getRequestById, deleteRequest } from '../controllers/requestController.js';
import { protect, restrictTo } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

router.post('/', restrictTo('retailer'), createRequest);
router.get('/', getRequests);
router.get('/:id', getRequestById);
router.delete('/:id', restrictTo('retailer'), deleteRequest);

export default router;
