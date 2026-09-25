import express from 'express';
import { getCategories, getProducts } from '../controllers/adminController.js';
import { getPriceHistory } from '../controllers/priceHistoryController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

router.get('/categories', getCategories);
router.get('/products', getProducts);
router.get('/price-history', getPriceHistory);

export default router;

