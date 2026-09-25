import express from 'express';
import { getMyInventory, addInventoryItem, updateInventoryItem, deleteInventoryItem } from '../controllers/inventoryController.js';
import { protect, wholesalerOnly } from '../middleware/auth.js';

const router = express.Router();

router.use(protect, wholesalerOnly);

router.get('/', getMyInventory);
router.post('/', addInventoryItem);
router.put('/:id', updateInventoryItem);
router.delete('/:id', deleteInventoryItem);

export default router;
