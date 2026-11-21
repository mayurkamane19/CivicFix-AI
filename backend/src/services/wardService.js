import mongoose from 'mongoose';
import { Ward } from '../models/Ward.js';
import { Complaint } from '../models/Complaint.js';
import { Department } from '../models/Department.js';
import { User } from '../models/User.js';
import { Feedback } from '../models/Feedback.js';
import { getDatabaseStatus } from '../config/db.js';
import { queueNotification } from './notificationService.js';

/**
 * Service: Creates a new municipal ward
 * @param {object} data
 * @returns {Promise<object>}
 */
export const createWard = async (data = {}) => {
  if (getDatabaseStatus() !== 'connected') {
    const error = new Error('Database service is currently unavailable. Please verify MongoDB connection.');
    error.statusCode = 503;
    throw error;
  }

  const {
    name,
    code,
    number,
    description = '',
    zone = 'Central Zone',
    municipality = 'City Municipal Corporation',
    center,
    boundaries,
    assignedDepartments = [],
    wardAdmin = null,
    population = 0,
    areaKm2 = 0
  } = data;

  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    const error = new Error('Ward name is required and must be at least 2 characters long');
    error.statusCode = 400;
    throw error;
  }

  if (!code || typeof code !== 'string' || code.trim().length < 2) {
    const error = new Error('Ward code is required and must be at least 2 characters long');
    error.statusCode = 400;
    throw error;
  }

  const parsedNumber = parseInt(number, 10);
  if (isNaN(parsedNumber) || parsedNumber < 1) {
    const error = new Error('Ward number is required and must be a positive integer');
    error.statusCode = 400;
    throw error;
  }

  const normalizedCode = code.trim().toUpperCase();

  // 1. Prevent duplicate ward code or number
  const existingCode = await Ward.findOne({ code: normalizedCode });
  if (existingCode) {
    const error = new Error(`Ward with code "${normalizedCode}" already exists`);
    error.statusCode = 409;
    throw error;
  }

  const existingNumber = await Ward.findOne({ number: parsedNumber });
  if (existingNumber) {
    const error = new Error(`Ward with number "${parsedNumber}" already exists`);
    error.statusCode = 409;
    throw error;
  }

  // 2. Validate center coordinates if provided
  let validatedCenter = { latitude: null, longitude: null };
  if (center && (center.latitude !== undefined || center.longitude !== undefined)) {
    const lat = Number(center.latitude);
    const lng = Number(center.longitude);
    if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      validatedCenter = { latitude: lat, longitude: lng };
    }
  }

  // 3. Create Ward
  const ward = new Ward({
    name: name.trim(),
    code: normalizedCode,
    number: parsedNumber,
    description: typeof description === 'string' ? description.trim() : '',
    zone: typeof zone === 'string' && zone.trim() ? zone.trim() : 'Central Zone',
    municipality: typeof municipality === 'string' && municipality.trim() ? municipality.trim() : 'City Municipal Corporation',
    center: validatedCenter,
    boundaries: boundaries || { type: 'None', coordinates: null, description: '' },
    assignedDepartments: Array.isArray(assignedDepartments) ? assignedDepartments : [],
    wardAdmin: wardAdmin && mongoose.Types.ObjectId.isValid(wardAdmin) ? wardAdmin : null,
    population: Number(population) || 0,
    areaKm2: Number(areaKm2) || 0,
    isActive: true
  });

  await ward.save();
  return ward.toSafeObject();
};

/**
 * Service: Retrieves paginated, filtered wards with real-time complaint counts
 * @param {object} options
 * @returns {Promise<object>}
 */
export const getWards = async ({
  search = '',
  zone = '',
  isActive = '',
  page = 1,
  limit = 10
} = {}) => {
  if (getDatabaseStatus() !== 'connected') {
    const error = new Error('Database service is currently unavailable. Please verify MongoDB connection.');
    error.statusCode = 503;
    throw error;
  }

  const filterQuery = {};

  if (search && typeof search === 'string' && search.trim() !== '') {
    const searchRegex = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filterQuery.$or = [
      { name: searchRegex },
      { code: searchRegex },
      { description: searchRegex }
    ];
  }

  if (zone && typeof zone === 'string' && zone.trim() !== '' && zone.trim().toLowerCase() !== 'all') {
    filterQuery.zone = zone.trim();
  }

  if (isActive !== undefined && isActive !== '' && isActive !== 'all') {
    filterQuery.isActive = isActive === 'true' || isActive === true;
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
  const skip = (pageNum - 1) * limitNum;

  const [total, wardsRaw] = await Promise.all([
    Ward.countDocuments(filterQuery),
    Ward.find(filterQuery)
      .populate('assignedDepartments', 'name code isActive')
      .populate('wardAdmin', 'name email role')
      .populate('assignedOfficers', 'name email role department')
      .sort({ number: 1 })
      .skip(skip)
      .limit(limitNum)
  ]);

  // Aggregate complaint counts per ward for real-time visibility
  const wardIds = wardsRaw.map((w) => w._id);
  const complaintStatsRaw = await Complaint.aggregate([
    { $match: { ward: { $in: wardIds } } },
    {
      $group: {
        _id: '$ward',
        total: { $sum: 1 },
        pending: { $sum: { $cond: [{ $eq: ['$status', 'Pending'] }, 1, 0] } },
        inProgress: { $sum: { $cond: [{ $eq: ['$status', 'In Progress'] }, 1, 0] } },
        resolved: { $sum: { $cond: [{ $eq: ['$status', 'Resolved'] }, 1, 0] } },
        reopened: { $sum: { $cond: [{ $eq: ['$status', 'Reopened'] }, 1, 0] } },
        overdue: { $sum: { $cond: [{ $in: ['$sla.status', ['Overdue', 'Resolved After SLA']] }, 1, 0] } }
      }
    }
  ]);

  const statsMap = new Map();
  for (const s of complaintStatsRaw) {
    statsMap.set(s._id.toString(), s);
  }

  const wards = wardsRaw.map((w) => {
    const safe = w.toSafeObject();
    const stats = statsMap.get(w._id.toString()) || {
      total: 0,
      pending: 0,
      inProgress: 0,
      resolved: 0,
      reopened: 0,
      overdue: 0
    };
    return {
      ...safe,
      stats: {
        totalComplaints: stats.total,
        pending: stats.pending,
        inProgress: stats.inProgress,
        resolved: stats.resolved,
        reopened: stats.reopened,
        overdue: stats.overdue,
        slaComplianceRate: stats.total > 0
          ? Math.round(((stats.total - stats.overdue) / stats.total) * 100)
          : 100
      }
    };
  });

  const totalPages = Math.ceil(total / limitNum) || 1;

  return {
    wards,
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
 * Service: Retrieves comprehensive ward details by ID
 * @param {string} id
 * @returns {Promise<object>}
 */
export const getWardById = async (id) => {
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    const error = new Error('Valid ward ID is required');
    error.statusCode = 400;
    throw error;
  }

  if (getDatabaseStatus() !== 'connected') {
    const error = new Error('Database service is currently unavailable. Please verify MongoDB connection.');
    error.statusCode = 503;
    throw error;
  }

  const ward = await Ward.findById(id)
    .populate('assignedDepartments', 'name code description isActive')
    .populate('wardAdmin', 'name email role')
    .populate({
      path: 'assignedOfficers',
      select: 'name email role department isActive',
      populate: { path: 'department', select: 'name code' }
    });

  if (!ward) {
    const error = new Error(`Ward not found with ID: ${id}`);
    error.statusCode = 404;
    throw error;
  }

  // Aggregate ward complaint metrics
  const [complaintCounts, categoryBreakdownRaw, recentComplaintsRaw] = await Promise.all([
    Complaint.aggregate([
      { $match: { ward: ward._id } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          pending: { $sum: { $cond: [{ $eq: ['$status', 'Pending'] }, 1, 0] } },
          inProgress: { $sum: { $cond: [{ $eq: ['$status', 'In Progress'] }, 1, 0] } },
          resolved: { $sum: { $cond: [{ $eq: ['$status', 'Resolved'] }, 1, 0] } },
          reopened: { $sum: { $cond: [{ $eq: ['$status', 'Reopened'] }, 1, 0] } },
          awaitingVerification: { $sum: { $cond: [{ $eq: ['$resolutionEvidence.status', 'Awaiting Citizen Verification'] }, 1, 0] } },
          overdue: { $sum: { $cond: [{ $in: ['$sla.status', ['Overdue', 'Resolved After SLA']] }, 1, 0] } },
          critical: { $sum: { $cond: [{ $in: ['$aiAnalysis.severity', ['High', 'Critical']] }, 1, 0] } }
        }
      }
    ]),
    Complaint.aggregate([
      { $match: { ward: ward._id } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]),
    Complaint.find({ ward: ward._id })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('complaintId title category status sla createdAt')
  ]);

  const metrics = complaintCounts[0] || {
    total: 0,
    pending: 0,
    inProgress: 0,
    resolved: 0,
    reopened: 0,
    awaitingVerification: 0,
    overdue: 0,
    critical: 0
  };

  const categories = {};
  for (const c of categoryBreakdownRaw) {
    if (c._id) categories[c._id] = c.count;
  }

  const safeWard = ward.toSafeObject();
  safeWard.officers = (ward.assignedOfficers || []).map((o) => ({
    id: o._id ? o._id.toString() : undefined,
    name: o.name,
    email: o.email,
    departmentName: o.department?.name || 'Unassigned',
    departmentCode: o.department?.code || null,
    isActive: o.isActive
  }));

  return {
    ward: safeWard,
    metrics: {
      totalComplaints: metrics.total,
      pending: metrics.pending,
      inProgress: metrics.inProgress,
      resolved: metrics.resolved,
      reopened: metrics.reopened,
      awaitingVerification: metrics.awaitingVerification,
      overdue: metrics.overdue,
      critical: metrics.critical,
      slaComplianceRate: metrics.total > 0
        ? Math.round(((metrics.total - metrics.overdue) / metrics.total) * 100)
        : 100,
      categories
    },
    recentComplaints: recentComplaintsRaw.map((c) => ({
      complaintId: c.complaintId,
      title: c.title,
      category: c.category,
      status: c.status,
      slaStatus: c.sla?.status || 'Not Started',
      createdAt: c.createdAt
    }))
  };
};

/**
 * Service: Updates ward attributes with validation
 * @param {string} id
 * @param {object} updates
 * @returns {Promise<object>}
 */
export const updateWard = async (id, updates = {}) => {
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    const error = new Error('Valid ward ID is required');
    error.statusCode = 400;
    throw error;
  }

  if (getDatabaseStatus() !== 'connected') {
    const error = new Error('Database service is currently unavailable. Please verify MongoDB connection.');
    error.statusCode = 503;
    throw error;
  }

  const ward = await Ward.findById(id);
  if (!ward) {
    const error = new Error(`Ward not found with ID: ${id}`);
    error.statusCode = 404;
    throw error;
  }

  if (updates.name !== undefined) {
    if (typeof updates.name !== 'string' || updates.name.trim().length < 2) {
      const error = new Error('Ward name must be at least 2 characters long');
      error.statusCode = 400;
      throw error;
    }
    ward.name = updates.name.trim();
  }

  if (updates.code !== undefined) {
    const newCode = updates.code.trim().toUpperCase();
    if (newCode !== ward.code) {
      const existing = await Ward.findOne({ code: newCode, _id: { $ne: ward._id } });
      if (existing) {
        const error = new Error(`Ward with code "${newCode}" already exists`);
        error.statusCode = 409;
        throw error;
      }
      ward.code = newCode;
    }
  }

  if (updates.number !== undefined) {
    const newNumber = parseInt(updates.number, 10);
    if (isNaN(newNumber) || newNumber < 1) {
      const error = new Error('Ward number must be a positive integer');
      error.statusCode = 400;
      throw error;
    }
    if (newNumber !== ward.number) {
      const existing = await Ward.findOne({ number: newNumber, _id: { $ne: ward._id } });
      if (existing) {
        const error = new Error(`Ward with number "${newNumber}" already exists`);
        error.statusCode = 409;
        throw error;
      }
      ward.number = newNumber;
    }
  }

  if (updates.description !== undefined) {
    ward.description = typeof updates.description === 'string' ? updates.description.trim() : '';
  }

  if (updates.zone !== undefined) {
    ward.zone = typeof updates.zone === 'string' && updates.zone.trim() ? updates.zone.trim() : ward.zone;
  }

  if (updates.center !== undefined && updates.center) {
    const lat = Number(updates.center.latitude);
    const lng = Number(updates.center.longitude);
    if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      ward.center = { latitude: lat, longitude: lng };
    }
  }

  if (updates.population !== undefined) {
    ward.population = Math.max(0, Number(updates.population) || 0);
  }

  if (updates.areaKm2 !== undefined) {
    ward.areaKm2 = Math.max(0, Number(updates.areaKm2) || 0);
  }

  if (updates.assignedDepartments !== undefined && Array.isArray(updates.assignedDepartments)) {
    ward.assignedDepartments = updates.assignedDepartments.filter((d) => mongoose.Types.ObjectId.isValid(d));
  }

  if (updates.wardAdmin !== undefined) {
    ward.wardAdmin = updates.wardAdmin && mongoose.Types.ObjectId.isValid(updates.wardAdmin) ? updates.wardAdmin : null;
  }

  await ward.save();
  return ward.toSafeObject();
};

/**
 * Service: Activates or deactivates a ward safely
 * @param {string} id
 * @param {boolean} isActive
 * @returns {Promise<object>}
 */
export const toggleWardStatus = async (id, isActive) => {
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    const error = new Error('Valid ward ID is required');
    error.statusCode = 400;
    throw error;
  }

  if (getDatabaseStatus() !== 'connected') {
    const error = new Error('Database service is currently unavailable. Please verify MongoDB connection.');
    error.statusCode = 503;
    throw error;
  }

  const ward = await Ward.findById(id);
  if (!ward) {
    const error = new Error(`Ward not found with ID: ${id}`);
    error.statusCode = 404;
    throw error;
  }

  const targetStatus = Boolean(isActive);
  ward.isActive = targetStatus;
  await ward.save();

  return {
    id: ward._id.toString(),
    code: ward.code,
    name: ward.name,
    isActive: ward.isActive,
    message: ward.isActive
      ? `Ward "${ward.name}" (${ward.code}) has been successfully activated.`
      : `Ward "${ward.name}" (${ward.code}) has been deactivated. New complaints cannot be assigned.`
  };
};

/**
 * Service: Deletes a ward ONLY if it has zero active complaints and zero assigned officers
 * @param {string} id
 * @returns {Promise<object>}
 */
export const deleteWard = async (id) => {
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    const error = new Error('Valid ward ID is required');
    error.statusCode = 400;
    throw error;
  }

  if (getDatabaseStatus() !== 'connected') {
    const error = new Error('Database service is currently unavailable. Please verify MongoDB connection.');
    error.statusCode = 503;
    throw error;
  }

  const ward = await Ward.findById(id);
  if (!ward) {
    const error = new Error(`Ward not found with ID: ${id}`);
    error.statusCode = 404;
    throw error;
  }

  // 1. Guard against deleting ward with existing complaints
  const complaintCount = await Complaint.countDocuments({ ward: ward._id });
  if (complaintCount > 0) {
    const error = new Error(
      `Cannot delete ward "${ward.name}" (${ward.code}): Ward contains ${complaintCount} existing complaints. Deactivate the ward or transfer complaints first.`
    );
    error.statusCode = 400;
    throw error;
  }

  // 2. Guard against deleting ward with assigned officers
  const officerCount = (ward.assignedOfficers || []).length;
  if (officerCount > 0) {
    const error = new Error(
      `Cannot delete ward "${ward.name}" (${ward.code}): Ward has ${officerCount} assigned officers. Reassign officers before deletion.`
    );
    error.statusCode = 400;
    throw error;
  }

  await Ward.findByIdAndDelete(ward._id);

  return {
    success: true,
    message: `Ward "${ward.name}" (${ward.code}) has been permanently deleted.`
  };
};

/**
 * Service: Assigns officers to a ward and links user.ward
 * @param {string} wardId
 * @param {Array<string>} officerIds
 * @param {object} adminUser
 * @returns {Promise<object>}
 */
export const assignOfficersToWard = async (wardId, officerIds = [], adminUser = null) => {
  if (!wardId || !mongoose.Types.ObjectId.isValid(wardId)) {
    const error = new Error('Valid ward ID is required');
    error.statusCode = 400;
    throw error;
  }

  if (!Array.isArray(officerIds) || officerIds.length === 0) {
    const error = new Error('At least one officer ID is required for assignment');
    error.statusCode = 400;
    throw error;
  }

  if (getDatabaseStatus() !== 'connected') {
    const error = new Error('Database service is currently unavailable. Please verify MongoDB connection.');
    error.statusCode = 503;
    throw error;
  }

  const ward = await Ward.findById(wardId);
  if (!ward) {
    const error = new Error(`Ward not found with ID: ${wardId}`);
    error.statusCode = 404;
    throw error;
  }

  const validOfficers = [];
  for (const oid of officerIds) {
    if (!mongoose.Types.ObjectId.isValid(oid)) continue;
    const user = await User.findById(oid);
    if (!user || user.role !== 'officer' || !user.isActive) continue;

    user.ward = ward._id;
    await user.save();
    validOfficers.push(user._id);

    // Queue in-app notification for the officer
    try {
      await queueNotification({
        recipientUser: user._id,
        eventType: 'OFFICER_WARD_ASSIGNED',
        title: `Assigned to Ward: ${ward.name}`,
        message: `You have been assigned to ${ward.name} (${ward.code}), ${ward.zone} by ${adminUser?.name || 'Municipal Administrator'}.`,
        priority: 'Medium',
        actionUrl: '/officer'
      });
    } catch {
      // Non-blocking notification
    }
  }

  // Update ward officers preventing duplicates
  const currentSet = new Set((ward.assignedOfficers || []).map((id) => id.toString()));
  for (const vId of validOfficers) {
    currentSet.add(vId.toString());
  }

  ward.assignedOfficers = Array.from(currentSet).map((id) => new mongoose.Types.ObjectId(id));
  await ward.save();

  return {
    wardId: ward._id.toString(),
    wardName: ward.name,
    assignedCount: validOfficers.length,
    totalOfficers: ward.assignedOfficers.length
  };
};

/**
 * Service: Removes an officer from ward assignment safely
 * @param {string} wardId
 * @param {string} officerId
 * @returns {Promise<object>}
 */
export const removeOfficerFromWard = async (wardId, officerId) => {
  if (!wardId || !mongoose.Types.ObjectId.isValid(wardId) || !officerId || !mongoose.Types.ObjectId.isValid(officerId)) {
    const error = new Error('Valid ward ID and officer ID are required');
    error.statusCode = 400;
    throw error;
  }

  if (getDatabaseStatus() !== 'connected') {
    const error = new Error('Database service is currently unavailable. Please verify MongoDB connection.');
    error.statusCode = 503;
    throw error;
  }

  const ward = await Ward.findById(wardId);
  if (!ward) {
    const error = new Error(`Ward not found with ID: ${wardId}`);
    error.statusCode = 404;
    throw error;
  }

  // Remove from ward array
  ward.assignedOfficers = (ward.assignedOfficers || []).filter(
    (id) => id.toString() !== officerId.toString()
  );
  await ward.save();

  // Clear officer user record ward
  const officer = await User.findById(officerId);
  if (officer && officer.ward && officer.ward.toString() === wardId.toString()) {
    officer.ward = null;
    await officer.save();
  }

  return {
    success: true,
    message: `Officer successfully unassigned from Ward "${ward.name}".`
  };
};

/**
 * Service: Assigns departments to a ward
 * @param {string} wardId
 * @param {Array<string>} departmentIds
 * @returns {Promise<object>}
 */
export const assignDepartmentsToWard = async (wardId, departmentIds = []) => {
  if (!wardId || !mongoose.Types.ObjectId.isValid(wardId)) {
    const error = new Error('Valid ward ID is required');
    error.statusCode = 400;
    throw error;
  }

  if (!Array.isArray(departmentIds)) {
    const error = new Error('Department IDs must be an array');
    error.statusCode = 400;
    throw error;
  }

  if (getDatabaseStatus() !== 'connected') {
    const error = new Error('Database service is currently unavailable. Please verify MongoDB connection.');
    error.statusCode = 503;
    throw error;
  }

  const ward = await Ward.findById(wardId);
  if (!ward) {
    const error = new Error(`Ward not found with ID: ${wardId}`);
    error.statusCode = 404;
    throw error;
  }

  const validDepts = [];
  for (const deptId of departmentIds) {
    if (!mongoose.Types.ObjectId.isValid(deptId)) continue;
    const dept = await Department.findById(deptId);
    if (dept && dept.isActive) {
      validDepts.push(dept._id);
    }
  }

  ward.assignedDepartments = validDepts;
  await ward.save();

  return {
    wardId: ward._id.toString(),
    wardName: ward.name,
    assignedDepartmentsCount: validDepts.length
  };
};

/**
 * Service: Controlled Inter-Ward Complaint Transfer
 * Transfers a complaint from its current ward to a destination ward.
 * Preserves original complaint history and SLA deadlines.
 * @param {string} rawComplaintId
 * @param {object} params
 * @param {string} params.destinationWardId
 * @param {string} [params.destinationDepartmentId]
 * @param {string} params.reason
 * @param {object} params.adminUser
 * @returns {Promise<object>}
 */
export const transferComplaintBetweenWards = async (
  rawComplaintId,
  { destinationWardId, destinationDepartmentId = null, reason = '', adminUser = null } = {}
) => {
  if (!rawComplaintId || typeof rawComplaintId !== 'string' || rawComplaintId.trim() === '') {
    const error = new Error('Please provide a valid complaint ID');
    error.statusCode = 400;
    throw error;
  }

  if (!destinationWardId || !mongoose.Types.ObjectId.isValid(destinationWardId)) {
    const error = new Error('A valid destination ward ID is required for transfer');
    error.statusCode = 400;
    throw error;
  }

  if (!reason || typeof reason !== 'string' || reason.trim().length < 10) {
    const error = new Error('A mandatory transfer reason of at least 10 characters is required');
    error.statusCode = 400;
    throw error;
  }

  if (reason.trim().length > 1000) {
    const error = new Error('Transfer reason cannot exceed 1000 characters');
    error.statusCode = 400;
    throw error;
  }

  if (getDatabaseStatus() !== 'connected') {
    const error = new Error('Database service is currently unavailable. Please verify MongoDB connection.');
    error.statusCode = 503;
    throw error;
  }

  const trimmedId = rawComplaintId.trim();

  // 1. Locate Complaint
  const complaint = await Complaint.findOne({ complaintId: trimmedId });
  if (!complaint) {
    const error = new Error(`Complaint not found with ID: ${trimmedId}`);
    error.statusCode = 404;
    throw error;
  }

  // 2. Validate Destination Ward
  const destWard = await Ward.findById(destinationWardId);
  if (!destWard) {
    const error = new Error(`Destination ward not found with ID: ${destinationWardId}`);
    error.statusCode = 404;
    throw error;
  }

  if (!destWard.isActive) {
    const error = new Error(`Cannot transfer complaint to inactive ward "${destWard.name}" (${destWard.code})`);
    error.statusCode = 400;
    throw error;
  }

  // Check if complaint is already in destination ward
  if (complaint.ward && complaint.ward.toString() === destWard._id.toString()) {
    const error = new Error(`Complaint is already assigned to Ward "${destWard.name}" (${destWard.code})`);
    error.statusCode = 400;
    throw error;
  }

  // 3. Validate Destination Department (optional)
  let destDept = null;
  if (destinationDepartmentId) {
    if (!mongoose.Types.ObjectId.isValid(destinationDepartmentId)) {
      const error = new Error('Invalid destination department ID');
      error.statusCode = 400;
      throw error;
    }
    destDept = await Department.findById(destinationDepartmentId);
    if (!destDept || !destDept.isActive) {
      const error = new Error('Destination department not found or is inactive');
      error.statusCode = 400;
      throw error;
    }
  }

  // Capture previous details
  const prevWardId = complaint.ward || null;
  const prevWardName = complaint.wardName || 'Unassigned Ward';
  const prevWardCode = complaint.wardCode || null;
  const prevDeptId = complaint.assignedDepartment || null;
  const prevDeptName = complaint.assignedDepartmentName || null;

  // 4. Construct Ward Transfer History Record
  const transferRecord = {
    previousWard: prevWardId,
    previousWardName: prevWardName,
    previousWardCode: prevWardCode,
    destinationWard: destWard._id,
    destinationWardName: destWard.name,
    destinationWardCode: destWard.code,
    previousDepartment: prevDeptId,
    previousDepartmentName: prevDeptName,
    destinationDepartment: destDept ? destDept._id : prevDeptId,
    destinationDepartmentName: destDept ? destDept.name : prevDeptName,
    transferredBy: adminUser?._id || new mongoose.Types.ObjectId(),
    transferredByName: adminUser?.name || 'Municipal Administrator',
    reason: reason.trim(),
    transferredAt: new Date()
  };

  // 5. Update Complaint Ward & Department
  complaint.ward = destWard._id;
  complaint.wardName = destWard.name;
  complaint.wardCode = destWard.code;

  if (destDept) {
    complaint.assignedDepartment = destDept._id;
    complaint.assignedDepartmentName = destDept.name;
  }

  // Safe officer handling: if previous officer is not assigned to destination ward, unassign officer
  if (complaint.assignedOfficer) {
    const officerInDest = (destWard.assignedOfficers || []).some(
      (oId) => oId.toString() === complaint.assignedOfficer.toString()
    );
    if (!officerInDest) {
      complaint.assignedOfficer = null;
      complaint.assignedOfficerName = null;
    }
  }

  complaint.wardTransferHistory = complaint.wardTransferHistory || [];
  complaint.wardTransferHistory.push(transferRecord);

  // CRITICAL SLA REQUIREMENT: Preserve SLA Deadline strictly without resetting or extending
  // complaint.sla remains untouched!

  await complaint.save();

  // 6. Notify Affected Parties via Unified Notification Center
  try {
    // Notify Citizen if complaint is linked to an account
    if (complaint.reportedBy) {
      await queueNotification({
        recipientUser: complaint.reportedBy,
        eventType: 'WARD_TRANSFER',
        title: `Complaint Transferred: ${complaint.complaintId}`,
        message: `Your issue has been transferred to ${destWard.name} (${destWard.code}) for municipal jurisdiction resolution.`,
        complaintId: complaint.complaintId,
        priority: 'Medium',
        actionUrl: `/track?id=${complaint.complaintId}`
      });
    }

    // Notify Ward Administrator of destination ward if set
    if (destWard.wardAdmin) {
      await queueNotification({
        recipientUser: destWard.wardAdmin,
        eventType: 'WARD_TRANSFER',
        title: `New Inter-Ward Transfer Received: ${complaint.complaintId}`,
        message: `Complaint ${complaint.complaintId} ("${complaint.title}") transferred from ${prevWardName} to ${destWard.name}. Reason: ${reason.trim()}`,
        complaintId: complaint.complaintId,
        priority: 'High',
        actionUrl: `/admin`
      });
    }
  } catch {
    // Non-blocking notification dispatch
  }

  return {
    complaintId: complaint.complaintId,
    previousWard: {
      id: prevWardId ? prevWardId.toString() : null,
      name: prevWardName,
      code: prevWardCode
    },
    destinationWard: {
      id: destWard._id.toString(),
      name: destWard.name,
      code: destWard.code
    },
    transferredBy: transferRecord.transferredByName,
    reason: transferRecord.reason,
    transferredAt: transferRecord.transferredAt,
    slaPreserved: true,
    currentSlaStatus: complaint.sla?.status || 'Not Started',
    deadline: complaint.sla?.deadline || null
  };
};

/**
 * Service: Retrieves city-wide multi-ward operational statistics
 * @returns {Promise<object>}
 */
export const getMunicipalOverviewStats = async () => {
  if (getDatabaseStatus() !== 'connected') {
    const error = new Error('Database service is currently unavailable. Please verify MongoDB connection.');
    error.statusCode = 503;
    throw error;
  }

  const [
    totalWards,
    activeWards,
    inactiveWards,
    totalComplaints,
    pendingComplaints,
    inProgressComplaints,
    resolvedComplaints,
    reopenedComplaints,
    awaitingVerification,
    slaBreachedComplaints,
    allWardsRaw,
    wardStatsAggregation,
    recentTransfersRaw
  ] = await Promise.all([
    Ward.countDocuments({}),
    Ward.countDocuments({ isActive: true }),
    Ward.countDocuments({ isActive: false }),
    Complaint.countDocuments({}),
    Complaint.countDocuments({ status: 'Pending' }),
    Complaint.countDocuments({ status: 'In Progress' }),
    Complaint.countDocuments({ status: 'Resolved' }),
    Complaint.countDocuments({ status: 'Reopened' }),
    Complaint.countDocuments({ 'resolutionEvidence.status': 'Awaiting Citizen Verification' }),
    Complaint.countDocuments({ 'sla.status': { $in: ['Overdue', 'Resolved After SLA'] } }),
    Ward.find({}).sort({ number: 1 }).select('name code number zone isActive assignedOfficers population areaKm2'),
    Complaint.aggregate([
      {
        $group: {
          _id: '$ward',
          total: { $sum: 1 },
          pending: { $sum: { $cond: [{ $eq: ['$status', 'Pending'] }, 1, 0] } },
          inProgress: { $sum: { $cond: [{ $eq: ['$status', 'In Progress'] }, 1, 0] } },
          resolved: { $sum: { $cond: [{ $eq: ['$status', 'Resolved'] }, 1, 0] } },
          reopened: { $sum: { $cond: [{ $eq: ['$status', 'Reopened'] }, 1, 0] } },
          overdue: { $sum: { $cond: [{ $in: ['$sla.status', ['Overdue', 'Resolved After SLA']] }, 1, 0] } }
        }
      }
    ]),
    Complaint.find({ 'wardTransferHistory.0': { $exists: true } })
      .sort({ updatedAt: -1 })
      .limit(5)
      .select('complaintId title wardName wardCode wardTransferHistory')
  ]);

  const statsMap = new Map();
  for (const item of wardStatsAggregation) {
    if (item._id) {
      statsMap.set(item._id.toString(), item);
    }
  }

  const wardComparison = allWardsRaw.map((w) => {
    const s = statsMap.get(w._id.toString()) || {
      total: 0,
      pending: 0,
      inProgress: 0,
      resolved: 0,
      reopened: 0,
      overdue: 0
    };
    return {
      wardId: w._id.toString(),
      wardCode: w.code,
      wardName: w.name,
      wardNumber: w.number,
      zone: w.zone,
      isActive: w.isActive,
      officerCount: (w.assignedOfficers || []).length,
      totalComplaints: s.total,
      pending: s.pending,
      inProgress: s.inProgress,
      resolved: s.resolved,
      reopened: s.reopened,
      overdue: s.overdue,
      slaComplianceRate: s.total > 0
        ? Math.round(((s.total - s.overdue) / s.total) * 100)
        : 100
    };
  });

  // Recent transfer events for municipal activity log
  const recentTransfers = [];
  for (const c of recentTransfersRaw) {
    const latest = c.wardTransferHistory[c.wardTransferHistory.length - 1];
    if (latest) {
      recentTransfers.push({
        complaintId: c.complaintId,
        title: c.title,
        fromWard: latest.previousWardName,
        toWard: latest.destinationWardName,
        transferredBy: latest.transferredByName,
        reason: latest.reason,
        transferredAt: latest.transferredAt
      });
    }
  }

  const overallSlaCompliance = totalComplaints > 0
    ? Math.round(((totalComplaints - slaBreachedComplaints) / totalComplaints) * 100)
    : 100;

  return {
    kpi: {
      totalWards,
      activeWards,
      inactiveWards,
      totalComplaints,
      pendingComplaints,
      inProgressComplaints,
      resolvedComplaints,
      reopenedComplaints,
      awaitingVerification,
      slaBreachedComplaints,
      overallSlaCompliance
    },
    wardComparison,
    recentTransfers
  };
};

/**
 * Service: Retrieves ward-specific analytics and feedback metrics
 * @param {string} wardId
 * @param {object} options
 * @returns {Promise<object>}
 */
export const getWardAnalytics = async (wardId, { startDate = '', endDate = '' } = {}) => {
  if (!wardId || !mongoose.Types.ObjectId.isValid(wardId)) {
    const error = new Error('Valid ward ID is required');
    error.statusCode = 400;
    throw error;
  }

  if (getDatabaseStatus() !== 'connected') {
    const error = new Error('Database service is currently unavailable. Please verify MongoDB connection.');
    error.statusCode = 503;
    throw error;
  }

  const ward = await Ward.findById(wardId);
  if (!ward) {
    const error = new Error(`Ward not found with ID: ${wardId}`);
    error.statusCode = 404;
    throw error;
  }

  const matchQuery = { ward: ward._id };
  if (startDate || endDate) {
    matchQuery.createdAt = {};
    if (startDate) matchQuery.createdAt.$gte = new Date(startDate);
    if (endDate) matchQuery.createdAt.$lte = new Date(endDate);
  }

  const [
    categoryAggregation,
    departmentAggregation,
    statusAggregation,
    slaAggregation,
    feedbackAggregation
  ] = await Promise.all([
    Complaint.aggregate([
      { $match: matchQuery },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]),
    Complaint.aggregate([
      { $match: matchQuery },
      { $group: { _id: '$assignedDepartmentName', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]),
    Complaint.aggregate([
      { $match: matchQuery },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]),
    Complaint.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          overdue: { $sum: { $cond: [{ $in: ['$sla.status', ['Overdue', 'Resolved After SLA']] }, 1, 0] } },
          avgResolutionHours: {
            $avg: {
              $cond: [
                { $and: [{ $ne: ['$sla.resolvedAt', null] }, { $ne: ['$createdAt', null] }] },
                { $divide: [{ $subtract: ['$sla.resolvedAt', '$createdAt'] }, 3600000] },
                null
              ]
            }
          }
        }
      }
    ]),
    Feedback.aggregate([
      {
        $lookup: {
          from: 'complaints',
          localField: 'complaint',
          foreignField: '_id',
          as: 'complaintDoc'
        }
      },
      { $unwind: '$complaintDoc' },
      { $match: { 'complaintDoc.ward': ward._id } },
      {
        $group: {
          _id: null,
          totalFeedback: { $sum: 1 },
          avgRating: { $avg: '$rating' }
        }
      }
    ])
  ]);

  const categories = {};
  for (const c of categoryAggregation) {
    if (c._id) categories[c._id] = c.count;
  }

  const departments = {};
  for (const d of departmentAggregation) {
    departments[d._id || 'Unassigned'] = d.count;
  }

  const statuses = {};
  for (const s of statusAggregation) {
    statuses[s._id] = s.count;
  }

  const slaData = slaAggregation[0] || { total: 0, overdue: 0, avgResolutionHours: 0 };
  const feedbackData = feedbackAggregation[0] || { totalFeedback: 0, avgRating: 0 };

  return {
    ward: {
      id: ward._id.toString(),
      code: ward.code,
      name: ward.name,
      zone: ward.zone
    },
    categories,
    departments,
    statuses,
    performance: {
      total: slaData.total,
      overdue: slaData.overdue,
      slaComplianceRate: slaData.total > 0
        ? Math.round(((slaData.total - slaData.overdue) / slaData.total) * 100)
        : 100,
      avgResolutionHours: slaData.avgResolutionHours ? Math.round(slaData.avgResolutionHours * 10) / 10 : 0
    },
    citizenFeedback: {
      totalFeedback: feedbackData.totalFeedback,
      avgRating: feedbackData.avgRating ? Math.round(feedbackData.avgRating * 10) / 10 : 0
    }
  };
};

/**
 * Service: Generates administrative CSV export of complaints across wards
 * @param {object} options
 * @returns {Promise<string>}
 */
export const exportMunicipalWardCsv = async ({ wardId = null, startDate = '', endDate = '' } = {}) => {
  if (getDatabaseStatus() !== 'connected') {
    const error = new Error('Database service is currently unavailable. Please verify MongoDB connection.');
    error.statusCode = 503;
    throw error;
  }

  const query = {};
  if (wardId && mongoose.Types.ObjectId.isValid(wardId)) {
    query.ward = wardId;
  }

  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }

  const complaints = await Complaint.find(query)
    .populate('ward', 'code name zone')
    .sort({ createdAt: -1 })
    .limit(1000);

  const headers = [
    'Ticket ID',
    'Title',
    'Category',
    'Ward Code',
    'Ward Name',
    'Zone',
    'Status',
    'Priority',
    'SLA Status',
    'Created At',
    'Resolved At'
  ];

  const escapeCsv = (val) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = complaints.map((c) => [
    escapeCsv(c.complaintId),
    escapeCsv(c.title),
    escapeCsv(c.category),
    escapeCsv(c.ward?.code || c.wardCode || 'N/A'),
    escapeCsv(c.ward?.name || c.wardName || 'Unassigned'),
    escapeCsv(c.ward?.zone || 'N/A'),
    escapeCsv(c.status),
    escapeCsv(c.sla?.priority || 'Medium'),
    escapeCsv(c.sla?.status || 'Not Started'),
    escapeCsv(c.createdAt ? new Date(c.createdAt).toISOString() : ''),
    escapeCsv(c.sla?.resolvedAt ? new Date(c.sla.resolvedAt).toISOString() : '')
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
};
