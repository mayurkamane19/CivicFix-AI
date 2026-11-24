import { Router } from 'express';
import {
  submitComplaint,
  trackComplaint,
  analyzeComplaint,
  checkDuplicates,
  getPublicMap,
  getCitizenDashboard,
  getMyCitizensComplaints,
  getMyCitizenComplaintDetails
} from '../controllers/complaintController.js';
import {
  getResolutionEvidenceController,
  verifyResolutionController,
  rejectResolutionController
} from '../controllers/resolutionController.js';
import { handleImageUpload, handleEvidenceUpload } from '../middleware/uploadMiddleware.js';
import { protect, optionalProtect } from '../middleware/authMiddleware.js';

const router = Router();

// Public complaint map markers with location approximation (GET /api/complaints/map)
router.get('/map', getPublicMap);

// Citizen dashboard and my-complaints routes (MUST come before /:complaintId wildcard)
router.get('/my/dashboard', protect, getCitizenDashboard);
router.get('/my/complaints', protect, getMyCitizensComplaints);
router.get('/my/:complaintId', protect, getMyCitizenComplaintDetails);

// Public complaint submission (supports optional auth, JSON and multipart/form-data with optional 'image')
router.post('/', optionalProtect, handleImageUpload, submitComplaint);

// Public complaint tracking
router.get('/track/:complaintId', trackComplaint);

// Citizen Resolution Verification endpoints (Authenticated & Anti-IDOR protected)
router.get('/:complaintId/resolution', protect, getResolutionEvidenceController);
router.post('/:complaintId/resolution/verify', protect, verifyResolutionController);
router.post('/:complaintId/resolution/reject', protect, handleEvidenceUpload, rejectResolutionController);

// Dedicated AI analysis trigger / re-fetch
router.post('/:complaintId/analyze', analyzeComplaint);

// Dedicated duplicate complaint check trigger / re-fetch
router.post('/:complaintId/check-duplicates', checkDuplicates);

export default router;
