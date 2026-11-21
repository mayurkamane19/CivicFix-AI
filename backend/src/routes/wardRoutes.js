import { Router } from 'express';
import {
  createWardController,
  getWardsController,
  getMunicipalOverviewController,
  exportMunicipalWardCsvController,
  getWardDetailsController,
  updateWardController,
  toggleWardStatusController,
  deleteWardController,
  getWardOfficersController,
  assignOfficersController,
  removeOfficerController,
  assignDepartmentsController,
  transferComplaintController,
  getWardAnalyticsController
} from '../controllers/wardController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = Router();

// 1. All ward management routes require valid JWT authentication
router.use(protect);

// 2. Specific routes (declared PRIOR to wildcard /:id to prevent route collision)
router.get('/overview', authorize('admin', 'ward_admin'), getMunicipalOverviewController);
router.get('/analytics/export', authorize('admin'), exportMunicipalWardCsvController);
router.post('/complaints/:complaintId/transfer', authorize('admin'), transferComplaintController);

// 3. Collection routes
router.route('/')
  .get(authorize('admin', 'ward_admin', 'officer'), getWardsController)
  .post(authorize('admin'), createWardController);

// 4. Parameterized routes by Ward ID
router.route('/:id')
  .get(authorize('admin', 'ward_admin', 'officer'), getWardDetailsController)
  .put(authorize('admin'), updateWardController)
  .delete(authorize('admin'), deleteWardController);

router.patch('/:id/status', authorize('admin'), toggleWardStatusController);
router.get('/:id/analytics', authorize('admin', 'ward_admin'), getWardAnalyticsController);

// 5. Officer & Department Assignments
router.route('/:id/officers')
  .get(authorize('admin', 'ward_admin'), getWardOfficersController)
  .post(authorize('admin'), assignOfficersController);

router.delete('/:id/officers/:officerId', authorize('admin'), removeOfficerController);
router.post('/:id/departments', authorize('admin'), assignDepartmentsController);

export default router;
