import mongoose from 'mongoose';
import { Department } from '../models/Department.js';
import { Complaint } from '../models/Complaint.js';
import { getDatabaseStatus } from '../config/db.js';

/**
 * Service: Retrieves all municipal departments
 * @param {object} options
 * @param {boolean} [options.includeInactive=true]
 * @returns {Promise<Array<object>>}
 */
export const getAllDepartments = async ({ includeInactive = true } = {}) => {
  if (getDatabaseStatus() !== 'connected') {
    const error = new Error('Database service is currently unavailable. Please verify MongoDB connection.');
    error.statusCode = 503;
    throw error;
  }

  const query = includeInactive ? {} : { isActive: true };
  const departments = await Department.find(query).sort({ name: 1 });
  return departments.map((d) => d.toSafeObject());
};

/**
 * Service: Retrieves a single department by ID
 * @param {string} rawDepartmentId
 * @returns {Promise<object>}
 */
export const getDepartmentById = async (rawDepartmentId) => {
  if (!rawDepartmentId || !mongoose.Types.ObjectId.isValid(rawDepartmentId)) {
    const error = new Error('Please provide a valid department ID');
    error.statusCode = 400;
    throw error;
  }

  if (getDatabaseStatus() !== 'connected') {
    const error = new Error('Database service is currently unavailable. Please verify MongoDB connection.');
    error.statusCode = 503;
    throw error;
  }

  const department = await Department.findById(rawDepartmentId);
  if (!department) {
    const error = new Error(`Department not found with ID: ${rawDepartmentId}`);
    error.statusCode = 404;
    throw error;
  }

  return department.toSafeObject();
};

/**
 * Service: Creates a new municipal department
 * @param {object} departmentData
 * @returns {Promise<object>}
 */
export const createDepartment = async ({ name, code, description = '' }) => {
  if (getDatabaseStatus() !== 'connected') {
    const error = new Error('Database service is currently unavailable. Please verify MongoDB connection.');
    error.statusCode = 503;
    throw error;
  }

  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    const error = new Error('Department name is required and must be at least 2 characters');
    error.statusCode = 400;
    throw error;
  }

  if (!code || typeof code !== 'string' || code.trim().length < 2) {
    const error = new Error('Department code is required and must be at least 2 characters');
    error.statusCode = 400;
    throw error;
  }

  const trimmedName = name.trim();
  const trimmedCode = code.trim().toUpperCase();
  const trimmedDesc = typeof description === 'string' ? description.trim() : '';

  if (trimmedName.length > 100) {
    const error = new Error('Department name cannot exceed 100 characters');
    error.statusCode = 400;
    throw error;
  }

  if (trimmedCode.length > 20) {
    const error = new Error('Department code cannot exceed 20 characters');
    error.statusCode = 400;
    throw error;
  }

  if (trimmedDesc.length > 500) {
    const error = new Error('Department description cannot exceed 500 characters');
    error.statusCode = 400;
    throw error;
  }

  // Check for duplicate name or code (case-insensitive regex for name, exact uppercase for code)
  const existingName = await Department.findOne({
    name: { $regex: new RegExp(`^${trimmedName}$`, 'i') }
  });
  if (existingName) {
    const error = new Error(`A department with the name "${trimmedName}" already exists`);
    error.statusCode = 409;
    throw error;
  }

  const existingCode = await Department.findOne({ code: trimmedCode });
  if (existingCode) {
    const error = new Error(`A department with the code "${trimmedCode}" already exists`);
    error.statusCode = 409;
    throw error;
  }

  const newDept = await Department.create({
    name: trimmedName,
    code: trimmedCode,
    description: trimmedDesc,
    isActive: true
  });

  return newDept.toSafeObject();
};

/**
 * Service: Updates an existing municipal department
 * @param {string} rawDepartmentId
 * @param {object} updates
 * @returns {Promise<object>}
 */
export const updateDepartment = async (rawDepartmentId, updates = {}) => {
  if (!rawDepartmentId || !mongoose.Types.ObjectId.isValid(rawDepartmentId)) {
    const error = new Error('Please provide a valid department ID');
    error.statusCode = 400;
    throw error;
  }

  if (getDatabaseStatus() !== 'connected') {
    const error = new Error('Database service is currently unavailable. Please verify MongoDB connection.');
    error.statusCode = 503;
    throw error;
  }

  const department = await Department.findById(rawDepartmentId);
  if (!department) {
    const error = new Error(`Department not found with ID: ${rawDepartmentId}`);
    error.statusCode = 404;
    throw error;
  }

  // Handle Name update
  if (updates.name !== undefined) {
    if (typeof updates.name !== 'string' || updates.name.trim().length < 2) {
      const error = new Error('Department name must be at least 2 characters long');
      error.statusCode = 400;
      throw error;
    }
    const trimmedName = updates.name.trim();
    if (trimmedName.length > 100) {
      const error = new Error('Department name cannot exceed 100 characters');
      error.statusCode = 400;
      throw error;
    }

    if (trimmedName.toLowerCase() !== department.name.toLowerCase()) {
      const duplicateName = await Department.findOne({
        _id: { $ne: department._id },
        name: { $regex: new RegExp(`^${trimmedName}$`, 'i') }
      });
      if (duplicateName) {
        const error = new Error(`A department with the name "${trimmedName}" already exists`);
        error.statusCode = 409;
        throw error;
      }
    }
    department.name = trimmedName;
  }

  // Handle Code update
  if (updates.code !== undefined) {
    if (typeof updates.code !== 'string' || updates.code.trim().length < 2) {
      const error = new Error('Department code must be at least 2 characters long');
      error.statusCode = 400;
      throw error;
    }
    const trimmedCode = updates.code.trim().toUpperCase();
    if (trimmedCode.length > 20) {
      const error = new Error('Department code cannot exceed 20 characters');
      error.statusCode = 400;
      throw error;
    }

    if (trimmedCode !== department.code) {
      const duplicateCode = await Department.findOne({
        _id: { $ne: department._id },
        code: trimmedCode
      });
      if (duplicateCode) {
        const error = new Error(`A department with the code "${trimmedCode}" already exists`);
        error.statusCode = 409;
        throw error;
      }
    }
    department.code = trimmedCode;
  }

  // Handle Description update
  if (updates.description !== undefined) {
    if (typeof updates.description !== 'string') {
      const error = new Error('Department description must be a string');
      error.statusCode = 400;
      throw error;
    }
    const trimmedDesc = updates.description.trim();
    if (trimmedDesc.length > 500) {
      const error = new Error('Department description cannot exceed 500 characters');
      error.statusCode = 400;
      throw error;
    }
    department.description = trimmedDesc;
  }

  // Handle isActive status update (prefer deactivation over destructive deletion)
  if (updates.isActive !== undefined) {
    department.isActive = Boolean(updates.isActive);
  }

  await department.save();
  return department.toSafeObject();
};

export default {
  getAllDepartments,
  getDepartmentById,
  createDepartment,
  updateDepartment
};
