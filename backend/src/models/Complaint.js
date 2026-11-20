import mongoose from 'mongoose';

/**
 * Complaint Schema
 * Represents public issues submitted by citizens for municipal resolution.
 */
const complaintSchema = new mongoose.Schema(
  {
    complaintId: {
      type: String,
      unique: true,
      trim: true,
      default: () => `CFX-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`
    },
    title: {
      type: String,
      required: [true, 'Complaint title is required'],
      trim: true,
      minlength: [3, 'Title must be at least 3 characters long'],
      maxlength: [150, 'Title cannot exceed 150 characters']
    },
    description: {
      type: String,
      trim: true,
      default: '',
      maxlength: [2000, 'Description cannot exceed 2000 characters']
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: {
        values: [
          'Road Damage',
          'Garbage',
          'Water Leakage',
          'Streetlight',
          'Drainage',
          'Other'
        ],
        message: '{VALUE} is not a valid complaint category'
      }
    },
    location: {
      address: {
        type: String,
        trim: true,
        default: ''
      },
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
    imageUrl: {
      type: String,
      trim: true,
      default: ''
    },
    imagePublicId: {
      type: String,
      trim: true,
      default: ''
    },
    status: {
      type: String,
      enum: {
        values: ['Pending', 'In Progress', 'Resolved'],
        message: '{VALUE} is not a valid complaint status'
      },
      default: 'Pending'
    },
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    citizenEmail: {
      type: String,
      lowercase: true,
      trim: true,
      default: null
    },
    emailNotificationsEnabled: {
      type: Boolean,
      default: false
    },
    aiAnalysis: {
      status: {
        type: String,
        enum: {
          values: ['Pending', 'Processing', 'Completed', 'Failed'],
          message: '{VALUE} is not a valid AI analysis status'
        },
        default: 'Pending'
      },
      suggestedCategory: {
        type: String,
        trim: true,
        default: null
      },
      severity: {
        type: String,
        enum: {
          values: ['Low', 'Medium', 'High', 'Critical', null],
          message: '{VALUE} is not a valid severity level'
        },
        default: null
      },
      summary: {
        type: String,
        trim: true,
        default: ''
      },
      recommendedDepartment: {
        type: String,
        trim: true,
        default: ''
      },
      suggestedAction: {
        type: String,
        trim: true,
        default: ''
      },
      analyzedAt: {
        type: Date,
        default: null
      },
      errorMessage: {
        type: String,
        trim: true,
        default: null
      }
    },
    imageAnalysis: {
      status: {
        type: String,
        enum: {
          values: ['Pending', 'Completed', 'Failed'],
          message: '{VALUE} is not a valid image analysis status'
        },
        default: 'Pending'
      },
      possibleIssueType: {
        type: String,
        trim: true,
        default: null
      },
      shortDescription: {
        type: String,
        trim: true,
        default: ''
      },
      suggestedCategory: {
        type: String,
        trim: true,
        default: null
      },
      suggestedSeverity: {
        type: String,
        enum: {
          values: ['Low', 'Medium', 'High', 'Critical', null],
          message: '{VALUE} is not a valid severity level'
        },
        default: null
      },
      confidence: {
        type: String,
        enum: {
          values: ['High', 'Medium', 'Low', null],
          message: '{VALUE} is not a valid confidence level'
        },
        default: null
      },
      isUnclearOrUnsuitable: {
        type: Boolean,
        default: false
      },
      unsuitableReason: {
        type: String,
        trim: true,
        default: null
      },
      analyzedAt: {
        type: Date,
        default: null
      },
      errorMessage: {
        type: String,
        trim: true,
        default: null
      }
    },
    duplicateCheck: {
      status: {
        type: String,
        enum: {
          values: ['Pending', 'Completed', 'Failed'],
          message: '{VALUE} is not a valid duplicate check status'
        },
        default: 'Pending'
      },
      isPotentialDuplicate: {
        type: Boolean,
        default: false
      },
      confidence: {
        type: String,
        enum: {
          values: ['High', 'Medium', 'Low', null],
          message: '{VALUE} is not a valid confidence level'
        },
        default: null
      },
      similarityScore: {
        type: Number,
        min: 0,
        max: 1,
        default: 0
      },
      matchedComplaintIds: {
        type: [String],
        default: []
      },
      matchedComplaints: [
        {
          complaintId: { type: String, required: true },
          title: { type: String, default: '' },
          category: { type: String, default: '' },
          status: { type: String, default: 'Pending' },
          similarityScore: { type: Number, default: 0 },
          confidence: { type: String, default: 'Medium' },
          distanceMeters: { type: Number, default: null },
          createdAt: { type: Date, default: null }
        }
      ],
      checkedAt: {
        type: Date,
        default: null
      },
      errorMessage: {
        type: String,
        trim: true,
        default: null
      }
    },
    statusHistory: [
      {
        previousStatus: {
          type: String,
          enum: {
            values: ['Pending', 'In Progress', 'Resolved'],
            message: '{VALUE} is not a valid status'
          },
          required: true
        },
        newStatus: {
          type: String,
          enum: {
            values: ['Pending', 'In Progress', 'Resolved'],
            message: '{VALUE} is not a valid status'
          },
          required: true
        },
        changedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          default: null
        },
        changedByName: {
          type: String,
          trim: true,
          default: 'Municipal Administrator'
        },
        note: {
          type: String,
          trim: true,
          maxlength: [500, 'Status note cannot exceed 500 characters'],
          default: ''
        },
        changedAt: {
          type: Date,
          default: Date.now
        }
      }
    ],
    assignedDepartment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      default: null
    },
    assignedDepartmentName: {
      type: String,
      trim: true,
      default: null
    },
    assignedOfficer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    assignedOfficerName: {
      type: String,
      trim: true,
      default: null
    },
    assignedAt: {
      type: Date,
      default: null
    },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    assignmentHistory: [
      {
        previousDepartment: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Department',
          default: null
        },
        previousDepartmentName: {
          type: String,
          trim: true,
          default: null
        },
        newDepartment: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Department',
          required: true
        },
        newDepartmentName: {
          type: String,
          trim: true,
          required: true
        },
        previousOfficer: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          default: null
        },
        previousOfficerName: {
          type: String,
          trim: true,
          default: null
        },
        newOfficer: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          default: null
        },
        newOfficerName: {
          type: String,
          trim: true,
          default: null
        },
        assignedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true
        },
        assignedByName: {
          type: String,
          trim: true,
          default: 'Municipal Administrator'
        },
        note: {
          type: String,
          trim: true,
          maxlength: [500, 'Assignment note cannot exceed 500 characters'],
          default: ''
        },
        assignedAt: {
          type: Date,
          default: Date.now
        }
      }
    ],
    sla: {
      status: {
        type: String,
        enum: {
          values: [
            'Not Started',
            'Within SLA',
            'Approaching Deadline',
            'Overdue',
            'Resolved Within SLA',
            'Resolved After SLA'
          ],
          message: '{VALUE} is not a valid SLA status'
        },
        default: 'Not Started'
      },
      priority: {
        type: String,
        enum: ['Low', 'Medium', 'High', 'Critical'],
        default: 'Medium'
      },
      targetResolutionHours: {
        type: Number,
        default: 72
      },
      startTime: {
        type: Date,
        default: null
      },
      deadline: {
        type: Date,
        default: null
      },
      remainingHours: {
        type: Number,
        default: null
      },
      overdueHours: {
        type: Number,
        default: 0
      },
      resolvedAt: {
        type: Date,
        default: null
      },
      currentEscalationLevel: {
        type: Number,
        enum: [0, 1, 2, 3],
        default: 0
      },
      lastEscalatedAt: {
        type: Date,
        default: null
      },
      nextEscalationThreshold: {
        type: Date,
        default: null
      },
      isEscalated: {
        type: Boolean,
        default: false
      },
      monitoringActive: {
        type: Boolean,
        default: true
      },
      citizenSafeStatus: {
        type: String,
        trim: true,
        default: 'Within standard resolution window'
      }
    }
  },
  {
    timestamps: true
  }
);

// Query optimization indexes
complaintSchema.index({ complaintId: 1 }, { unique: true });
complaintSchema.index({ status: 1 });
complaintSchema.index({ category: 1 });
complaintSchema.index({ 'aiAnalysis.status': 1 });
complaintSchema.index({ 'imageAnalysis.status': 1 });
complaintSchema.index({ 'duplicateCheck.isPotentialDuplicate': 1 });
complaintSchema.index({ assignedDepartment: 1 });
complaintSchema.index({ assignedOfficer: 1 });
complaintSchema.index({ 'location.latitude': 1, 'location.longitude': 1 });
complaintSchema.index({ status: 1, 'location.latitude': 1, 'location.longitude': 1 });
complaintSchema.index({ createdAt: -1 });
complaintSchema.index({ createdAt: -1, status: 1 });
complaintSchema.index({ createdAt: -1, category: 1 });
complaintSchema.index({ 'sla.status': 1 });
complaintSchema.index({ 'sla.deadline': 1 });
complaintSchema.index({ 'sla.currentEscalationLevel': 1 });
complaintSchema.index({ 'sla.monitoringActive': 1, 'sla.deadline': 1 });

/**
 * Returns safe public representation of complaint (excluding internal IDs)
 * @returns {object}
 */
complaintSchema.methods.toPublicJSON = function () {
  return {
    complaintId: this.complaintId,
    title: this.title,
    description: this.description,
    category: this.category,
    address: this.location?.address || '',
    latitude: this.location?.latitude ?? null,
    longitude: this.location?.longitude ?? null,
    imageUrl: this.imageUrl || '',
    status: this.status,
    aiAnalysis: {
      status: this.aiAnalysis?.status || 'Pending',
      suggestedCategory: this.aiAnalysis?.suggestedCategory || null,
      severity: this.aiAnalysis?.severity || null,
      summary: this.aiAnalysis?.summary || '',
      recommendedDepartment: this.aiAnalysis?.recommendedDepartment || '',
      suggestedAction: this.aiAnalysis?.suggestedAction || '',
      analyzedAt: this.aiAnalysis?.analyzedAt || null,
      errorMessage: this.aiAnalysis?.errorMessage || null
    },
    imageAnalysis: this.imageAnalysis && this.imageAnalysis.status !== 'Pending'
      ? {
          status: this.imageAnalysis.status,
          possibleIssueType: this.imageAnalysis.possibleIssueType || null,
          shortDescription: this.imageAnalysis.shortDescription || '',
          suggestedCategory: this.imageAnalysis.suggestedCategory || null,
          suggestedSeverity: this.imageAnalysis.suggestedSeverity || null,
          confidence: this.imageAnalysis.confidence || null,
          isUnclearOrUnsuitable: Boolean(this.imageAnalysis.isUnclearOrUnsuitable),
          unsuitableReason: this.imageAnalysis.unsuitableReason || null,
          analyzedAt: this.imageAnalysis.analyzedAt || null
        }
      : (this.imageUrl ? { status: this.imageAnalysis?.status || 'Pending' } : null),
    duplicateCheck: {
      status: this.duplicateCheck?.status || 'Pending',
      isPotentialDuplicate: Boolean(this.duplicateCheck?.isPotentialDuplicate),
      confidence: this.duplicateCheck?.confidence || null,
      similarityScore: this.duplicateCheck?.similarityScore || 0,
      matchedComplaintIds: this.duplicateCheck?.matchedComplaintIds || [],
      matchedComplaints: (this.duplicateCheck?.matchedComplaints || []).map((m) => ({
        complaintId: m.complaintId,
        title: m.title || '',
        category: m.category || '',
        status: m.status || 'Pending',
        similarityScore: m.similarityScore || 0,
        confidence: m.confidence || 'Medium',
        distanceMeters: m.distanceMeters ?? null,
        createdAt: m.createdAt || null
      })),
      checkedAt: this.duplicateCheck?.checkedAt || null,
      errorMessage: this.duplicateCheck?.errorMessage || null
    },
    submissionDate: this.createdAt,
    statusHistory: (this.statusHistory || []).map((h) => ({
      id: h._id ? h._id.toString() : undefined,
      previousStatus: h.previousStatus,
      newStatus: h.newStatus,
      changedByName: h.changedByName || 'Municipal Administrator',
      note: h.note || '',
      changedAt: h.changedAt
    })),
    assignedDepartmentName:
      this.assignedDepartment && this.assignedDepartment.name
        ? this.assignedDepartment.name
        : (this.assignedDepartmentName || null),
    assignedOfficerName:
      this.assignedOfficer && this.assignedOfficer.name
        ? this.assignedOfficer.name
        : (this.assignedOfficerName || null),
    assignedAt: this.assignedAt || null,
    assignmentHistory: (this.assignmentHistory || []).map((a) => ({
      id: a._id ? a._id.toString() : undefined,
      previousDepartmentName: a.previousDepartmentName || null,
      newDepartmentName: a.newDepartmentName,
      previousOfficerName: a.previousOfficerName || null,
      newOfficerName: a.newOfficerName || null,
      assignedByName: a.assignedByName || 'Municipal Administrator',
      note: a.note || '',
      assignedAt: a.assignedAt
    })),
    emailNotificationsEnabled: this.emailNotificationsEnabled === true,
    sla: this.sla
      ? {
          status: this.sla.status || 'Not Started',
          priority: this.sla.priority || 'Medium',
          targetResolutionHours: this.sla.targetResolutionHours || 72,
          startTime: this.sla.startTime || null,
          deadline: this.sla.deadline || null,
          remainingHours: this.sla.remainingHours !== null && this.sla.remainingHours !== undefined
            ? Math.round(this.sla.remainingHours * 10) / 10
            : null,
          isOverdue: this.sla.status === 'Overdue' || this.sla.status === 'Resolved After SLA',
          isEscalated: Boolean(this.sla.isEscalated),
          citizenSafeStatus: this.sla.citizenSafeStatus || (
            this.sla.status === 'Resolved Within SLA'
              ? 'Resolved within standard service window'
              : this.sla.status === 'Resolved After SLA'
              ? 'Resolved'
              : this.sla.status === 'Overdue' || this.sla.isEscalated
              ? 'Priority Municipal Review'
              : this.sla.status === 'Approaching Deadline'
              ? 'Expedited Resolution Underway'
              : 'Within standard resolution window'
          )
        }
      : null,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};

/**
 * Returns administrative representation of complaint including internal user references
 * @returns {object}
 */
complaintSchema.methods.toAdminJSON = function () {
  const publicData = this.toPublicJSON();
  return {
    ...publicData,
    citizenEmail: this.citizenEmail || null,
    sla: this.sla
      ? {
          status: this.sla.status || 'Not Started',
          priority: this.sla.priority || 'Medium',
          targetResolutionHours: this.sla.targetResolutionHours || 72,
          startTime: this.sla.startTime || null,
          deadline: this.sla.deadline || null,
          remainingHours: this.sla.remainingHours,
          overdueHours: this.sla.overdueHours || 0,
          resolvedAt: this.sla.resolvedAt || null,
          currentEscalationLevel: this.sla.currentEscalationLevel || 0,
          lastEscalatedAt: this.sla.lastEscalatedAt || null,
          nextEscalationThreshold: this.sla.nextEscalationThreshold || null,
          isEscalated: Boolean(this.sla.isEscalated),
          monitoringActive: this.sla.monitoringActive !== false
        }
      : null,
    imageAnalysis: this.imageAnalysis && (this.imageAnalysis.status !== 'Pending' || this.imageUrl)
      ? {
          status: this.imageAnalysis.status || 'Pending',
          possibleIssueType: this.imageAnalysis.possibleIssueType || null,
          shortDescription: this.imageAnalysis.shortDescription || '',
          suggestedCategory: this.imageAnalysis.suggestedCategory || null,
          suggestedSeverity: this.imageAnalysis.suggestedSeverity || null,
          confidence: this.imageAnalysis.confidence || null,
          isUnclearOrUnsuitable: Boolean(this.imageAnalysis.isUnclearOrUnsuitable),
          unsuitableReason: this.imageAnalysis.unsuitableReason || null,
          analyzedAt: this.imageAnalysis.analyzedAt || null,
          errorMessage: this.imageAnalysis.errorMessage || null
        }
      : null,
    assignedDepartment: this.assignedDepartment
      ? (this.assignedDepartment._id ? this.assignedDepartment._id.toString() : this.assignedDepartment.toString())
      : null,
    assignedOfficer: this.assignedOfficer
      ? (this.assignedOfficer._id ? this.assignedOfficer._id.toString() : this.assignedOfficer.toString())
      : null,
    assignedBy: this.assignedBy
      ? (this.assignedBy._id ? this.assignedBy._id.toString() : this.assignedBy.toString())
      : null,
    statusHistory: (this.statusHistory || []).map((h) => ({
      id: h._id ? h._id.toString() : undefined,
      previousStatus: h.previousStatus,
      newStatus: h.newStatus,
      changedBy: h.changedBy ? h.changedBy.toString() : null,
      changedByName: h.changedByName || 'Municipal Administrator',
      note: h.note || '',
      changedAt: h.changedAt
    })),
    assignmentHistory: (this.assignmentHistory || []).map((a) => ({
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
    }))
  };
};

export const Complaint = mongoose.model('Complaint', complaintSchema);

export default Complaint;
