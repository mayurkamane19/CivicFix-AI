import { Router } from 'express';
import {
  submitComplaint,
  trackComplaint,
  analyzeComplaint,
  checkDuplicates,
  getPublicMap
} from '../controllers/complaintController.js';
import { handleImageUpload } from '../middleware/uploadMiddleware.js';

const router = Router();

// Public complaint map markers with location approximation (GET /api/complaints/map)
router.get('/map', getPublicMap);

// Public complaint submission (supports JSON and multipart/form-data with optional 'image')
router.post('/', handleImageUpload, submitComplaint);

// Public complaint tracking
router.get('/track/:complaintId', trackComplaint);

// Dedicated AI analysis trigger / re-fetch
router.post('/:complaintId/analyze', analyzeComplaint);

// Dedicated duplicate complaint check trigger / re-fetch
router.post('/:complaintId/check-duplicates', checkDuplicates);

export default router;
