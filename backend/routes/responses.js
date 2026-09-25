import express from 'express';
import { createResponse, getResponsesForRequest, acceptResponse } from '../controllers/responseController.js';
import { protect, restrictTo } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

router.post('/:requestId', restrictTo('wholesaler'), createResponse);
router.get('/request/:requestId', getResponsesForRequest);
router.post('/:id/accept', restrictTo('retailer'), acceptResponse);

export default router;
