import { Router } from 'express';
import {
  getStats,
  getComplaints,
  getComplaintById,
  updateStatus,
  getOfficerMap
} from '../controllers/officerController.js';
import { getOfficerOverviewController } from '../controllers/analyticsController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = Router();

// Enforce JWT authentication and strict officer role authorization across all endpoints
router.use(protect);
router.use(authorize('officer'));

// GET /api/officer/dashboard/stats
router.get('/dashboard/stats', getStats);

// GET /api/officer/complaints
router.get('/complaints', getComplaints);

// GET /api/officer/map/complaints
router.get('/map/complaints', getOfficerMap);

// GET /api/officer/complaints/:complaintId
router.get('/complaints/:complaintId', getComplaintById);

// PATCH /api/officer/complaints/:complaintId/status
router.patch('/complaints/:complaintId/status', updateStatus);

// GET /api/officer/analytics/overview (Strictly scoped to authenticated officer)
router.get('/analytics/overview', getOfficerOverviewController);

export default router;
