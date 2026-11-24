import mongoose from 'mongoose';

/**
 * Department Schema
 * Represents municipal departments responsible for civic issue resolution
 * (e.g., Road Maintenance, Sanitation, Water Supply, Electrical, Drainage, General).
 */
const departmentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Department name is required'],
      unique: true,
      trim: true,
      minlength: [2, 'Department name must be at least 2 characters long'],
      maxlength: [100, 'Department name cannot exceed 100 characters']
    },
    code: {
      type: String,
      required: [true, 'Department code is required'],
      unique: true,
      trim: true,
      uppercase: true,
      minlength: [2, 'Department code must be at least 2 characters long'],
      maxlength: [20, 'Department code cannot exceed 20 characters']
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Department description cannot exceed 500 characters'],
      default: ''
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

// Query optimization indexes
departmentSchema.index({ isActive: 1 });

/**
 * Safe public representation of Department
 * @returns {object}
 */
departmentSchema.methods.toSafeObject = function () {
  return {
    id: this._id ? this._id.toString() : undefined,
    name: this.name,
    code: this.code,
    description: this.description,
    isActive: this.isActive,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};

export const Department = mongoose.model('Department', departmentSchema);

export default Department;
