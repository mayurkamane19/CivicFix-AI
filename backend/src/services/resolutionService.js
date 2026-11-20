import mongoose from 'mongoose';
import { Complaint, RESOLUTION_VERIFICATION_STATUSES, ADMIN_REVIEW_STATUSES } from '../models/Complaint.js';
import { User } from '../models/User.js';
import { Department } from '../models/Department.js';
import { uploadMultipleImagesToCloudinary, deleteImageFromCloudinary } from './uploadService.js';
import { handleComplaintStatusChangeSla } from './slaService.js';
import {
  notifyResolutionSubmitted,
  notifyResolutionVerified,
  notifyResolutionRejected,
  notifyAdminReviewRequired
} from './notificationService.js';
import { getDatabaseStatus } from '../config/db.js';

/**
 * Ensures MongoDB is connected
 */
const assertDatabaseConnected = () => {
  if (getDatabaseStatus() !== 'connected') {
    const error = new Error('Database service is currently unavailable. Please verify MongoDB connection.');
    error.statusCode = 503;
    throw error;
  }
};

/**
 * Finds a complaint by either ObjectId or human-readable tracking ID (complaintId)
 * @param {string} identifier
 * @returns {Promise<Complaint>}
 */
export const findComplaintByIdOrTrackingId = async (identifier) => {
  if (!identifier) return null;
  const raw = String(identifier).trim();

  let complaint = null;
  if (mongoose.Types.ObjectId.isValid(raw)) {
    complaint = await Complaint.findById(raw)
      .populate('assignedDepartment', 'name code')
      .populate('assignedOfficer', 'name email badgeNumber phone role')
      .populate('reportedBy', 'name email phone');
  }

  if (!complaint) {
    complaint = await Complaint.findOne({ complaintId: raw })
      .populate('assignedDepartment', 'name code')
      .populate('assignedOfficer', 'name email badgeNumber phone role')
      .populate('reportedBy', 'name email phone');
  }

  return complaint;
};

/**
 * Computes urgency score and remaining SLA indicators for a complaint in officer workspace
 * @param {object} complaint
 * @returns {object}
 */
export const computeOfficerComplaintMetrics = (complaint) => {
  const now = new Date();
  const sla = complaint.sla || {};
  const deadline = sla.deadline ? new Date(sla.deadline) : null;

  let remainingHours = sla.remainingHours;
  let isOverdue = Boolean(sla.isOverdue);
  let overdueHours = sla.overdueHours || 0;

  if (complaint.status !== 'Resolved' && deadline) {
    if (now > deadline) {
      isOverdue = true;
      overdueHours = Math.round(((now.getTime() - deadline.getTime()) / 3600000) * 10) / 10;
      remainingHours = 0;
    } else {
      isOverdue = false;
      remainingHours = Math.max(0, Math.round(((deadline.getTime() - now.getTime()) / 3600000) * 10) / 10);
      overdueHours = 0;
    }
  }

  // Calculate urgency score: Higher = needs attention first
  // Critical = 40, High = 30, Medium = 20, Low = 10
  // Overdue adds 50 pts; remaining < 12h adds 30 pts; remaining < 24h adds 15 pts; reopened adds 25 pts
  let urgencyScore = 0;
  const p = (complaint.priority || 'Medium').toLowerCase();
  if (p === 'critical') urgencyScore += 40;
  else if (p === 'high') urgencyScore += 30;
  else if (p === 'low') urgencyScore += 10;
  else urgencyScore += 20;

  if (complaint.status === 'Reopened') urgencyScore += 25;
  if (isOverdue) urgencyScore += 50;
  else if (remainingHours <= 12) urgencyScore += 30;
  else if (remainingHours <= 24) urgencyScore += 15;

  return {
    remainingHours,
    isOverdue,
    overdueHours,
    urgencyScore,
    isUrgent: isOverdue || (remainingHours !== null && remainingHours <= 24)
  };
};

/**
 * Service: Retrieves officer workspace dashboard data including priority queue and performance metrics
 * @param {string|mongoose.Types.ObjectId} officerId
 * @param {object} options
 * @returns {Promise<object>}
 */
export const getOfficerWorkspace = async (officerId, {
  status = 'all',
  verificationStatus = 'all',
  slaStatus = 'all',
  priority = 'all',
  search = '',
  sortBy = 'urgency_desc',
  page = 1,
  limit = 20
} = {}) => {
  assertDatabaseConnected();

  if (!officerId) {
    const error = new Error('Officer ID is required');
    error.statusCode = 400;
    throw error;
  }

  const officerObjId = mongoose.Types.ObjectId.isValid(officerId)
    ? new mongoose.Types.ObjectId(officerId)
    : officerId;

  // 1. Gather all assigned complaints to compute overall workspace summary metrics
  const allAssigned = await Complaint.find({ assignedOfficer: officerObjId })
    .select('status priority sla resolutionEvidence createdAt updatedAt')
    .lean();

  const totalAssigned = allAssigned.length;
  let pendingCount = 0;
  let inProgressCount = 0;
  let resolvedCount = 0;
  let reopenedCount = 0;
  let awaitingVerificationCount = 0;
  let verifiedCount = 0;
  let rejectedCount = 0;
  let slaUrgentCount = 0;
  let slaBreachedCount = 0;
  let totalReopens = 0;

  for (const c of allAssigned) {
    if (c.status === 'Pending') pendingCount++;
    else if (c.status === 'In Progress') inProgressCount++;
    else if (c.status === 'Resolved') resolvedCount++;
    else if (c.status === 'Reopened') reopenedCount++;

    const vStatus = c.resolutionEvidence?.status || 'Not Submitted';
    if (vStatus === 'Awaiting Citizen Verification') awaitingVerificationCount++;
    else if (vStatus === 'Verified by Citizen') verifiedCount++;
    else if (vStatus === 'Rejected by Citizen' || vStatus === 'Reopened') rejectedCount++;

    const reopens = c.resolutionEvidence?.reopenCount || 0;
    totalReopens += reopens;

    const metrics = computeOfficerComplaintMetrics(c);
    if (c.status !== 'Resolved') {
      if (metrics.isOverdue) slaBreachedCount++;
      else if (metrics.isUrgent) slaUrgentCount++;
    }
  }

  const activeWorkload = pendingCount + inProgressCount + reopenedCount;
  const reopenRate = resolvedCount > 0 ? Math.round((reopenedCount / (resolvedCount + reopenedCount)) * 100) : 0;
  const verificationAccuracy = (verifiedCount + rejectedCount) > 0
    ? Math.round((verifiedCount / (verifiedCount + rejectedCount)) * 100)
    : 100;

  // 2. Build filtered query for the active list
  const query = { assignedOfficer: officerObjId };

  if (status && status !== 'all') {
    query.status = status;
  }

  if (verificationStatus && verificationStatus !== 'all') {
    query['resolutionEvidence.status'] = verificationStatus;
  }

  if (priority && priority !== 'all') {
    query.priority = priority;
  }

  if (search && search.trim()) {
    const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    query.$or = [
      { complaintId: { $regex: escaped, $options: 'i' } },
      { title: { $regex: escaped, $options: 'i' } },
      { 'location.address': { $regex: escaped, $options: 'i' } }
    ];
  }

  if (slaStatus === 'breached') {
    query.$or = [
      { 'sla.isOverdue': true },
      { 'sla.status': 'Overdue' }
    ];
  } else if (slaStatus === 'urgent') {
    query['sla.isOverdue'] = false;
    query['sla.remainingHours'] = { $lte: 24, $gt: 0 };
    query.status = { $ne: 'Resolved' };
  } else if (slaStatus === 'healthy') {
    query['sla.isOverdue'] = false;
    query['sla.remainingHours'] = { $gt: 24 };
  }

  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (safePage - 1) * safeLimit;

  // 3. Sorting logic
  let sortOption = { createdAt: -1 };
  if (sortBy === 'slaDeadline_asc') {
    sortOption = { 'sla.deadline': 1, createdAt: -1 };
  } else if (sortBy === 'priority_desc') {
    sortOption = { priority: 1, createdAt: -1 };
  } else if (sortBy === 'createdAt_desc') {
    sortOption = { createdAt: -1 };
  }

  const [rawComplaints, totalFiltered] = await Promise.all([
    Complaint.find(query)
      .populate('assignedDepartment', 'name code')
      .populate('reportedBy', 'name email phone')
      .sort(sortOption)
      .skip(skip)
      .limit(safeLimit)
      .lean(),
    Complaint.countDocuments(query)
  ]);

  // 4. Enrich complaints with calculated urgency metrics
  const complaints = rawComplaints.map((c) => {
    const metrics = computeOfficerComplaintMetrics(c);
    return {
      _id: c._id,
      id: c._id,
      complaintId: c.complaintId,
      title: c.title,
      description: c.description,
      category: c.category,
      priority: c.priority,
      status: c.status,
      assignedDepartment: c.assignedDepartment,
      location: c.location,
      imageUrl: c.imageUrl,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      sla: {
        ...c.sla,
        ...metrics
      },
      resolutionEvidence: c.resolutionEvidence || {
        status: 'Not Submitted',
        beforeImages: [],
        afterImages: [],
        reopenCount: 0
      },
      reportedBy: c.reportedBy ? {
        name: c.reportedBy.name,
        email: c.reportedBy.email,
        phone: c.reportedBy.phone
      } : null
    };
  });

  // If sorting by urgency_desc, sort in-memory based on calculated score
  if (sortBy === 'urgency_desc') {
    complaints.sort((a, b) => (b.sla?.urgencyScore || 0) - (a.sla?.urgencyScore || 0));
  }

  return {
    metrics: {
      totalAssigned,
      activeWorkload,
      pendingCount,
      inProgressCount,
      resolvedCount,
      reopenedCount,
      awaitingVerificationCount,
      verifiedCount,
      rejectedCount,
      slaUrgentCount,
      slaBreachedCount,
      totalReopens,
      reopenRate,
      verificationAccuracy
    },
    complaints,
    pagination: {
      total: totalFiltered,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(totalFiltered / safeLimit) || 1,
      hasNextPage: safePage < (Math.ceil(totalFiltered / safeLimit) || 1),
      hasPrevPage: safePage > 1
    }
  };
};

/**
 * Service: Retrieves resolution evidence and verification status with anti-IDOR authorization checks
 * @param {string} rawComplaintId
 * @param {object} requestingUser
 * @returns {Promise<object>}
 */
export const getResolutionEvidence = async (rawComplaintId, requestingUser) => {
  assertDatabaseConnected();

  const complaint = await findComplaintByIdOrTrackingId(rawComplaintId);
  if (!complaint) {
    const error = new Error(`Complaint '${rawComplaintId}' not found`);
    error.statusCode = 404;
    throw error;
  }

  // Anti-IDOR Authorization Check
  const role = requestingUser?.role;
  const userIdStr = requestingUser?._id ? String(requestingUser._id) : (requestingUser?.id ? String(requestingUser.id) : null);

  if (role !== 'admin') {
    if (role === 'officer') {
      const officerIdStr = complaint.assignedOfficer?._id
        ? String(complaint.assignedOfficer._id)
        : (complaint.assignedOfficer ? String(complaint.assignedOfficer) : null);
      
      const officerDeptStr = requestingUser?.department ? String(requestingUser.department) : null;
      const complaintDeptStr = complaint.assignedDepartment?._id
        ? String(complaint.assignedDepartment._id)
        : (complaint.assignedDepartment ? String(complaint.assignedDepartment) : null);

      const isAssigned = officerIdStr && userIdStr && officerIdStr === userIdStr;
      const isSameDept = officerDeptStr && complaintDeptStr && officerDeptStr === complaintDeptStr;

      if (!isAssigned && !isSameDept) {
        const error = new Error('Access denied: You are not authorized to view resolution evidence for this complaint.');
        error.statusCode = 403;
        throw error;
      }
    } else {
      // Citizen check
      const citizenIdStr = complaint.reportedBy?._id
        ? String(complaint.reportedBy._id)
        : (complaint.reportedBy ? String(complaint.reportedBy) : null);
      
      const citizenEmail = complaint.contactEmail || complaint.reportedBy?.email;
      const userEmail = requestingUser?.email;

      const isOwner = (citizenIdStr && userIdStr && citizenIdStr === userIdStr) ||
                      (citizenEmail && userEmail && citizenEmail.toLowerCase() === userEmail.toLowerCase());

      if (!isOwner) {
        const error = new Error('Access denied: You are not authorized to view this complaint.');
        error.statusCode = 403;
        throw error;
      }
    }
  }

  const evidence = complaint.resolutionEvidence || {
    status: 'Not Submitted',
    remarks: '',
    beforeImages: [],
    afterImages: [],
    reopenCount: 0,
    maxReopenLimit: 3
  };

  return {
    complaintId: complaint.complaintId,
    title: complaint.title,
    description: complaint.description,
    status: complaint.status,
    priority: complaint.priority,
    category: complaint.category,
    location: complaint.location,
    imageUrl: complaint.imageUrl,
    assignedDepartment: complaint.assignedDepartment,
    assignedOfficer: complaint.assignedOfficer ? {
      name: complaint.assignedOfficer.name,
      badgeNumber: complaint.assignedOfficer.badgeNumber,
      email: complaint.assignedOfficer.email
    } : null,
    sla: complaint.sla,
    resolutionEvidence: {
      status: evidence.status || 'Not Submitted',
      remarks: evidence.remarks || '',
      beforeImages: (evidence.beforeImages || []).map(img => ({
        url: img.url,
        caption: img.caption || '',
        uploadedAt: img.uploadedAt
      })),
      afterImages: (evidence.afterImages || []).map(img => ({
        url: img.url,
        caption: img.caption || '',
        uploadedAt: img.uploadedAt
      })),
      submittedAt: evidence.submittedAt,
      submittedByName: evidence.submittedByName,
      citizenVerification: evidence.citizenVerification || {},
      reopenCount: evidence.reopenCount || 0,
      maxReopenLimit: evidence.maxReopenLimit || 3,
      adminReview: evidence.adminReview || { status: 'Not Required' },
      reopeningHistory: (evidence.reopeningHistory || []).map(h => ({
        reopenedAt: h.reopenedAt,
        reopenedByName: h.reopenedByName,
        reason: h.reason,
        rejectionEvidence: (h.rejectionEvidence || []).map(e => ({ url: e.url, caption: e.caption }))
      }))
    }
  };
};

/**
 * Service: Uploads evidence photos (before or after) for a complaint by the assigned officer
 * @param {string|mongoose.Types.ObjectId} officerId
 * @param {string} rawComplaintId
 * @param {Array<Express.Multer.File>} files
 * @param {object} options
 * @returns {Promise<object>}
 */
export const uploadResolutionEvidenceImages = async (
  officerId,
  rawComplaintId,
  files = [],
  { type = 'after', caption = '' } = {}
) => {
  assertDatabaseConnected();

  if (!files || files.length === 0) {
    const error = new Error('No image files provided');
    error.statusCode = 400;
    throw error;
  }

  const complaint = await findComplaintByIdOrTrackingId(rawComplaintId);
  if (!complaint) {
    const error = new Error(`Complaint '${rawComplaintId}' not found`);
    error.statusCode = 404;
    throw error;
  }

  // Anti-IDOR Authorization Check
  const officerIdStr = complaint.assignedOfficer?._id
    ? String(complaint.assignedOfficer._id)
    : (complaint.assignedOfficer ? String(complaint.assignedOfficer) : null);
  const authUserIdStr = String(officerId);

  if (officerIdStr !== authUserIdStr) {
    const error = new Error('Access denied: Only the assigned officer can upload resolution evidence for this complaint.');
    error.statusCode = 403;
    throw error;
  }

  // Upload to Cloudinary with rollback guarantee
  const uploaded = await uploadMultipleImagesToCloudinary(files);

  const imageObjects = uploaded.map(u => ({
    url: u.url,
    publicId: u.publicId,
    caption: caption || '',
    uploadedAt: new Date(),
    uploadedBy: officerId
  }));

  if (!complaint.resolutionEvidence) {
    complaint.resolutionEvidence = {
      status: 'Not Submitted',
      beforeImages: [],
      afterImages: []
    };
  }

  if (type === 'before') {
    complaint.resolutionEvidence.beforeImages = [
      ...(complaint.resolutionEvidence.beforeImages || []),
      ...imageObjects
    ];
  } else {
    complaint.resolutionEvidence.afterImages = [
      ...(complaint.resolutionEvidence.afterImages || []),
      ...imageObjects
    ];
  }

  await complaint.save();

  return {
    type,
    uploadedImages: imageObjects,
    totalImages: type === 'before'
      ? complaint.resolutionEvidence.beforeImages.length
      : complaint.resolutionEvidence.afterImages.length
  };
};

/**
 * Service: Submits resolution evidence and marks complaint as 'Resolved' awaiting citizen verification
 * @param {string|mongoose.Types.ObjectId} officerId
 * @param {string} rawComplaintId
 * @param {object} params
 * @param {string} params.remarks
 * @param {Array<Express.Multer.File>} [params.afterFiles]
 * @param {Array<Express.Multer.File>} [params.beforeFiles]
 * @param {string} [params.caption]
 * @param {object} [params.officerUser]
 * @returns {Promise<Complaint>}
 */
export const submitOfficerResolution = async (
  officerId,
  rawComplaintId,
  { remarks, afterFiles = [], beforeFiles = [], caption = '', officerUser = null } = {}
) => {
  assertDatabaseConnected();

  if (!remarks || typeof remarks !== 'string' || remarks.trim().length < 10) {
    const error = new Error('Resolution remarks are required (minimum 10 characters detailing actions taken)');
    error.statusCode = 400;
    throw error;
  }

  const complaint = await findComplaintByIdOrTrackingId(rawComplaintId);
  if (!complaint) {
    const error = new Error(`Complaint '${rawComplaintId}' not found`);
    error.statusCode = 404;
    throw error;
  }

  // Anti-IDOR Authorization
  const officerIdStr = complaint.assignedOfficer?._id
    ? String(complaint.assignedOfficer._id)
    : (complaint.assignedOfficer ? String(complaint.assignedOfficer) : null);
  const authUserIdStr = String(officerId);

  if (officerIdStr !== authUserIdStr) {
    const error = new Error('Access denied: You are not the assigned officer for this complaint.');
    error.statusCode = 403;
    throw error;
  }

  // Prevent duplicate submission on already finalized resolution
  if (complaint.status === 'Resolved' && complaint.resolutionEvidence?.status === 'Verified by Citizen') {
    const error = new Error('Complaint resolution has already been verified and confirmed.');
    error.statusCode = 400;
    throw error;
  }

  // Handle new uploads if provided in same call
  let newAfterImages = [];
  let newBeforeImages = [];

  if (afterFiles && afterFiles.length > 0) {
    const uploadedAfter = await uploadMultipleImagesToCloudinary(afterFiles);
    newAfterImages = uploadedAfter.map(u => ({
      url: u.url,
      publicId: u.publicId,
      caption: caption || 'Work completion photo',
      uploadedAt: new Date(),
      uploadedBy: officerId
    }));
  }

  if (beforeFiles && beforeFiles.length > 0) {
    const uploadedBefore = await uploadMultipleImagesToCloudinary(beforeFiles);
    newBeforeImages = uploadedBefore.map(u => ({
      url: u.url,
      publicId: u.publicId,
      caption: caption || 'Initial site condition',
      uploadedAt: new Date(),
      uploadedBy: officerId
    }));
  }

  if (!complaint.resolutionEvidence) {
    complaint.resolutionEvidence = {
      status: 'Not Submitted',
      beforeImages: [],
      afterImages: []
    };
  }

  if (newBeforeImages.length > 0) {
    complaint.resolutionEvidence.beforeImages = [
      ...(complaint.resolutionEvidence.beforeImages || []),
      ...newBeforeImages
    ];
  }

  if (newAfterImages.length > 0) {
    complaint.resolutionEvidence.afterImages = [
      ...(complaint.resolutionEvidence.afterImages || []),
      ...newAfterImages
    ];
  }

  // Verification rule: At least one resolution/after image must be attached
  const totalAfterImages = (complaint.resolutionEvidence.afterImages || []).length;
  if (totalAfterImages === 0) {
    const error = new Error('At least one resolution (after) photograph is required as proof of completion.');
    error.statusCode = 400;
    throw error;
  }

  const officerName = officerUser?.name || complaint.assignedOfficer?.name || 'Assigned Officer';
  const previousStatus = complaint.status;

  // Update complaint state
  complaint.status = 'Resolved';
  complaint.resolutionEvidence.status = 'Awaiting Citizen Verification';
  complaint.resolutionEvidence.remarks = remarks.trim();
  complaint.resolutionEvidence.submittedAt = new Date();
  complaint.resolutionEvidence.submittedBy = officerId;
  complaint.resolutionEvidence.submittedByName = officerName;

  // Add to statusHistory
  complaint.statusHistory.push({
    previousStatus,
    newStatus: 'Resolved',
    changedAt: new Date(),
    changedBy: officerName,
    notes: `Resolution submitted: ${remarks.trim()}`
  });

  // Add to verificationHistory
  if (!complaint.resolutionEvidence.verificationHistory) {
    complaint.resolutionEvidence.verificationHistory = [];
  }
  complaint.resolutionEvidence.verificationHistory.push({
    action: 'SUBMITTED',
    performedBy: officerId,
    performedByName: officerName,
    performedAt: new Date(),
    notes: remarks.trim()
  });

  // SLA status update
  handleComplaintStatusChangeSla(complaint, 'Resolved');

  await complaint.save();

  // Trigger citizen notification
  notifyResolutionSubmitted({
    complaint,
    officer: officerUser || complaint.assignedOfficer
  }).catch(err => console.warn('[Resolution] Notification dispatch error:', err.message));

  return complaint;
};

/**
 * Service: Citizen verifies and confirms complaint resolution
 * @param {string|mongoose.Types.ObjectId} citizenId
 * @param {string} rawComplaintId
 * @param {object} options
 * @returns {Promise<object>}
 */
export const verifyResolutionByCitizen = async (
  citizenId,
  rawComplaintId,
  { citizenUser = null } = {}
) => {
  assertDatabaseConnected();

  const complaint = await findComplaintByIdOrTrackingId(rawComplaintId);
  if (!complaint) {
    const error = new Error(`Complaint '${rawComplaintId}' not found`);
    error.statusCode = 404;
    throw error;
  }

  // Anti-IDOR Authorization Check
  const citizenIdStr = complaint.reportedBy?._id
    ? String(complaint.reportedBy._id)
    : (complaint.reportedBy ? String(complaint.reportedBy) : null);
  const authUserIdStr = String(citizenId);
  const citizenEmail = complaint.contactEmail || complaint.reportedBy?.email;
  const userEmail = citizenUser?.email;

  const isOwner = (citizenIdStr && citizenIdStr === authUserIdStr) ||
                  (citizenEmail && userEmail && citizenEmail.toLowerCase() === userEmail.toLowerCase());

  if (!isOwner) {
    const error = new Error('Access denied: You are not authorized to verify this complaint resolution.');
    error.statusCode = 403;
    throw error;
  }

  // Verification state check
  if (complaint.status !== 'Resolved') {
    const error = new Error(`Complaint is currently '${complaint.status}' and cannot be verified.`);
    error.statusCode = 400;
    throw error;
  }

  if (complaint.resolutionEvidence?.status === 'Verified by Citizen') {
    return {
      success: true,
      message: 'Resolution has already been verified.',
      complaint: complaint.toPublicJSON()
    };
  }

  const citizenName = citizenUser?.name || 'Citizen';

  if (!complaint.resolutionEvidence) {
    complaint.resolutionEvidence = { status: 'Not Submitted' };
  }

  complaint.resolutionEvidence.status = 'Verified by Citizen';
  if (!complaint.resolutionEvidence.citizenVerification) {
    complaint.resolutionEvidence.citizenVerification = {};
  }
  complaint.resolutionEvidence.citizenVerification.verifiedAt = new Date();
  complaint.resolutionEvidence.citizenVerification.verifiedBy = citizenId;

  // Add to verificationHistory
  if (!complaint.resolutionEvidence.verificationHistory) {
    complaint.resolutionEvidence.verificationHistory = [];
  }
  complaint.resolutionEvidence.verificationHistory.push({
    action: 'VERIFIED',
    performedBy: citizenId,
    performedByName: citizenName,
    performedAt: new Date(),
    notes: 'Citizen confirmed resolution.'
  });

  await complaint.save();

  // Notify assigned officer
  notifyResolutionVerified({
    complaint,
    citizen: citizenUser || complaint.reportedBy
  }).catch(err => console.warn('[Resolution] Verified notification failed:', err.message));

  return {
    success: true,
    message: 'Resolution verified successfully. Thank you for confirming!',
    complaint: complaint.toPublicJSON()
  };
};

/**
 * Service: Citizen rejects resolution and reopens the complaint with mandatory reason and optional photos
 * @param {string|mongoose.Types.ObjectId} citizenId
 * @param {string} rawComplaintId
 * @param {object} params
 * @param {string} params.reason
 * @param {Array<Express.Multer.File>} [params.files]
 * @param {object} [params.citizenUser]
 * @returns {Promise<object>}
 */
export const rejectResolutionByCitizen = async (
  citizenId,
  rawComplaintId,
  { reason, files = [], citizenUser = null } = {}
) => {
  assertDatabaseConnected();

  if (!reason || typeof reason !== 'string' || reason.trim().length < 10) {
    const error = new Error('Rejection reason is mandatory and must be at least 10 characters long.');
    error.statusCode = 400;
    throw error;
  }

  const complaint = await findComplaintByIdOrTrackingId(rawComplaintId);
  if (!complaint) {
    const error = new Error(`Complaint '${rawComplaintId}' not found`);
    error.statusCode = 404;
    throw error;
  }

  // Anti-IDOR Authorization Check
  const citizenIdStr = complaint.reportedBy?._id
    ? String(complaint.reportedBy._id)
    : (complaint.reportedBy ? String(complaint.reportedBy) : null);
  const authUserIdStr = String(citizenId);
  const citizenEmail = complaint.contactEmail || complaint.reportedBy?.email;
  const userEmail = citizenUser?.email;

  const isOwner = (citizenIdStr && citizenIdStr === authUserIdStr) ||
                  (citizenEmail && userEmail && citizenEmail.toLowerCase() === userEmail.toLowerCase());

  if (!isOwner) {
    const error = new Error('Access denied: You are not authorized to contest this complaint resolution.');
    error.statusCode = 403;
    throw error;
  }

  if (complaint.status !== 'Resolved') {
    const error = new Error(`Complaint is currently '${complaint.status}' and cannot be contested.`);
    error.statusCode = 400;
    throw error;
  }

  // Prevent duplicate rejection after verified or while under administrative review
  if (complaint.resolutionEvidence?.status === 'Verified by Citizen') {
    const error = new Error('Resolution has already been verified and confirmed. It cannot be contested.');
    error.statusCode = 400;
    throw error;
  }

  if (complaint.resolutionEvidence?.status === 'Under Administrative Review') {
    const error = new Error('This complaint is currently under administrative review and cannot be contested by citizen.');
    error.statusCode = 400;
    throw error;
  }

  // Upload optional citizen rejection evidence photos
  let uploadedEvidence = [];
  if (files && files.length > 0) {
    const uploaded = await uploadMultipleImagesToCloudinary(files);
    uploadedEvidence = uploaded.map(u => ({
      url: u.url,
      publicId: u.publicId,
      caption: 'Citizen rejection proof',
      uploadedAt: new Date(),
      uploadedBy: citizenId
    }));
  }

  const citizenName = citizenUser?.name || 'Citizen';
  const cleanReason = reason.trim();

  if (!complaint.resolutionEvidence) {
    complaint.resolutionEvidence = {
      status: 'Not Submitted',
      reopenCount: 0,
      maxReopenLimit: 3
    };
  }

  const currentReopenCount = (complaint.resolutionEvidence.reopenCount || 0) + 1;
  const maxLimit = complaint.resolutionEvidence.maxReopenLimit || 3;
  complaint.resolutionEvidence.reopenCount = currentReopenCount;

  // Record reopening history entry
  if (!complaint.resolutionEvidence.reopeningHistory) {
    complaint.resolutionEvidence.reopeningHistory = [];
  }
  complaint.resolutionEvidence.reopeningHistory.push({
    reopenedAt: new Date(),
    reopenedBy: citizenId,
    reopenedByName: citizenName,
    reason: cleanReason,
    rejectionEvidence: uploadedEvidence,
    previousStatus: complaint.status
  });

  // Citizen verification rejection subdoc
  if (!complaint.resolutionEvidence.citizenVerification) {
    complaint.resolutionEvidence.citizenVerification = {};
  }
  complaint.resolutionEvidence.citizenVerification.rejectedAt = new Date();
  complaint.resolutionEvidence.citizenVerification.rejectionReason = cleanReason;
  complaint.resolutionEvidence.citizenVerification.rejectionEvidence = uploadedEvidence;

  let isEscalatedToAdmin = false;

  // Dispute escalation check: If max limit reached, escalate to administrative review
  if (currentReopenCount >= maxLimit) {
    isEscalatedToAdmin = true;
    complaint.status = 'Reopened';
    complaint.resolutionEvidence.status = 'Under Administrative Review';
    if (!complaint.resolutionEvidence.adminReview) {
      complaint.resolutionEvidence.adminReview = {};
    }
    complaint.resolutionEvidence.adminReview.status = 'Pending';
    complaint.resolutionEvidence.adminReview.notes = `Exceeded maximum citizen rejections (${currentReopenCount}/${maxLimit}). Escalated for administrative resolution review.`;
  } else {
    complaint.status = 'Reopened';
    complaint.resolutionEvidence.status = 'Rejected by Citizen';
  }

  // Update status history
  complaint.statusHistory.push({
    previousStatus: 'Resolved',
    newStatus: 'Reopened',
    changedAt: new Date(),
    changedBy: citizenName,
    notes: `Citizen rejected resolution: ${cleanReason}`
  });

  // Record in verificationHistory
  if (!complaint.resolutionEvidence.verificationHistory) {
    complaint.resolutionEvidence.verificationHistory = [];
  }
  complaint.resolutionEvidence.verificationHistory.push({
    action: 'REJECTED',
    performedBy: citizenId,
    performedByName: citizenName,
    performedAt: new Date(),
    notes: cleanReason
  });

  // SLA recalculation for Reopened complaint
  handleComplaintStatusChangeSla(complaint, 'Reopened');

  await complaint.save();

  // Notifications
  if (isEscalatedToAdmin) {
    notifyAdminReviewRequired({
      complaint,
      reason: cleanReason,
      reopenCount: currentReopenCount
    }).catch(err => console.warn('[Resolution] Admin review alert error:', err.message));
  }

  notifyResolutionRejected({
    complaint,
    reason: cleanReason,
    citizen: citizenUser || complaint.reportedBy
  }).catch(err => console.warn('[Resolution] Officer rejection alert error:', err.message));

  return {
    success: true,
    message: isEscalatedToAdmin
      ? `Complaint reopened. Due to multiple rejections (${currentReopenCount}/${maxLimit}), it has been escalated to municipal administration for review.`
      : 'Complaint reopened successfully. The assigned officer has been notified to address the remaining issues.',
    reopenCount: currentReopenCount,
    maxReopenLimit: maxLimit,
    isEscalatedToAdmin,
    complaint: complaint.toPublicJSON()
  };
};

/**
 * Service: Administrative review for disputed resolutions or escalated reopens
 * @param {string|mongoose.Types.ObjectId} adminId
 * @param {string} rawComplaintId
 * @param {object} params
 * @param {string} params.action - 'APPROVE_RESOLUTION' | 'REOPEN_COMPLAINT' | 'OVERRIDE_RESOLUTION' | 'REASSIGN'
 * @param {string} params.notes
 * @param {object} [params.adminUser]
 * @param {string} [params.reassignedDepartment]
 * @param {string} [params.reassignedOfficer]
 * @returns {Promise<Complaint>}
 */
export const reviewResolutionByAdmin = async (
  adminId,
  rawComplaintId,
  { action, notes, adminUser = null, reassignedDepartment = null, reassignedOfficer = null } = {}
) => {
  assertDatabaseConnected();

  const validActions = ['APPROVE_RESOLUTION', 'REOPEN_COMPLAINT', 'OVERRIDE_RESOLUTION', 'REASSIGN'];
  if (!action || !validActions.includes(action)) {
    const error = new Error(`Invalid admin review action. Must be one of: ${validActions.join(', ')}`);
    error.statusCode = 400;
    throw error;
  }

  if (!notes || typeof notes !== 'string' || notes.trim().length < 5) {
    const error = new Error('Administrative review notes are required (minimum 5 characters)');
    error.statusCode = 400;
    throw error;
  }

  const complaint = await findComplaintByIdOrTrackingId(rawComplaintId);
  if (!complaint) {
    const error = new Error(`Complaint '${rawComplaintId}' not found`);
    error.statusCode = 404;
    throw error;
  }

  const adminName = adminUser?.name || 'Administrator';
  const cleanNotes = notes.trim();
  const previousStatus = complaint.status;

  if (!complaint.resolutionEvidence) {
    complaint.resolutionEvidence = { status: 'Not Submitted' };
  }
  if (!complaint.resolutionEvidence.adminReview) {
    complaint.resolutionEvidence.adminReview = {};
  }

  let adminReviewStatus = 'Approved';
  let targetComplaintStatus = complaint.status;
  let targetResolutionStatus = complaint.resolutionEvidence.status;

  if (action === 'APPROVE_RESOLUTION') {
    adminReviewStatus = 'Approved';
    targetComplaintStatus = 'Resolved';
    targetResolutionStatus = 'Verified by Citizen';
    handleComplaintStatusChangeSla(complaint, 'Resolved');
  } else if (action === 'OVERRIDE_RESOLUTION') {
    adminReviewStatus = 'Overridden';
    targetComplaintStatus = 'Resolved';
    targetResolutionStatus = 'Verified by Citizen';
    handleComplaintStatusChangeSla(complaint, 'Resolved');
  } else if (action === 'REOPEN_COMPLAINT') {
    adminReviewStatus = 'Rejected';
    targetComplaintStatus = 'Reopened';
    targetResolutionStatus = 'Reopened';
    handleComplaintStatusChangeSla(complaint, 'Reopened');
  } else if (action === 'REASSIGN') {
    adminReviewStatus = 'Approved';
    targetComplaintStatus = 'In Progress';
    targetResolutionStatus = 'Not Submitted';

    if (reassignedDepartment) {
      complaint.assignedDepartment = reassignedDepartment;
    }
    if (reassignedOfficer) {
      complaint.assignedOfficer = reassignedOfficer;
    }
  }

  complaint.status = targetComplaintStatus;
  complaint.resolutionEvidence.status = targetResolutionStatus;
  complaint.resolutionEvidence.adminReview = {
    status: adminReviewStatus,
    reviewedBy: adminId,
    reviewedByName: adminName,
    reviewedAt: new Date(),
    notes: cleanNotes,
    actionTaken: action
  };

  // Add to statusHistory if status changed
  if (targetComplaintStatus !== previousStatus) {
    complaint.statusHistory.push({
      previousStatus,
      newStatus: targetComplaintStatus,
      changedAt: new Date(),
      changedBy: adminName,
      notes: `Admin Review Action (${action}): ${cleanNotes}`
    });
  }

  // Add to verificationHistory
  if (!complaint.resolutionEvidence.verificationHistory) {
    complaint.resolutionEvidence.verificationHistory = [];
  }
  complaint.resolutionEvidence.verificationHistory.push({
    action: `ADMIN_${action}`,
    performedBy: adminId,
    performedByName: adminName,
    performedAt: new Date(),
    notes: cleanNotes
  });

  await complaint.save();

  return complaint;
};

/**
 * Service: Retrieves administrative list of all complaints with resolution evidence, disputes, and reviews
 * @param {object} options
 * @returns {Promise<object>}
 */
export const getAdminResolutionsList = async ({
  verificationStatus = 'all',
  adminReviewStatus = 'all',
  department = 'all',
  officerId = 'all',
  disputedOnly = false,
  search = '',
  page = 1,
  limit = 20
} = {}) => {
  assertDatabaseConnected();

  const query = {};

  if (verificationStatus && verificationStatus !== 'all') {
    query['resolutionEvidence.status'] = verificationStatus;
  }

  if (adminReviewStatus && adminReviewStatus !== 'all') {
    query['resolutionEvidence.adminReview.status'] = adminReviewStatus;
  }

  if (department && department !== 'all') {
    query.assignedDepartment = mongoose.Types.ObjectId.isValid(department)
      ? new mongoose.Types.ObjectId(department)
      : department;
  }

  if (officerId && officerId !== 'all') {
    query.assignedOfficer = mongoose.Types.ObjectId.isValid(officerId)
      ? new mongoose.Types.ObjectId(officerId)
      : officerId;
  }

  if (disputedOnly === true || disputedOnly === 'true') {
    query.$or = [
      { 'resolutionEvidence.reopenCount': { $gt: 0 } },
      { 'resolutionEvidence.status': { $in: ['Rejected by Citizen', 'Reopened', 'Under Administrative Review'] } },
      { 'resolutionEvidence.adminReview.status': 'Pending' }
    ];
  }

  if (search && search.trim()) {
    const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    query.$or = [
      { complaintId: { $regex: escaped, $options: 'i' } },
      { title: { $regex: escaped, $options: 'i' } },
      { 'resolutionEvidence.submittedByName': { $regex: escaped, $options: 'i' } }
    ];
  }

  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (safePage - 1) * safeLimit;

  const [complaints, total] = await Promise.all([
    Complaint.find(query)
      .populate('assignedDepartment', 'name code')
      .populate('assignedOfficer', 'name email badgeNumber')
      .populate('reportedBy', 'name email phone')
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(safeLimit)
      .lean(),
    Complaint.countDocuments(query)
  ]);

  return {
    resolutions: complaints.map(c => ({
      _id: c._id,
      id: c._id,
      complaintId: c.complaintId,
      title: c.title,
      status: c.status,
      priority: c.priority,
      category: c.category,
      assignedDepartment: c.assignedDepartment,
      assignedOfficer: c.assignedOfficer,
      reportedBy: c.reportedBy ? { name: c.reportedBy.name, email: c.reportedBy.email } : null,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      sla: c.sla,
      resolutionEvidence: c.resolutionEvidence || { status: 'Not Submitted' }
    })),
    pagination: {
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit) || 1,
      hasNextPage: safePage < (Math.ceil(total / safeLimit) || 1),
      hasPrevPage: safePage > 1
    }
  };
};

/**
 * Service: Retrieves resolution overview statistics for administrators
 * @returns {Promise<object>}
 */
export const getAdminResolutionStats = async () => {
  assertDatabaseConnected();

  const allWithResolution = await Complaint.find({
    $or: [
      { status: 'Resolved' },
      { 'resolutionEvidence.status': { $exists: true, $ne: 'Not Submitted' } },
      { 'resolutionEvidence.reopenCount': { $gt: 0 } }
    ]
  }).select('status resolutionEvidence sla createdAt updatedAt').lean();

  let totalSubmitted = 0;
  let awaitingVerification = 0;
  let verifiedByCitizen = 0;
  let rejectedByCitizen = 0;
  let underAdminReview = 0;
  let disputedCount = 0;
  let totalReopenEvents = 0;

  for (const c of allWithResolution) {
    const vStatus = c.resolutionEvidence?.status || 'Not Submitted';
    if (vStatus !== 'Not Submitted') totalSubmitted++;
    if (vStatus === 'Awaiting Citizen Verification') awaitingVerification++;
    else if (vStatus === 'Verified by Citizen') verifiedByCitizen++;
    else if (vStatus === 'Rejected by Citizen') rejectedByCitizen++;
    else if (vStatus === 'Under Administrative Review') underAdminReview++;

    const reopens = c.resolutionEvidence?.reopenCount || 0;
    if (reopens > 0) {
      disputedCount++;
      totalReopenEvents += reopens;
    }
  }

  const verificationRate = totalSubmitted > 0 ? Math.round((verifiedByCitizen / totalSubmitted) * 100) : 0;
  const disputeRate = totalSubmitted > 0 ? Math.round((disputedCount / totalSubmitted) * 100) : 0;

  return {
    totalSubmitted,
    awaitingVerification,
    verifiedByCitizen,
    rejectedByCitizen,
    underAdminReview,
    disputedCount,
    totalReopenEvents,
    verificationRate,
    disputeRate
  };
};

/**
 * Service: Calculates officer resolution performance analytics
 * @param {object} params
 * @param {string} [params.officerId]
 * @param {string} [params.departmentId]
 * @returns {Promise<Array<object>>}
 */
export const getOfficerPerformanceAnalytics = async ({
  officerId = null,
  departmentId = null
} = {}) => {
  assertDatabaseConnected();

  const userQuery = { role: 'officer', isActive: true };
  if (officerId) {
    userQuery._id = mongoose.Types.ObjectId.isValid(officerId)
      ? new mongoose.Types.ObjectId(officerId)
      : officerId;
  }
  if (departmentId) {
    userQuery.department = mongoose.Types.ObjectId.isValid(departmentId)
      ? new mongoose.Types.ObjectId(departmentId)
      : departmentId;
  }

  const officers = await User.find(userQuery)
    .populate('department', 'name code')
    .select('_id name email badgeNumber department')
    .lean();

  const results = [];

  for (const officer of officers) {
    const complaints = await Complaint.find({ assignedOfficer: officer._id })
      .select('status sla resolutionEvidence createdAt')
      .lean();

    const totalAssigned = complaints.length;
    let totalResolved = 0;
    let resolvedOnTime = 0;
    let verifiedCount = 0;
    let rejectedCount = 0;
    let totalReopens = 0;
    let totalResolutionHours = 0;
    let countWithDuration = 0;

    for (const c of complaints) {
      if (c.status === 'Resolved') {
        totalResolved++;
        if (c.sla?.status === 'Resolved Within SLA' || (c.sla && !c.sla.isOverdue)) {
          resolvedOnTime++;
        }
      }

      const vStatus = c.resolutionEvidence?.status;
      if (vStatus === 'Verified by Citizen') verifiedCount++;
      else if (vStatus === 'Rejected by Citizen' || vStatus === 'Reopened') rejectedCount++;

      const reopens = c.resolutionEvidence?.reopenCount || 0;
      totalReopens += reopens;

      if (c.sla?.resolvedAt && c.createdAt) {
        const duration = (new Date(c.sla.resolvedAt).getTime() - new Date(c.createdAt).getTime()) / 3600000;
        if (duration > 0) {
          totalResolutionHours += duration;
          countWithDuration++;
        }
      }
    }

    const slaComplianceRate = totalResolved > 0 ? Math.round((resolvedOnTime / totalResolved) * 100) : 100;
    const verificationRate = (verifiedCount + rejectedCount) > 0
      ? Math.round((verifiedCount / (verifiedCount + rejectedCount)) * 100)
      : 100;
    const avgResolutionHours = countWithDuration > 0
      ? Math.round((totalResolutionHours / countWithDuration) * 10) / 10
      : 0;

    results.push({
      officerId: officer._id,
      name: officer.name,
      email: officer.email,
      badgeNumber: officer.badgeNumber || 'N/A',
      department: officer.department ? {
        id: officer.department._id,
        name: officer.department.name,
        code: officer.department.code
      } : null,
      totalAssigned,
      totalResolved,
      activeComplaints: totalAssigned - totalResolved,
      resolvedOnTime,
      slaComplianceRate,
      verifiedCount,
      rejectedCount,
      verificationRate,
      totalReopens,
      avgResolutionHours
    });
  }

  return results;
};

export default {
  findComplaintByIdOrTrackingId,
  computeOfficerComplaintMetrics,
  getOfficerWorkspace,
  getResolutionEvidence,
  uploadResolutionEvidenceImages,
  submitOfficerResolution,
  verifyResolutionByCitizen,
  rejectResolutionByCitizen,
  reviewResolutionByAdmin,
  getAdminResolutionsList,
  getAdminResolutionStats,
  getOfficerPerformanceAnalytics
};
