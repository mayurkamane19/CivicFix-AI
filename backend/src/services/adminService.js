import { Complaint } from '../models/Complaint.js';
import { getDatabaseStatus } from '../config/db.js';
import { notifyStatusUpdated } from './notificationService.js';
import { handleComplaintStatusChangeSla } from './slaService.js';

export const ALLOWED_STATUSES = ['Pending', 'In Progress', 'Resolved'];

/**
 * Service: Retrieves aggregated dashboard statistics for municipal administration
 * @returns {Promise<object>}
 */
export const getDashboardStatistics = async () => {
  if (getDatabaseStatus() !== 'connected') {
    const error = new Error('Database service is currently unavailable. Please verify MongoDB connection.');
    error.statusCode = 503;
    throw error;
  }

  // Execute aggregate queries in parallel
  const [
    totalComplaints,
    pendingComplaints,
    inProgressComplaints,
    resolvedComplaints,
    highCriticalComplaints,
    potentialDuplicates,
    recentComplaintsRaw,
    categoryAggregation
  ] = await Promise.all([
    Complaint.countDocuments({}),
    Complaint.countDocuments({ status: 'Pending' }),
    Complaint.countDocuments({ status: 'In Progress' }),
    Complaint.countDocuments({ status: 'Resolved' }),
    Complaint.countDocuments({ 'aiAnalysis.severity': { $in: ['High', 'Critical'] } }),
    Complaint.countDocuments({ 'duplicateCheck.isPotentialDuplicate': true }),
    Complaint.find({}).sort({ createdAt: -1 }).limit(5),
    Complaint.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ])
  ]);

  const categoriesBreakdown = {};
  for (const item of categoryAggregation) {
    if (item._id) {
      categoriesBreakdown[item._id] = item.count;
    }
  }

  const recentComplaints = recentComplaintsRaw.map((c) => ({
    complaintId: c.complaintId,
    title: c.title,
    category: c.category,
    status: c.status,
    severity: c.aiAnalysis?.severity || null,
    address: c.location?.address || '',
    createdAt: c.createdAt
  }));

  return {
    totalComplaints,
    pendingComplaints,
    inProgressComplaints,
    resolvedComplaints,
    highCriticalComplaints,
    potentialDuplicates,
    categoriesBreakdown,
    recentComplaints
  };
};

/**
 * Service: Retrieves paginated, filtered, and sorted complaints for admin management
 * @param {object} queryOptions
 * @returns {Promise<object>}
 */
export const getComplaintsForAdmin = async ({
  search = '',
  category = '',
  status = '',
  severity = '',
  department = '',
  officer = '',
  sortBy = 'newest',
  page = 1,
  limit = 10
} = {}) => {
  if (getDatabaseStatus() !== 'connected') {
    const error = new Error('Database service is currently unavailable. Please verify MongoDB connection.');
    error.statusCode = 503;
    throw error;
  }

  const filterQuery = {};

  // 1. Search Query (complaintId, title, or location address)
  if (search && typeof search === 'string' && search.trim() !== '') {
    const searchRegex = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filterQuery.$or = [
      { complaintId: searchRegex },
      { title: searchRegex },
      { 'location.address': searchRegex }
    ];
  }

  // 2. Category Filter
  if (category && typeof category === 'string' && category.trim() !== '' && category.trim().toLowerCase() !== 'all') {
    filterQuery.category = category.trim();
  }

  // 3. Status Filter
  if (status && typeof status === 'string' && status.trim() !== '' && status.trim().toLowerCase() !== 'all') {
    filterQuery.status = status.trim();
  }

  // 4. AI Severity Filter
  if (severity && typeof severity === 'string' && severity.trim() !== '' && severity.trim().toLowerCase() !== 'all') {
    filterQuery['aiAnalysis.severity'] = severity.trim();
  }

  // 5. Department Filter
  if (department && typeof department === 'string' && department.trim() !== '' && department.trim().toLowerCase() !== 'all') {
    filterQuery.assignedDepartment = department.trim();
  }

  // 6. Officer Filter
  if (officer && typeof officer === 'string' && officer.trim() !== '' && officer.trim().toLowerCase() !== 'all') {
    filterQuery.assignedOfficer = officer.trim();
  }

  // 5. Sorting
  const sort = sortBy === 'oldest' ? { createdAt: 1 } : { createdAt: -1 };

  // 6. Pagination Calculations
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
  const skip = (pageNum - 1) * limitNum;

  // Execute Count & Query
  const [total, complaintsRaw] = await Promise.all([
    Complaint.countDocuments(filterQuery),
    Complaint.find(filterQuery)
      .populate('assignedDepartment', 'name code')
      .populate('assignedOfficer', 'name')
      .sort(sort)
      .skip(skip)
      .limit(limitNum)
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
 * Service: Retrieves full details of a complaint for admin inspection
 * @param {string} rawComplaintId
 * @returns {Promise<object>}
 */
export const getAdminComplaintDetails = async (rawComplaintId) => {
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
  const complaint = await Complaint.findOne({ complaintId: trimmedId })
    .populate('assignedDepartment', 'name code')
    .populate('assignedOfficer', 'name email');

  if (!complaint) {
    const error = new Error(`Complaint not found with ID: ${trimmedId}`);
    error.statusCode = 404;
    throw error;
  }

  return complaint.toAdminJSON ? complaint.toAdminJSON() : complaint.toPublicJSON();
};

/**
 * Service: Retrieves chronological status history and audit trail for a complaint
 * @param {string} rawComplaintId
 * @returns {Promise<object>}
 */
export const getComplaintStatusHistory = async (rawComplaintId) => {
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
  const complaint = await Complaint.findOne({ complaintId: trimmedId })
    .populate('assignedDepartment', 'name code')
    .populate('assignedOfficer', 'name email');

  if (!complaint) {
    const error = new Error(`Complaint not found with ID: ${trimmedId}`);
    error.statusCode = 404;
    throw error;
  }

  const history = (complaint.statusHistory || []).map((h) => ({
    id: h._id ? h._id.toString() : undefined,
    previousStatus: h.previousStatus,
    newStatus: h.newStatus,
    changedBy: h.changedBy ? h.changedBy.toString() : null,
    changedByName: h.changedByName || 'Municipal Administrator',
    note: h.note || '',
    changedAt: h.changedAt || h.createdAt
  }));

  return {
    complaintId: complaint.complaintId,
    currentStatus: complaint.status,
    title: complaint.title,
    category: complaint.category,
    statusHistory: history,
    totalHistoryEntries: history.length
  };
};

/**
 * Service: Updates the resolution status of a complaint and appends an audit history entry
 * @param {string} rawComplaintId
 * @param {string} newStatus
 * @param {object} [options]
 * @param {string} [options.note]
 * @param {object} [options.adminUser]
 * @returns {Promise<object>}
 */
export const updateComplaintStatus = async (
  rawComplaintId,
  newStatus,
  { note = '', adminUser = null } = {}
) => {
  if (!rawComplaintId || typeof rawComplaintId !== 'string' || rawComplaintId.trim() === '') {
    const error = new Error('Please provide a valid complaint ID');
    error.statusCode = 400;
    throw error;
  }

  if (!newStatus || typeof newStatus !== 'string' || !ALLOWED_STATUSES.includes(newStatus.trim())) {
    const error = new Error(`Invalid status value. Allowed statuses: ${ALLOWED_STATUSES.join(', ')}`);
    error.statusCode = 400;
    throw error;
  }

  if (note !== undefined && note !== null) {
    if (typeof note !== 'string') {
      const error = new Error('Status note must be a valid text string');
      error.statusCode = 400;
      throw error;
    }
    if (note.trim().length > 500) {
      const error = new Error('Status note cannot exceed 500 characters');
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

  // Prevent duplicate history entry if status is unchanged
  if (complaint.status === validStatus) {
    return complaint.toAdminJSON ? complaint.toAdminJSON() : complaint.toPublicJSON();
  }

  // Record audit history entry atomically
  const previousStatus = complaint.status || 'Pending';
  const historyEntry = {
    previousStatus,
    newStatus: validStatus,
    changedBy: adminUser?._id || adminUser?.id || null,
    changedByName: adminUser?.name || 'Municipal Administrator',
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
      changedByName: adminUser?.name || 'Municipal Administrator'
    });
  } catch (notifyErr) {
    console.warn(`[Status Update] Notification warning for ${complaint.complaintId}:`, notifyErr.message);
  }

  return complaint.toAdminJSON ? complaint.toAdminJSON() : complaint.toPublicJSON();
};

export default {
  ALLOWED_STATUSES,
  getDashboardStatistics,
  getComplaintsForAdmin,
  getAdminComplaintDetails,
  getComplaintStatusHistory,
  updateComplaintStatus
};
