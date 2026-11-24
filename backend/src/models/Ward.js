import mongoose from 'mongoose';

/**
 * Ward Schema
 * Represents municipal administrative wards within a city or municipality.
 * Supports multi-ward governance, department assignments, and officer scoping.
 */
const wardSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Ward name is required'],
      trim: true,
      minlength: [2, 'Ward name must be at least 2 characters long'],
      maxlength: [100, 'Ward name cannot exceed 100 characters']
    },
    code: {
      type: String,
      required: [true, 'Ward code is required'],
      unique: true,
      trim: true,
      uppercase: true,
      minlength: [2, 'Ward code must be at least 2 characters long'],
      maxlength: [20, 'Ward code cannot exceed 20 characters']
    },
    number: {
      type: Number,
      required: [true, 'Ward number is required'],
      unique: true,
      min: [1, 'Ward number must be a positive integer']
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, 'Ward description cannot exceed 1000 characters'],
      default: ''
    },
    zone: {
      type: String,
      required: [true, 'Municipal zone is required'],
      trim: true,
      default: 'Central Zone'
    },
    municipality: {
      type: String,
      trim: true,
      default: 'City Municipal Corporation'
    },
    boundaries: {
      type: {
        type: String,
        enum: ['Polygon', 'MultiPolygon', 'Point', 'None'],
        default: 'None'
      },
      coordinates: {
        type: mongoose.Schema.Types.Mixed,
        default: null
      },
      description: {
        type: String,
        trim: true,
        default: ''
      }
    },
    center: {
      latitude: {
        type: Number,
        min: [-90, 'Latitude must be between -90 and 90'],
        max: [90, 'Latitude must be between -90 and 90'],
        default: null
      },
      longitude: {
        type: Number,
        min: [-180, 'Longitude must be between -180 and 180'],
        max: [180, 'Longitude must be between -180 and 180'],
        default: null
      }
    },
    assignedDepartments: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Department'
      }
    ],
    wardAdmin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    assignedOfficers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    ],
    isActive: {
      type: Boolean,
      default: true
    },
    population: {
      type: Number,
      min: 0,
      default: 0
    },
    areaKm2: {
      type: Number,
      min: 0,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

// Query optimization indexes
wardSchema.index({ zone: 1 });
wardSchema.index({ isActive: 1 });

/**
 * Returns safe public representation of Ward object
 * @returns {object}
 */
wardSchema.methods.toSafeObject = function () {
  return {
    id: this._id ? this._id.toString() : undefined,
    name: this.name,
    code: this.code,
    number: this.number,
    description: this.description,
    zone: this.zone,
    municipality: this.municipality,
    center: this.center || { latitude: null, longitude: null },
    boundaries: this.boundaries || { type: 'None', coordinates: null, description: '' },
    assignedDepartments: Array.isArray(this.assignedDepartments)
      ? this.assignedDepartments.map((d) => (d && typeof d === 'object' && d.name ? {
          id: d._id ? d._id.toString() : undefined,
          name: d.name,
          code: d.code
        } : (d ? d.toString() : null)))
      : [],
    wardAdmin: this.wardAdmin
      ? (typeof this.wardAdmin === 'object' && this.wardAdmin.name ? {
          id: this.wardAdmin._id ? this.wardAdmin._id.toString() : undefined,
          name: this.wardAdmin.name,
          email: this.wardAdmin.email
        } : this.wardAdmin.toString())
      : null,
    officerCount: Array.isArray(this.assignedOfficers) ? this.assignedOfficers.length : 0,
    isActive: this.isActive,
    population: this.population,
    areaKm2: this.areaKm2,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};

export const Ward = mongoose.model('Ward', wardSchema);

export default Ward;
