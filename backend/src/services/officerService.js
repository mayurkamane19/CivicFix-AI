import mongoose from 'mongoose';
import { Complaint } from '../models/Complaint.js';
import { User } from '../models/User.js';
import { getDatabaseStatus } from '../config/db.js';
import { notifyStatusUpdated } from './notificationService.js';
import { handleComplaintStatusChangeSla } from './slaService.js';

export const OFFICER_ALLOWED_STATUSES = ['In Progress', 'Resolved'];

/**
 * Service: Retrieves operational statistics for an authenticated field officer
 * @param {string} officerId
 * @returns {Promise<object>}
 */
export const getOfficerDashboardStats = async (officerId) => {
  if (!officerId || !mongoose.Types.ObjectId.isValid(officerId)) {
    const error = new Error('Valid officer identity is required');
    error.statusCode = 400;
    throw error;
  }

  if (getDatabaseStatus() !== 'connected') {
    const error = new Error('Database service is currently unavailable. Please verify MongoDB connection.');
    error.statusCode = 503;
    throw error;
  }

  const officerObjectId = new mongoose.Types.ObjectId(officerId);

  // Parallel count queries scoped strictly to this officer's assignments
  const [
    totalAssigned,
    pendingCount,
    inProgressCount,
    resolvedCount,
    recentAssignedRaw,
    officerUser
  ] = await Promise.all([
    Complaint.countDocuments({ assignedOfficer: officerObjectId }),
    Complaint.countDocuments({ assignedOfficer: officerObjectId, status: 'Pending' }),
    Complaint.countDocuments({ assignedOfficer: officerObjectId, status: 'In Progress' }),
    Complaint.countDocuments({ assignedOfficer: officerObjectId, status: 'Resolved' }),
    Complaint.find({ assignedOfficer: officerObjectId }).sort({ assignedAt: -1, createdAt: -1 }).limit(5),
    User.findById(officerObjectId).populate('department', 'name code').select('-password')
  ]);

  const recentAssigned = recentAssignedRaw.map((c) => ({
    complaintId: c.complaintId,
    title: c.title,
    category: c.category,
    status: c.status,
    severity: c.aiAnalysis?.severity || null,
    address: c.location?.address || '',
    assignedAt: c.assignedAt || c.createdAt
  }));

  return {
    officer: {
      id: officerUser?._id.toString(),
      name: officerUser?.name || 'Field Officer',
      email: officerUser?.email,
      department: officerUser?.department?.name || 'Unassigned',
      departmentCode: officerUser?.department?.code || null
    },
    metrics: {
      totalAssigned,
      pending: pendingCount,
      inProgress: inProgressCount,
      resolved: resolvedCount
    },
    recentAssigned
  };
};

/**
 * Service: Retrieves paginated complaints assigned strictly to the authenticated field officer
 * @param {string} officerId
 * @param {object} queryOptions
 * @returns {Promise<object>}
 */
export const getOfficerComplaints = async (
  officerId,
  { status = '', search = '', sortBy = 'newest', page = 1, limit = 10 } = {}
) => {
  if (!officerId || !mongoose.Types.ObjectId.isValid(officerId)) {
    const error = new Error('Valid officer identity is required');
    error.statusCode = 400;
    throw error;
  }

  if (getDatabaseStatus() !== 'connected') {
    const error = new Error('Database service is currently unavailable. Please verify MongoDB connection.');
    error.statusCode = 503;
    throw error;
  }

  const officerObjectId = new mongoose.Types.ObjectId(officerId);
  const filterQuery = { assignedOfficer: officerObjectId };

  // Status Filter
  if (status && typeof status === 'string' && status.trim() !== '' && status.trim().toLowerCase() !== 'all') {
    filterQuery.status = status.trim();
  }

  // Search Filter
  if (search && typeof search === 'string' && search.trim() !== '') {
    const searchRegex = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filterQuery.$or = [
      { complaintId: searchRegex },
      { title: searchRegex },
      { 'location.address': searchRegex }
    ];
  }

  // Sorting
  const sort = sortBy === 'oldest' ? { createdAt: 1 } : { createdAt: -1 };

  // Pagination
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
  const skip = (pageNum - 1) * limitNum;

  const [total, complaintsRaw] = await Promise.all([
    Complaint.countDocuments(filterQuery),
    Complaint.find(filterQuery).sort(sort).skip(skip).limit(limitNum)
  ]);

  const complaints = complaintsRaw.map((c) => c.toPublicJSON());
  const totalPages = Math.ceil(total / limitNum) || 1;

  return {
    complaints,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages,
      hasNextPage: pageNum < totalPages,
      hasPrevPage: pageNum > 1
    }
  };
};

/**
 * Service: Retrieves complaint details for an assigned officer, enforcing strict ownership
 * @param {string} officerId
 * @param {string} rawComplaintId
 * @returns {Promise<object>}
 */
export const getOfficerComplaintDetails = async (officerId, rawComplaintId) => {
  if (!officerId || !mongoose.Types.ObjectId.isValid(officerId)) {
    const error = new Error('Valid officer identity is required');
    error.statusCode = 400;
    throw error;
  }

  if (!rawComplaintId || typeof rawComplaintId !== 'string' || rawComplaintId.trim() === '') {
    const error = new Error('Please provide a valid complaint ID');
    error.statusCode = 400;
    throw error;
  }

  if (getDatabaseStatus() !== 'connected') {
    const error = new Error('Database service is currently unavailable. Please verify MongoDB connection.');
    error.statusCode = 503;
    throw error;
  }

  const trimmedId = rawComplaintId.trim();
  const complaint = await Complaint.findOne({ complaintId: trimmedId });

  if (!complaint) {
    const error = new Error(`Complaint not found with ID: ${trimmedId}`);
    error.statusCode = 404;
    throw error;
  }

  // Strict ownership check (IDOR Protection)
  if (!complaint.assignedOfficer || complaint.assignedOfficer.toString() !== officerId.toString()) {
    const error = new Error('Access denied: This complaint is not assigned to your account');
    error.statusCode = 403;
    throw error;
  }

  return complaint.toPublicJSON();
};

/**
 * Service: Updates status of an assigned complaint by the authenticated officer
 * Permitted transitions: 'In Progress', 'Resolved'
 * Reverting resolved to Pending is disallowed.
 * @param {string} officerId
 * @param {string} rawComplaintId
 * @param {string} newStatus
 * @param {object} options
 * @param {string} [options.note]
 * @param {object} options.officerUser
 * @returns {Promise<object>}
 */
export const updateOfficerComplaintStatus = async (
  officerId,
  rawComplaintId,
  newStatus,
  { note = '', officerUser } = {}
) => {
  if (!officerId || !mongoose.Types.ObjectId.isValid(officerId)) {
    const error = new Error('Valid officer identity is required');
    error.statusCode = 400;
    throw error;
  }

  if (!rawComplaintId || typeof rawComplaintId !== 'string' || rawComplaintId.trim() === '') {
    const error = new Error('Please provide a valid complaint ID');
    error.statusCode = 400;
    throw error;
  }

  if (!newStatus || typeof newStatus !== 'string' || !OFFICER_ALLOWED_STATUSES.includes(newStatus.trim())) {
    const error = new Error(
      `Invalid status for officer update. Permitted statuses: ${OFFICER_ALLOWED_STATUSES.join(', ')}`
    );
    error.statusCode = 400;
    throw error;
  }

  if (note !== undefined && note !== null) {
    if (typeof note !== 'string') {
      const error = new Error('Progress note must be a valid text string');
      error.statusCode = 400;
      throw error;
    }
    if (note.trim().length > 500) {
      const error = new Error('Progress note cannot exceed 500 characters');
      error.statusCode = 400;
      throw error;
    }
  }

  if (getDatabaseStatus() !== 'connected') {
    const error = new Error('Database service is currently unavailable. Please verify MongoDB connection.');
    error.statusCode = 503;
    throw error;
  }

  const trimmedId = rawComplaintId.trim();
  const validStatus = newStatus.trim();
  const trimmedNote = typeof note === 'string' ? note.trim() : '';

  const complaint = await Complaint.findOne({ complaintId: trimmedId });

  if (!complaint) {
    const error = new Error(`Complaint not found with ID: ${trimmedId}`);
    error.statusCode = 404;
    throw error;
  }

  // Strict ownership check (IDOR Protection)
  if (!complaint.assignedOfficer || complaint.assignedOfficer.toString() !== officerId.toString()) {
    const error = new Error('Access denied: You can only update complaints assigned to you');
    error.statusCode = 403;
    throw error;
  }

  // Prevent reverting a resolved complaint back to Pending or any lower state
  if (complaint.status === 'Resolved' && validStatus !== 'Resolved') {
    const error = new Error('Cannot change status of an already resolved complaint');
    error.statusCode = 400;
    throw error;
  }

  // Prevent duplicate audit log entry if status unchanged
  if (complaint.status === validStatus) {
    return complaint.toPublicJSON();
  }

  // Record status transition atomically
  const previousStatus = complaint.status || 'Pending';
  const historyEntry = {
    previousStatus,
    newStatus: validStatus,
    changedBy: officerUser?._id || officerId,
    changedByName: officerUser?.name || 'Field Officer',
    note: trimmedNote,
    changedAt: new Date()
  };

  if (!complaint.statusHistory) {
    complaint.statusHistory = [];
  }
  complaint.statusHistory.push(historyEntry);
  complaint.status = validStatus;

  // Synchronize SLA tracking state with resolution or reopening
  handleComplaintStatusChangeSla(complaint, validStatus);

  await complaint.save();

  // Trigger email notification non-blockingly (handles status update or resolution)
  try {
    await notifyStatusUpdated(complaint, {
      previousStatus,
      newStatus: validStatus,
      note: trimmedNote,
      changedByName: officerUser?.name || 'Field Officer'
    });
  } catch (notifyErr) {
    console.warn(`[Officer Status Update] Notification warning for ${complaint.complaintId}:`, notifyErr.message);
  }

  return complaint.toPublicJSON();
};

export default {
  OFFICER_ALLOWED_STATUSES,
  getOfficerDashboardStats,
  getOfficerComplaints,
  getOfficerComplaintDetails,
  updateOfficerComplaintStatus
};
