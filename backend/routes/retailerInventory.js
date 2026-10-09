import express from 'express';
import {
  getMyRetailerInventory,
  addRetailerInventoryItem,
  adjustRetailerInventoryItem,
  recordRetailSale,
  getRetailSalesHistory,
} from '../controllers/retailerInventoryController.js';
import { protect, restrictTo } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);
router.use(restrictTo('retailer'));

router.get('/', getMyRetailerInventory);
router.post('/', addRetailerInventoryItem);
router.put('/:id/adjust', adjustRetailerInventoryItem);
router.post('/sales', recordRetailSale);
router.get('/sales', getRetailSalesHistory);

export default router;
