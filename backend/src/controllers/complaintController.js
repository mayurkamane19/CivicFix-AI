import {
  createComplaint,
  getComplaintByTrackId,
  analyzeComplaintById,
  checkDuplicatesById
} from '../services/complaintService.js';
import { getPublicMapComplaints } from '../services/mapService.js';
import { successResponse, errorResponse } from '../utils/apiResponse.js';
import { Complaint } from '../models/Complaint.js';

/**
 * Controller to handle new complaint submission
 * POST /api/complaints
 */
export const submitComplaint = async (req, res, next) => {
  try {
    const {
      title,
      description,
      category,
      address,
      latitude,
      longitude,
      imageUrl,
      citizenEmail,
      emailNotificationsEnabled
    } = req.body;

    const authenticatedUser = req.user || null;
    const finalCitizenEmail = citizenEmail || (authenticatedUser ? authenticatedUser.email : null);
    const finalConsent = emailNotificationsEnabled === true ||
      emailNotificationsEnabled === 'true' ||
      (authenticatedUser && authenticatedUser.emailNotificationsEnabled === true && emailNotificationsEnabled !== false && emailNotificationsEnabled !== 'false');

    const result = await createComplaint({
      title,
      description,
      category,
      address,
      latitude,
      longitude,
      file: req.file,
      imageUrl,
      citizenEmail: finalCitizenEmail,
      emailNotificationsEnabled: finalConsent,
      reportedBy: authenticatedUser?._id || null
    });

    return res.status(201).json({
      success: true,
      message: 'Complaint submitted successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller to handle public complaint tracking
 * GET /api/complaints/track/:complaintId
 */
export const trackComplaint = async (req, res, next) => {
  try {
    const { complaintId } = req.params;

    const result = await getComplaintByTrackId(complaintId);

    return res.status(200).json({
      success: true,
      message: 'Complaint details retrieved successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller to trigger or retrieve AI analysis for a complaint
 * POST /api/complaints/:complaintId/analyze
 */
export const analyzeComplaint = async (req, res, next) => {
  try {
    const { complaintId } = req.params;
    const { force } = req.body || {};

    const result = await analyzeComplaintById(complaintId, { force: Boolean(force) });

    return res.status(200).json({
      success: true,
      message: result.message,
      cached: Boolean(result.cached),
      data: result.data
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller to trigger or retrieve duplicate detection for a complaint
 * POST /api/complaints/:complaintId/check-duplicates
 */
export const checkDuplicates = async (req, res, next) => {
  try {
    const { complaintId } = req.params;
    const { force } = req.body || {};

    const result = await checkDuplicatesById(complaintId, { force: Boolean(force) });

    return res.status(200).json({
      success: true,
      message: result.message,
      cached: Boolean(result.cached),
      data: result.data
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller to retrieve public-safe complaint markers with location approximation
 * GET /api/complaints/map
 */
export const getPublicMap = async (req, res, next) => {
  try {
    const { category, status, limit } = req.query;
    const mapData = await getPublicMapComplaints({ category, status, limit });

    return successResponse(res, 200, 'Public complaint map markers retrieved successfully', {
      complaints: mapData,
      total: mapData.length
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Citizen Dashboard Stats
 * GET /api/complaints/my/dashboard
 * Returns aggregated stats for the authenticated citizen's own complaints.
 */
export const getCitizenDashboard = async (req, res, next) => {
  try {
    const userId = req.user._id;

    // Fetch all complaints belonging to this citizen
    const complaints = await Complaint.find({ reportedBy: userId })
      .select('_id complaintId title category status resolutionEvidence updatedAt createdAt')
      .lean();

    const total = complaints.length;
    let pending = 0;
    let inProgress = 0;
    let awaitingVerification = 0;
    let resolved = 0;
    let reopened = 0;

    for (const c of complaints) {
      const st = c.status;
      const evStatus = c.resolutionEvidence?.status || 'Not Submitted';

      if (st === 'Pending') pending++;
      else if (st === 'In Progress' || st === 'Assigned') inProgress++;
      else if (st === 'Resolved') resolved++;
      else if (st === 'Reopened') reopened++;

      if (evStatus === 'Submitted by Officer' || evStatus === 'Awaiting Citizen Verification') awaitingVerification++;
      if (evStatus === 'Contested by Citizen' && st !== 'Reopened') reopened++;
    }

    // Last 5 by updatedAt desc
    const recentActivity = [...complaints]
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      .slice(0, 5)
      .map(c => ({
        _id: c._id,
        complaintId: c.complaintId,
        title: c.title,
        category: c.category,
        status: c.status,
        updatedAt: c.updatedAt,
        createdAt: c.createdAt
      }));

    return successResponse(res, 200, 'Citizen dashboard data retrieved successfully', {
      data: {
        total,
        pending,
        inProgress,
        awaitingVerification,
        resolved,
        reopened,
        recentActivity
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Citizen My Complaints List (paginated, filtered)
 * GET /api/complaints/my/complaints
 */
export const getMyCitizensComplaints = async (req, res, next) => {
  try {
    const userId = req.user._id;

    // Build filter — always locked to authenticated user (anti-IDOR)
    const filter = { reportedBy: userId };

    if (req.query.status) {
      filter.status = req.query.status;
    }

    if (req.query.category) {
      filter.category = req.query.category;
    }

    if (req.query.search) {
      const regex = new RegExp(req.query.search, 'i');
      filter.$or = [{ title: regex }, { description: regex }];
    }

    // Pagination
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
    const skip = (page - 1) * limit;

    // Sort
    let sortOption = { createdAt: -1 }; // newest by default
    if (req.query.sort === 'oldest') sortOption = { createdAt: 1 };
    else if (req.query.sort === 'updated') sortOption = { updatedAt: -1 };

    const [complaints, total] = await Promise.all([
      Complaint.find(filter)
        .select('_id complaintId title description category status location imageUrl createdAt updatedAt')
        .sort(sortOption)
        .skip(skip)
        .limit(limit)
        .lean(),
      Complaint.countDocuments(filter)
    ]);

    const pages = Math.ceil(total / limit);

    // Map to safe citizen-facing shape (truncate description, exclude internals)
    const data = complaints.map(c => ({
      _id: c._id,
      complaintId: c.complaintId,
      title: c.title,
      description: c.description ? c.description.substring(0, 200) : '',
      category: c.category,
      status: c.status,
      address: c.location?.address || '',
      imageUrl: c.imageUrl || '',
      createdAt: c.createdAt,
      updatedAt: c.updatedAt
    }));

    return successResponse(res, 200, 'Citizen complaints retrieved successfully', {
      data,
      pagination: { total, page, pages, limit }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Citizen Complaint Details (anti-IDOR ownership enforced)
 * GET /api/complaints/my/:complaintId
 */
export const getMyCitizenComplaintDetails = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { complaintId } = req.params;

    const complaint = await Complaint.findOne({ complaintId })
      .select('-assignedOfficer -assignedBy -assignmentHistory -imagePublicId -citizenEmail -emailNotificationsEnabled -aiAnalysis.errorMessage -duplicateCheck -imageAnalysis')
      .lean();

    if (!complaint) {
      return errorResponse(res, 404, 'Complaint not found');
    }

    // Anti-IDOR: Ensure the complaint belongs to the authenticated citizen
    if (!complaint.reportedBy || complaint.reportedBy.toString() !== userId.toString()) {
      return errorResponse(res, 403, 'Access denied. This complaint does not belong to your account.');
    }

    // Build citizen-safe response
    const safeData = {
      _id: complaint._id,
      complaintId: complaint.complaintId,
      title: complaint.title,
      description: complaint.description || '',
      category: complaint.category,
      status: complaint.status,
      address: complaint.location?.address || '',
      latitude: complaint.location?.latitude ?? null,
      longitude: complaint.location?.longitude ?? null,
      imageUrl: complaint.imageUrl || '',
      // AI Analysis — citizen-safe fields only (no internal errorMessage)
      aiAnalysis: complaint.aiAnalysis ? {
        status: complaint.aiAnalysis.status || 'Pending',
        suggestedCategory: complaint.aiAnalysis.suggestedCategory || null,
        severity: complaint.aiAnalysis.severity || null,
        summary: complaint.aiAnalysis.summary || '',
        suggestedAction: complaint.aiAnalysis.suggestedAction || '',
        analyzedAt: complaint.aiAnalysis.analyzedAt || null
      } : null,
      // SLA — citizen-safe fields only (no escalation internals)
      sla: complaint.sla ? {
        deadline: complaint.sla.deadline || null,
        remainingHours: complaint.sla.remainingHours !== null && complaint.sla.remainingHours !== undefined
          ? Math.round(complaint.sla.remainingHours * 10) / 10
          : null,
        breached: complaint.sla.status === 'Overdue' || complaint.sla.status === 'Resolved After SLA',
        citizenSafeStatus: complaint.sla.citizenSafeStatus || 'Within standard resolution window',
        priority: complaint.sla.priority || 'Medium'
      } : null,
      // Status history — no internal officer references
      statusHistory: (complaint.statusHistory || []).map(h => ({
        previousStatus: h.previousStatus,
        newStatus: h.newStatus,
        changedByName: h.changedByName || 'Municipal Administrator',
        note: h.note || '',
        changedAt: h.changedAt
      })),
      // Resolution evidence — full citizen-visible info
      resolutionEvidence: complaint.resolutionEvidence ? {
        status: complaint.resolutionEvidence.status || 'Not Submitted',
        remarks: complaint.resolutionEvidence.remarks || '',
        beforeImages: (complaint.resolutionEvidence.beforeImages || []).map(img => ({
          url: img.url,
          caption: img.caption || '',
          uploadedAt: img.uploadedAt
        })),
        afterImages: (complaint.resolutionEvidence.afterImages || []).map(img => ({
          url: img.url,
          caption: img.caption || '',
          uploadedAt: img.uploadedAt
        })),
        submittedAt: complaint.resolutionEvidence.submittedAt || null,
        submittedByName: complaint.resolutionEvidence.submittedByName || (complaint.assignedOfficerName || 'Field Officer'),
        citizenVerification: complaint.resolutionEvidence.citizenVerification ? {
          verifiedAt: complaint.resolutionEvidence.citizenVerification.verifiedAt || null,
          rejectedAt: complaint.resolutionEvidence.citizenVerification.rejectedAt || null,
          rejectionReason: complaint.resolutionEvidence.citizenVerification.rejectionReason || '',
          rejectionEvidence: (complaint.resolutionEvidence.citizenVerification.rejectionEvidence || []).map(r => ({
            url: r.url,
            uploadedAt: r.uploadedAt
          }))
        } : null,
        reopenCount: complaint.resolutionEvidence.reopenCount || 0,
        maxReopenLimit: complaint.resolutionEvidence.maxReopenLimit || 3,
        reopeningHistory: (complaint.resolutionEvidence.reopeningHistory || []).map(rh => ({
          reopenedAt: rh.reopenedAt,
          reason: rh.reason,
          evidenceImages: (rh.evidenceImages || []).map(img => ({ url: img.url })),
          previousStatus: rh.previousStatus
        }))
      } : null,
      // Department: name only
      department: complaint.assignedDepartmentName || null,
      createdAt: complaint.createdAt,
      updatedAt: complaint.updatedAt
    };

    return successResponse(res, 200, 'Complaint details retrieved successfully', { data: safeData });
  } catch (error) {
    next(error);
  }
};

export default {
  submitComplaint,
  trackComplaint,
  analyzeComplaint,
  checkDuplicates,
  getPublicMap,
  getCitizenDashboard,
  getMyCitizensComplaints,
  getMyCitizenComplaintDetails
};
