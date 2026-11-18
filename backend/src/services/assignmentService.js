import mongoose from 'mongoose';
import { Complaint } from '../models/Complaint.js';
import { Department } from '../models/Department.js';
import { User } from '../models/User.js';
import { getDatabaseStatus } from '../config/db.js';
import { notifyDepartmentAssigned, notifyOfficerAssigned } from './notificationService.js';

/**
 * Service: Retrieves officers for administrative assignment
 * @param {object} options
 * @param {string} [options.departmentId]
 * @returns {Promise<Array<object>>}
 */
export const getOfficersForAdmin = async ({ departmentId = null } = {}) => {
  if (getDatabaseStatus() !== 'connected') {
    const error = new Error('Database service is currently unavailable. Please verify MongoDB connection.');
    error.statusCode = 503;
    throw error;
  }

  const query = { role: 'officer' };
  if (departmentId && mongoose.Types.ObjectId.isValid(departmentId)) {
    query.department = departmentId;
  }

  const officers = await User.find(query)
    .populate('department', 'name code isActive')
    .select('-password')
    .sort({ name: 1 });

  return officers.map((officer) => ({
    id: officer._id.toString(),
    name: officer.name,
    email: officer.email,
    role: officer.role,
    isActive: officer.isActive,
    department: officer.department?._id?.toString() || null,
    departmentName: officer.department?.name || 'Unassigned',
    departmentCode: officer.department?.code || null,
    createdAt: officer.createdAt
  }));
};

/**
 * Service: Assigns or reassigns a complaint to a municipal department and optional field officer
 * @param {string} rawComplaintId
 * @param {object} params
 * @param {string} params.departmentId
 * @param {string} [params.officerId]
 * @param {string} [params.note]
 * @param {object} params.adminUser
 * @returns {Promise<object>}
 */
export const assignComplaint = async (
  rawComplaintId,
  { departmentId, officerId = null, note = '', adminUser = null } = {}
) => {
  if (!rawComplaintId || typeof rawComplaintId !== 'string' || rawComplaintId.trim() === '') {
    const error = new Error('Please provide a valid complaint ID');
    error.statusCode = 400;
    throw error;
  }

  if (!departmentId || !mongoose.Types.ObjectId.isValid(departmentId)) {
    const error = new Error('A valid department ID is required for assignment');
    error.statusCode = 400;
    throw error;
  }

  if (note !== undefined && note !== null) {
    if (typeof note !== 'string') {
      const error = new Error('Assignment note must be a valid text string');
      error.statusCode = 400;
      throw error;
    }
    if (note.trim().length > 500) {
      const error = new Error('Assignment note cannot exceed 500 characters');
      error.statusCode = 400;
      throw error;
    }
  }

  if (getDatabaseStatus() !== 'connected') {
    const error = new Error('Database service is currently unavailable. Please verify MongoDB connection.');
    error.statusCode = 503;
    throw error;
  }

  const trimmedComplaintId = rawComplaintId.trim();
  const trimmedNote = typeof note === 'string' ? note.trim() : '';

  // 1. Locate the complaint
  const complaint = await Complaint.findOne({ complaintId: trimmedComplaintId });
  if (!complaint) {
    const error = new Error(`Complaint not found with ID: ${trimmedComplaintId}`);
    error.statusCode = 404;
    throw error;
  }

  // 2. Validate Target Department
  const department = await Department.findById(departmentId);
  if (!department) {
    const error = new Error(`Department not found with ID: ${departmentId}`);
    error.statusCode = 404;
    throw error;
  }

  if (!department.isActive) {
    const error = new Error(`Cannot assign to inactive department "${department.name}" (${department.code})`);
    error.statusCode = 400;
    throw error;
  }

  // 3. Validate Officer (if supplied)
  let officer = null;
  if (officerId) {
    if (!mongoose.Types.ObjectId.isValid(officerId)) {
      const error = new Error('Please provide a valid officer ID');
      error.statusCode = 400;
      throw error;
    }

    officer = await User.findById(officerId);
    if (!officer) {
      const error = new Error(`Officer not found with ID: ${officerId}`);
      error.statusCode = 404;
      throw error;
    }

    if (officer.role !== 'officer') {
      const error = new Error(`User "${officer.name}" is not an officer (role: ${officer.role})`);
      error.statusCode = 400;
      throw error;
    }

    if (!officer.isActive) {
      const error = new Error(`Cannot assign to inactive officer "${officer.name}"`);
      error.statusCode = 400;
      throw error;
    }

    // Ensure officer belongs to the selected department
    if (!officer.department || officer.department.toString() !== department._id.toString()) {
      const error = new Error(
        `Officer "${officer.name}" does not belong to the selected department "${department.name}"`
      );
      error.statusCode = 400;
      throw error;
    }
  }

  // 4. Capture Previous State
  const previousDepartment = complaint.assignedDepartment || null;
  const previousDepartmentName = complaint.assignedDepartmentName || null;
  const previousOfficer = complaint.assignedOfficer || null;
  const previousOfficerName = complaint.assignedOfficerName || null;

  // 5. Construct Atomic Assignment History Entry
  const assignmentEntry = {
    previousDepartment,
    previousDepartmentName,
    newDepartment: department._id,
    newDepartmentName: department.name,
    previousOfficer,
    previousOfficerName,
    newOfficer: officer ? officer._id : null,
    newOfficerName: officer ? officer.name : null,
    assignedBy: adminUser?._id || adminUser?.id,
    assignedByName: adminUser?.name || 'Municipal Administrator',
    note: trimmedNote,
    assignedAt: new Date()
  };

  // 6. Update Complaint
  if (!complaint.assignmentHistory) {
    complaint.assignmentHistory = [];
  }
  complaint.assignmentHistory.push(assignmentEntry);

  complaint.assignedDepartment = department._id;
  complaint.assignedDepartmentName = department.name;
  complaint.assignedOfficer = officer ? officer._id : null;
  complaint.assignedOfficerName = officer ? officer.name : null;
  complaint.assignedAt = new Date();
  complaint.assignedBy = adminUser?._id || adminUser?.id || null;

  await complaint.save();

  // Trigger departmental assignment notification to citizen (if department changed)
  const isDeptChanged = !previousDepartment || previousDepartment.toString() !== department._id.toString();
  if (isDeptChanged) {
    try {
      await notifyDepartmentAssigned(complaint, { departmentName: department.name });
    } catch (deptErr) {
      console.warn(`[Assignment] Department notification warning for ${complaint.complaintId}:`, deptErr.message);
    }
  }

  // Trigger field officer assignment notification to assigned officer (if officer assigned/changed)
  const isOfficerChanged = officer && (!previousOfficer || previousOfficer.toString() !== officer._id.toString());
  if (isOfficerChanged) {
    try {
      await notifyOfficerAssigned(complaint, {
        officer,
        departmentName: department.name,
        note: trimmedNote
      });
    } catch (offErr) {
      console.warn(`[Assignment] Officer notification warning for ${complaint.complaintId}:`, offErr.message);
    }
  }

  return complaint.toAdminJSON ? complaint.toAdminJSON() : complaint.toPublicJSON();
};

/**
 * Service: Retrieves chronological assignment history for a complaint
 * @param {string} rawComplaintId
 * @returns {Promise<object>}
 */
export const getComplaintAssignmentHistory = async (rawComplaintId) => {
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

  const history = (complaint.assignmentHistory || []).map((a) => ({
    id: a._id ? a._id.toString() : undefined,
    previousDepartment: a.previousDepartment ? a.previousDepartment.toString() : null,
    previousDepartmentName: a.previousDepartmentName || null,
    newDepartment: a.newDepartment ? a.newDepartment.toString() : null,
    newDepartmentName: a.newDepartmentName,
    previousOfficer: a.previousOfficer ? a.previousOfficer.toString() : null,
    previousOfficerName: a.previousOfficerName || null,
    newOfficer: a.newOfficer ? a.newOfficer.toString() : null,
    newOfficerName: a.newOfficerName || null,
    assignedBy: a.assignedBy ? a.assignedBy.toString() : null,
    assignedByName: a.assignedByName || 'Municipal Administrator',
    note: a.note || '',
    assignedAt: a.assignedAt
  }));

  return {
    complaintId: complaint.complaintId,
    title: complaint.title,
    currentDepartment: complaint.assignedDepartmentName || null,
    currentOfficer: complaint.assignedOfficerName || null,
    assignmentHistory: history,
    totalAssignmentEntries: history.length
  };
};

export default {
  getOfficersForAdmin,
  assignComplaint,
  getComplaintAssignmentHistory
};
