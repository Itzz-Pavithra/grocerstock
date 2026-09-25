import express from 'express';
import {
  getMyInventory,
  addInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  getInventoryPredictions,
  getRetailerReorderRecommendations,
} from '../controllers/inventoryController.js';
import { protect, wholesalerOnly, restrictTo } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

// Wholesaler stock predictions
router.get('/predictions', wholesalerOnly, getInventoryPredictions);

// Retailer procurement reorder recommendations
router.get('/retailer-recommendations', restrictTo('retailer'), getRetailerReorderRecommendations);

// Core wholesaler inventory management
router.get('/', wholesalerOnly, getMyInventory);
router.post('/', wholesalerOnly, addInventoryItem);
router.put('/:id', wholesalerOnly, updateInventoryItem);
router.delete('/:id', wholesalerOnly, deleteInventoryItem);

export default router;

