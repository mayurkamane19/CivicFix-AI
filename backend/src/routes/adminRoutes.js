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

// Enforce JWT authentication across all administrative endpoints
router.use(protect);

// Municipal Analytics & Complaints (Data scoped by role: admin, ward_admin, department_head)
router.get('/dashboard/stats', authorize('admin', 'ward_admin', 'department_head'), getStats);
router.get('/complaints', authorize('admin', 'ward_admin', 'department_head'), getComplaints);
router.get('/map/complaints', authorize('admin', 'ward_admin', 'department_head'), getAdminMap);
router.get('/complaints/:complaintId', authorize('admin', 'ward_admin', 'department_head'), getComplaintById);
router.get('/complaints/:complaintId/history', authorize('admin', 'ward_admin', 'department_head'), getHistory);
router.patch('/complaints/:complaintId/status', authorize('admin'), updateStatus);

// Department Management Endpoints
router.get('/departments', authorize('admin', 'ward_admin', 'department_head'), getDepartments);
router.post('/departments', authorize('admin'), createDepartmentController);
router.patch('/departments/:departmentId', authorize('admin'), updateDepartmentController);

// Field Officers Management Endpoint
router.get('/officers', authorize('admin', 'ward_admin', 'department_head'), getOfficers);

// Complaint Assignment & Assignment History Endpoints
router.patch('/complaints/:complaintId/assignment', authorize('admin', 'department_head'), assignComplaintController);
router.get('/complaints/:complaintId/assignment-history', authorize('admin', 'ward_admin', 'department_head'), getAssignmentHistoryController);

// Restrict all other management & analytics endpoints to municipal admin
router.use(authorize('admin'));

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
