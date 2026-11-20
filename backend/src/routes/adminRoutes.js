import { Router } from 'express';
import {
  getStats,
  getComplaints,
  getComplaintById,
  getHistory,
  updateStatus,
  getDepartments,
  createDepartmentController,
  updateDepartmentController,
  getOfficers,
  assignComplaintController,
  getAssignmentHistoryController,
  getAdminMap
} from '../controllers/adminController.js';
import { getAdminNotifications } from '../controllers/notificationController.js';
import {
  getOverviewController,
  getTrendsController,
  getCategoriesController,
  getDepartmentsController,
  getOfficersController,
  getResolutionController,
  getSeverityController,
  getGeographyController,
  exportCsvController
} from '../controllers/analyticsController.js';
import {
  getAdminFeedbackList,
  getAdminFeedbackStats
} from '../controllers/adminFeedbackController.js';
import {
  getAdminSlaConfig,
  updateAdminSlaConfig,
  getAdminSlaOverview,
  getAdminOverdueComplaints,
  getAdminEscalationLogs,
  getComplaintEscalationHistory,
  manualEscalateController,
  triggerSlaEvaluation
} from '../controllers/slaController.js';
import {
  getAdminResolutionsController,
  getAdminResolutionStatsController,
  getResolutionEvidenceController,
  reviewResolutionController,
  getOfficerPerformanceAnalyticsController
} from '../controllers/resolutionController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = Router();

// Enforce JWT authentication and strict admin role authorization across all endpoints
router.use(protect);
router.use(authorize('admin'));

// Municipal Analytics & Complaints
router.get('/dashboard/stats', getStats);
router.get('/complaints', getComplaints);
router.get('/map/complaints', getAdminMap);
router.get('/complaints/:complaintId', getComplaintById);
router.get('/complaints/:complaintId/history', getHistory);
router.patch('/complaints/:complaintId/status', updateStatus);

// Department Management Endpoints
router.get('/departments', getDepartments);
router.post('/departments', createDepartmentController);
router.patch('/departments/:departmentId', updateDepartmentController);

// Field Officers Management Endpoint
router.get('/officers', getOfficers);

// Complaint Assignment & Assignment History Endpoints
router.patch('/complaints/:complaintId/assignment', assignComplaintController);
router.get('/complaints/:complaintId/assignment-history', getAssignmentHistoryController);

// Notification Logs Monitoring (Admin Only)
router.get('/notifications', getAdminNotifications);

// Advanced Municipal Analytics Endpoints (Admin Only)
router.get('/analytics/overview', getOverviewController);
router.get('/analytics/trends', getTrendsController);
router.get('/analytics/categories', getCategoriesController);
router.get('/analytics/departments', getDepartmentsController);
router.get('/analytics/officers', getOfficersController);
router.get('/analytics/resolution', getResolutionController);
router.get('/analytics/severity', getSeverityController);
router.get('/analytics/geography', getGeographyController);
router.get('/analytics/export', exportCsvController);

// Citizen Feedback Management & Analytics Endpoints (Admin Only)
router.get('/feedback/stats', getAdminFeedbackStats);
router.get('/feedback', getAdminFeedbackList);

// SLA Configuration & Monitoring Endpoints (Admin Only)
router.get('/sla/config', getAdminSlaConfig);
router.put('/sla/config', updateAdminSlaConfig);
router.get('/sla/overview', getAdminSlaOverview);
router.get('/sla/overdue', getAdminOverdueComplaints);
router.post('/sla/evaluate', triggerSlaEvaluation);

// Multi-Level Escalation Management Endpoints (Admin Only)
router.get('/escalations', getAdminEscalationLogs);
router.get('/escalations/:complaintId', getComplaintEscalationHistory);
router.post('/escalations/:complaintId/manual', manualEscalateController);

// Resolution Verification & Administrative Dispute Reviews (Admin Only)
router.get('/resolutions/stats', getAdminResolutionStatsController);
router.get('/resolutions', getAdminResolutionsController);
router.get('/resolutions/:complaintId', getResolutionEvidenceController);
router.post('/resolutions/:complaintId/review', reviewResolutionController);
router.get('/analytics/officers/performance', getOfficerPerformanceAnalyticsController);

export default router;
