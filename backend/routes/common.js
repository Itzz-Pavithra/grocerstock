import express from 'express';
import { getCategories, getProducts } from '../controllers/adminController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

router.get('/categories', getCategories);
router.get('/products', getProducts);

export default router;
