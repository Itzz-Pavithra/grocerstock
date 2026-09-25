import express from 'express';
import {
  getStats,
  getUsers,
  toggleUserStatus,
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct
} from '../controllers/adminController.js';
import { protect, restrictTo } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);
router.use(restrictTo('admin'));

router.get('/stats', getStats);
router.get('/users', getUsers);
router.put('/users/:id/status', toggleUserStatus);

router.get('/categories', getCategories);
router.post('/categories', createCategory);
router.put('/categories/:id', updateCategory);
router.delete('/categories/:id', deleteCategory);

router.get('/products', getProducts);
router.post('/products', createProduct);
router.put('/products/:id', updateProduct);
router.delete('/products/:id', deleteProduct);

export default router;
