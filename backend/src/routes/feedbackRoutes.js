import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import {
  submitComplaintFeedback,
  getComplaintFeedback,
  getMyFeedback
} from '../controllers/feedbackController.js';

const router = express.Router();

// Apply JWT authentication guard to all feedback routes
router.use(protect);

/**
 * @route   GET /api/feedback/my
 * @desc    Retrieve historical feedback submitted by authenticated citizen
 * @access  Protected (Authenticated Citizen)
 */
router.get('/my', getMyFeedback);

/**
 * @route   POST /api/feedback/:complaintId
 * @desc    Submit rating and optional comment for a resolved complaint
 * @access  Protected (Verified Complaint Owner Only)
 */
router.post('/:complaintId', submitComplaintFeedback);

/**
 * @route   GET /api/feedback/complaint/:complaintId
 * @desc    Retrieve feedback record for a specific complaint
 * @access  Protected (Complaint Owner or Municipal Administrator)
 */
router.get('/complaint/:complaintId', getComplaintFeedback);

export default router;
