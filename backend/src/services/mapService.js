import mongoose from 'mongoose';
import { Complaint } from '../models/Complaint.js';
import { getDatabaseStatus } from '../config/db.js';

/**
 * Validates geographic coordinate bounds
 * @param {number|string} lat
 * @param {number|string} lng
 * @returns {boolean}
 */
export const validateCoordinates = (lat, lng) => {
  if (lat === null || lat === undefined || lng === null || lng === undefined) {
    return false;
  }
  const numLat = Number(lat);
  const numLng = Number(lng);
  if (isNaN(numLat) || isNaN(numLng)) {
    return false;
  }
  if (numLat < -90 || numLat > 90) {
    return false;
  }
  if (numLng < -180 || numLng > 180) {
    return false;
  }
  return true;
};

/**
 * Public Location Privacy Strategy:
 * Rounds geographic coordinates to 3 decimal places (~100m street-level approximation)
 * to prevent leaking exact residential addresses or private home footprints.
 * Original coordinates remain preserved in the secure operational database.
 * @param {number|string} coord
 * @param {number} [decimals=3]
 * @returns {number|null}
 */
export const approximateCoordinate = (coord, decimals = 3) => {
  if (coord === null || coord === undefined) return null;
  const num = Number(coord);
  if (isNaN(num)) return null;
  const factor = Math.pow(10, decimals);
  return Math.round(num * factor) / factor;
};

/**
 * Service: Retrieves complaint locations for municipal administrators
 * Returns precise coordinates, AI analysis, department assignments, and operational filters
 * @param {object} queryOptions
 * @returns {Promise<Array<object>>}
 */
export const getAdminMapComplaints = async ({
  category = '',
  status = '',
  severity = '',
  department = '',
  officer = '',
  ward = '',
  startDate = '',
  endDate = '',
  limit = 500
} = {}) => {
  if (getDatabaseStatus() !== 'connected') {
    const error = new Error('Database service is currently unavailable. Please verify MongoDB connection.');
    error.statusCode = 503;
    throw error;
  }

  // Base Query: Only include records with valid geographic coordinates
  const filterQuery = {
    'location.latitude': { $ne: null, $gte: -90, $lte: 90 },
    'location.longitude': { $ne: null, $gte: -180, $lte: 180 }
  };

  // Category Filter
  if (category && typeof category === 'string' && category.trim() !== '' && category.trim().toLowerCase() !== 'all') {
    filterQuery.category = category.trim();
  }

  // Status Filter
  if (status && typeof status === 'string' && status.trim() !== '' && status.trim().toLowerCase() !== 'all') {
    filterQuery.status = status.trim();
  }

  // AI Severity Filter
  if (severity && typeof severity === 'string' && severity.trim() !== '' && severity.trim().toLowerCase() !== 'all') {
    filterQuery['aiAnalysis.severity'] = severity.trim();
  }

  // Department Filter
  if (department && typeof department === 'string' && department.trim() !== '' && department.trim().toLowerCase() !== 'all') {
    if (mongoose.Types.ObjectId.isValid(department.trim())) {
      filterQuery.assignedDepartment = department.trim();
    }
  }

  // Officer Filter
  if (officer && typeof officer === 'string' && officer.trim() !== '' && officer.trim().toLowerCase() !== 'all') {
    if (mongoose.Types.ObjectId.isValid(officer.trim())) {
      filterQuery.assignedOfficer = officer.trim();
    }
  }

  // Ward Filter
  if (ward && typeof ward === 'string' && ward.trim() !== '' && ward.trim().toLowerCase() !== 'all') {
    if (mongoose.Types.ObjectId.isValid(ward.trim())) {
      filterQuery.ward = ward.trim();
    }
  }

  // Date Range Filters
  if (startDate || endDate) {
    filterQuery.createdAt = {};
    if (startDate) {
      const parsedStart = new Date(startDate);
      if (!isNaN(parsedStart.getTime())) {
        filterQuery.createdAt.$gte = parsedStart;
      }
    }
    if (endDate) {
      const parsedEnd = new Date(endDate);
      if (!isNaN(parsedEnd.getTime())) {
        // Include up to end of the selected day
        parsedEnd.setHours(23, 59, 59, 999);
        filterQuery.createdAt.$lte = parsedEnd;
      }
    }
  }

  const safeLimit = Math.min(1000, Math.max(1, parseInt(limit, 10) || 500));

  const complaints = await Complaint.find(filterQuery)
    .populate('assignedDepartment', 'name code')
    .populate('assignedOfficer', 'name')
    .populate('ward', 'name code number zone')
    .sort({ createdAt: -1 })
    .limit(safeLimit);

  return complaints
    .filter((c) => validateCoordinates(c.location?.latitude, c.location?.longitude))
    .map((c) => ({
      complaintId: c.complaintId,
    title: c.title,
    description: c.description,
    category: c.category,
    status: c.status,
    address: c.location?.address || '',
    latitude: c.location.latitude,
    longitude: c.location.longitude,
    imageUrl: c.imageUrl || '',
    wardId: c.ward?._id ? c.ward._id.toString() : (c.ward ? c.ward.toString() : null),
    wardName: c.ward?.name || c.wardName || 'Unassigned',
    wardCode: c.ward?.code || c.wardCode || null,
    aiAnalysis: {
      status: c.aiAnalysis?.status || 'Pending',
      severity: c.aiAnalysis?.severity || null,
      summary: c.aiAnalysis?.summary || '',
      suggestedAction: c.aiAnalysis?.suggestedAction || '',
      recommendedDepartment: c.aiAnalysis?.recommendedDepartment || ''
    },
    assignedDepartmentName: c.assignedDepartment?.name || c.assignedDepartmentName || null,
    assignedDepartmentCode: c.assignedDepartment?.code || null,
    assignedOfficerName: c.assignedOfficer?.name || c.assignedOfficerName || null,
    assignedAt: c.assignedAt || null,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt
  }));
};

/**
 * Service: Retrieves complaint locations assigned to an authenticated field officer
 * Enforces strict ownership scoping (IDOR Protection)
 * @param {string} officerId
 * @param {object} queryOptions
 * @returns {Promise<Array<object>>}
 */
export const getOfficerMapComplaints = async (
  officerId,
  { status = '', category = '', limit = 250 } = {}
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

  // Scoped strictly to the authenticated officer's assignments
  const filterQuery = {
    assignedOfficer: officerObjectId,
    'location.latitude': { $ne: null, $gte: -90, $lte: 90 },
    'location.longitude': { $ne: null, $gte: -180, $lte: 180 }
  };

  // Status Filter
  if (status && typeof status === 'string' && status.trim() !== '' && status.trim().toLowerCase() !== 'all') {
    filterQuery.status = status.trim();
  }

  // Category Filter
  if (category && typeof category === 'string' && category.trim() !== '' && category.trim().toLowerCase() !== 'all') {
    filterQuery.category = category.trim();
  }

  const safeLimit = Math.min(500, Math.max(1, parseInt(limit, 10) || 250));

  const complaints = await Complaint.find(filterQuery)
    .sort({ createdAt: -1 })
    .limit(safeLimit);

  return complaints
    .filter((c) => validateCoordinates(c.location?.latitude, c.location?.longitude))
    .map((c) => ({
      complaintId: c.complaintId,
    title: c.title,
    description: c.description,
    category: c.category,
    status: c.status,
    address: c.location?.address || '',
    latitude: c.location.latitude,
    longitude: c.location.longitude,
    imageUrl: c.imageUrl || '',
    aiAnalysis: {
      severity: c.aiAnalysis?.severity || null,
      summary: c.aiAnalysis?.summary || '',
      suggestedAction: c.aiAnalysis?.suggestedAction || ''
    },
    assignedDepartmentName: c.assignedDepartmentName || null,
    assignedAt: c.assignedAt || null,
    createdAt: c.createdAt
  }));
};

/**
 * Service: Retrieves public-safe complaint markers with location approximation
 * Zero leakage of internal ObjectIds, reporter identity, officer emails, or exact coordinates
 * @param {object} queryOptions
 * @returns {Promise<Array<object>>}
 */
export const getPublicMapComplaints = async ({
  category = '',
  status = '',
  limit = 100
} = {}) => {
  if (getDatabaseStatus() !== 'connected') {
    const error = new Error('Database service is currently unavailable. Please verify MongoDB connection.');
    error.statusCode = 503;
    throw error;
  }

  // Base Query: Valid coordinates only
  const filterQuery = {
    'location.latitude': { $ne: null, $gte: -90, $lte: 90 },
    'location.longitude': { $ne: null, $gte: -180, $lte: 180 }
  };

  // Category Filter
  if (category && typeof category === 'string' && category.trim() !== '' && category.trim().toLowerCase() !== 'all') {
    filterQuery.category = category.trim();
  }

  // Status Filter
  if (status && typeof status === 'string' && status.trim() !== '' && status.trim().toLowerCase() !== 'all') {
    filterQuery.status = status.trim();
  }

  const safeLimit = Math.min(250, Math.max(1, parseInt(limit, 10) || 100));

  const complaints = await Complaint.find(filterQuery)
    .populate('assignedDepartment', 'name')
    .sort({ createdAt: -1 })
    .limit(safeLimit);

  return complaints
    .filter((c) => validateCoordinates(c.location?.latitude, c.location?.longitude))
    .map((c) => ({
      complaintId: c.complaintId,
    title: c.title,
    category: c.category,
    status: c.status,
    severity: c.aiAnalysis?.severity || null,
    assignedDepartmentName:
      c.assignedDepartment && c.assignedDepartment.name
        ? c.assignedDepartment.name
        : (c.assignedDepartmentName || null),
    latitude: approximateCoordinate(c.location.latitude, 3),
    longitude: approximateCoordinate(c.location.longitude, 3),
    address: c.location?.address || '',
    submissionDate: c.createdAt
  }));
};

export default {
  validateCoordinates,
  approximateCoordinate,
  getAdminMapComplaints,
  getOfficerMapComplaints,
  getPublicMapComplaints
};
