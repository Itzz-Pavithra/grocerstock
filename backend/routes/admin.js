import express from 'express';
import {
  getStats,
  getUsers,
  toggleUserStatus,
  getBusinessVerifications,
  approveBusinessVerification,
  rejectBusinessVerification,
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getAdminOrders,
  getAdminDisputes,
  createOrderDispute,
  resolveOrderDispute,
  getSystemSettings,
  getAuditLogs,
  purgeDemoInventory,
} from '../controllers/adminController.js';
import { protect, restrictTo } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);
router.use(restrictTo('admin'));

// MODULE 1: Platform Overview Stats
router.get('/stats', getStats);

// MODULE 3: User Management
router.get('/users', getUsers);
router.put('/users/:id/status', toggleUserStatus);

// MODULE 2: Business Verification Workflow
router.get('/verifications', getBusinessVerifications);
router.put('/verifications/:id/approve', approveBusinessVerification);
router.put('/verifications/:id/reject', rejectBusinessVerification);

// MODULE 4: Category Management
router.get('/categories', getCategories);
router.post('/categories', createCategory);
router.put('/categories/:id', updateCategory);
router.delete('/categories/:id', deleteCategory);

// MODULE 6: Orders & Disputes Monitoring
router.get('/orders', getAdminOrders);
router.get('/disputes', getAdminDisputes);
router.post('/orders/:orderId/dispute', createOrderDispute);
router.put('/disputes/:id/resolve', resolveOrderDispute);

// MODULE 5: Verified System Settings & Health Checks
router.get('/settings', getSystemSettings);

// MODULE 7: Administrative Audit Logs
router.get('/audit-logs', getAuditLogs);

// ADMIN UTILITY: Purge seeded demo inventory from database
router.delete('/purge-demo-inventory', purgeDemoInventory);

export default router;
