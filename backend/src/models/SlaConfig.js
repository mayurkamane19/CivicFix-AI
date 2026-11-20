import mongoose from 'mongoose';

/**
 * Standard SLA Default Durations in Hours
 */
export const DEFAULT_SLA_TARGETS = {
  Critical: 4,
  High: 24,
  Medium: 72,
  Low: 120
};

export const DEFAULT_ESCALATION_THRESHOLDS = {
  level1WarningPercent: 75,   // Approaching deadline (75% elapsed)
  level2OverduePercent: 100,  // Target deadline reached (100% elapsed)
  level3CriticalPercent: 150  // Severely breached (150% elapsed)
};

/**
 * SLA Configuration Schema
 * Defines department-specific and global resolution target hours and escalation trigger thresholds.
 */
const slaConfigSchema = new mongoose.Schema(
  {
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      default: null, // null represents global default fallback configuration
      index: true
    },
    departmentName: {
      type: String,
      trim: true,
      default: 'Global Default'
    },
    priorityTargets: {
      Critical: {
        type: Number,
        required: [true, 'Critical priority resolution target hours required'],
        min: [1, 'Resolution target must be at least 1 hour'],
        default: DEFAULT_SLA_TARGETS.Critical
      },
      High: {
        type: Number,
        required: [true, 'High priority resolution target hours required'],
        min: [1, 'Resolution target must be at least 1 hour'],
        default: DEFAULT_SLA_TARGETS.High
      },
      Medium: {
        type: Number,
        required: [true, 'Medium priority resolution target hours required'],
        min: [1, 'Resolution target must be at least 1 hour'],
        default: DEFAULT_SLA_TARGETS.Medium
      },
      Low: {
        type: Number,
        required: [true, 'Low priority resolution target hours required'],
        min: [1, 'Resolution target must be at least 1 hour'],
        default: DEFAULT_SLA_TARGETS.Low
      }
    },
    escalationThresholds: {
      level1WarningPercent: {
        type: Number,
        min: [10, 'Level 1 threshold must be at least 10%'],
        max: [100, 'Level 1 threshold cannot exceed 100%'],
        default: DEFAULT_ESCALATION_THRESHOLDS.level1WarningPercent
      },
      level2OverduePercent: {
        type: Number,
        min: [100, 'Level 2 threshold must be at least 100%'],
        default: DEFAULT_ESCALATION_THRESHOLDS.level2OverduePercent
      },
      level3CriticalPercent: {
        type: Number,
        min: [110, 'Level 3 threshold must be at least 110%'],
        default: DEFAULT_ESCALATION_THRESHOLDS.level3CriticalPercent
      }
    },
    isEnabled: {
      type: Boolean,
      default: true
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    updatedByName: {
      type: String,
      trim: true,
      default: 'Municipal Administrator'
    }
  },
  {
    timestamps: true
  }
);

// Indexes
slaConfigSchema.index({ department: 1 }, { unique: true });
slaConfigSchema.index({ isEnabled: 1 });

/**
 * Returns safe representation for administrative inspection
 * @returns {object}
 */
slaConfigSchema.methods.toSafeObject = function () {
  return {
    id: this._id ? this._id.toString() : undefined,
    department: this.department ? this.department.toString() : null,
    departmentName: this.departmentName || 'Global Default',
    priorityTargets: this.priorityTargets || DEFAULT_SLA_TARGETS,
    escalationThresholds: this.escalationThresholds || DEFAULT_ESCALATION_THRESHOLDS,
    isEnabled: Boolean(this.isEnabled),
    updatedByName: this.updatedByName || 'Municipal Administrator',
    updatedAt: this.updatedAt || this.createdAt
  };
};

/**
 * Static Helper: Retrieves effective SLA configuration for a specific department
 * Falls back to global default or hardcoded standards if no department config exists.
 * @param {string|mongoose.Types.ObjectId} [departmentId=null]
 * @returns {Promise<object>}
 */
slaConfigSchema.statics.getEffectiveConfig = async function (departmentId = null) {
  // Return architectural defaults immediately if not genuinely connected to live MongoDB
  const isLiveConnection = mongoose.connection.readyState === 1 &&
    Boolean(mongoose.connection.db && mongoose.connection.client);

  if (!isLiveConnection) {
    return {
      id: null,
      department: null,
      departmentName: 'System Default Standard',
      priorityTargets: { ...DEFAULT_SLA_TARGETS },
      escalationThresholds: { ...DEFAULT_ESCALATION_THRESHOLDS },
      isEnabled: true,
      updatedByName: 'System Built-In Standard',
      updatedAt: new Date()
    };
  }

  // 1. Try department custom configuration
  if (departmentId && mongoose.Types.ObjectId.isValid(departmentId)) {
    const deptConfig = await this.findOne({ department: departmentId, isEnabled: true });
    if (deptConfig) {
      return deptConfig.toSafeObject();
    }
  }

  // 2. Try global default configuration
  const globalConfig = await this.findOne({ department: null, isEnabled: true });
  if (globalConfig) {
    return globalConfig.toSafeObject();
  }

  // 3. Fallback to hardcoded architectural defaults
  return {
    id: null,
    department: null,
    departmentName: 'System Default Standard',
    priorityTargets: { ...DEFAULT_SLA_TARGETS },
    escalationThresholds: { ...DEFAULT_ESCALATION_THRESHOLDS },
    isEnabled: true,
    updatedByName: 'System Built-In Standard',
    updatedAt: new Date()
  };
};

export const SlaConfig = mongoose.model('SlaConfig', slaConfigSchema);

export default SlaConfig;
