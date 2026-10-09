import express from 'express';
import {
  getGroupBuys,
  createGroupBuy,
  joinGroupBuy,
  withdrawFromGroupBuy,
  submitGroupBuyBulkOffer,
  awardGroupBuyOffer,
} from '../controllers/groupBuyController.js';
import { protect, restrictTo } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

router.get('/', getGroupBuys);
router.post('/', restrictTo('retailer'), createGroupBuy);
router.post('/:id/join', restrictTo('retailer'), joinGroupBuy);
router.post('/:id/withdraw', restrictTo('retailer'), withdrawFromGroupBuy);
router.post('/:id/offer', restrictTo('wholesaler'), submitGroupBuyBulkOffer);
router.post('/:id/award/:offerId', restrictTo('retailer'), awardGroupBuyOffer);

export default router;
