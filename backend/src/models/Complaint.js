import mongoose from 'mongoose';

export const RESOLUTION_VERIFICATION_STATUSES = [
  'Not Submitted',
  'Awaiting Citizen Verification',
  'Verified by Citizen',
  'Rejected by Citizen',
  'Reopened',
  'Under Administrative Review'
];

export const ADMIN_REVIEW_STATUSES = [
  'Not Required',
  'Pending',
  'Approved',
  'Rejected',
  'Overridden'
];

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
        values: ['Pending', 'In Progress', 'Resolved', 'Reopened'],
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
            values: ['Pending', 'In Progress', 'Resolved', 'Reopened'],
            message: '{VALUE} is not a valid status'
          },
          required: true
        },
        newStatus: {
          type: String,
          enum: {
            values: ['Pending', 'In Progress', 'Resolved', 'Reopened'],
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
    ward: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ward',
      default: null
    },
    wardName: {
      type: String,
      trim: true,
      default: null
    },
    wardCode: {
      type: String,
      trim: true,
      default: null
    },
    wardTransferHistory: [
      {
        previousWard: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Ward',
          default: null
        },
        previousWardName: {
          type: String,
          trim: true,
          default: null
        },
        previousWardCode: {
          type: String,
          trim: true,
          default: null
        },
        destinationWard: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Ward',
          required: true
        },
        destinationWardName: {
          type: String,
          trim: true,
          required: true
        },
        destinationWardCode: {
          type: String,
          trim: true,
          required: true
        },
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
        destinationDepartment: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Department',
          default: null
        },
        destinationDepartmentName: {
          type: String,
          trim: true,
          default: null
        },
        transferredBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true
        },
        transferredByName: {
          type: String,
          trim: true,
          default: 'Municipal Administrator'
        },
        reason: {
          type: String,
          trim: true,
          required: true,
          maxlength: [1000, 'Transfer reason cannot exceed 1000 characters']
        },
        transferredAt: {
          type: Date,
          default: Date.now
        }
      }
    ],
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
    },
    resolutionEvidence: {
      status: {
        type: String,
        enum: {
          values: RESOLUTION_VERIFICATION_STATUSES,
          message: '{VALUE} is not a valid resolution verification status'
        },
        default: 'Not Submitted'
      },
      remarks: {
        type: String,
        trim: true,
        maxlength: [1000, 'Resolution remarks cannot exceed 1000 characters'],
        default: ''
      },
      beforeImages: [
        {
          url: { type: String, trim: true, required: true },
          publicId: { type: String, trim: true, default: '' },
          uploadedAt: { type: Date, default: Date.now },
          uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
          caption: { type: String, trim: true, default: '' }
        }
      ],
      afterImages: [
        {
          url: { type: String, trim: true, required: true },
          publicId: { type: String, trim: true, default: '' },
          uploadedAt: { type: Date, default: Date.now },
          uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
          caption: { type: String, trim: true, default: '' }
        }
      ],
      submittedAt: {
        type: Date,
        default: null
      },
      submittedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
      },
      submittedByName: {
        type: String,
        trim: true,
        default: null
      },
      citizenVerification: {
        verifiedAt: { type: Date, default: null },
        verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        rejectedAt: { type: Date, default: null },
        rejectionReason: {
          type: String,
          trim: true,
          maxlength: [1000, 'Rejection reason cannot exceed 1000 characters'],
          default: ''
        },
        rejectionEvidence: [
          {
            url: { type: String, trim: true, required: true },
            publicId: { type: String, trim: true, default: '' },
            uploadedAt: { type: Date, default: Date.now }
          }
        ]
      },
      reopenCount: {
        type: Number,
        default: 0,
        min: 0
      },
      maxReopenLimit: {
        type: Number,
        default: 3
      },
      reopeningHistory: [
        {
          reopenedAt: { type: Date, default: Date.now },
          citizenId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
          citizenEmail: { type: String, default: null },
          reason: { type: String, required: true, trim: true },
          evidenceImages: [
            {
              url: { type: String, required: true },
              publicId: { type: String, default: '' }
            }
          ],
          previousStatus: { type: String, default: 'Resolved' },
          adminReviewRequired: { type: Boolean, default: false }
        }
      ],
      adminReview: {
        status: {
          type: String,
          enum: {
            values: ADMIN_REVIEW_STATUSES,
            message: '{VALUE} is not a valid admin review status'
          },
          default: 'Not Required'
        },
        reviewedAt: { type: Date, default: null },
        reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        reviewedByName: { type: String, trim: true, default: null },
        notes: {
          type: String,
          trim: true,
          maxlength: [1000, 'Review notes cannot exceed 1000 characters'],
          default: ''
        },
        actionTaken: { type: String, trim: true, default: null }
      },
      verificationHistory: [
        {
          action: { type: String, required: true },
          actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
          actorName: { type: String, trim: true, default: '' },
          actorRole: { type: String, enum: ['citizen', 'officer', 'admin', 'system'], default: 'system' },
          timestamp: { type: Date, default: Date.now },
          remarks: { type: String, trim: true, default: '' },
          metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
        }
      ]
    }
  },
  {
    timestamps: true
  }
);

// Query optimization indexes
complaintSchema.index({ status: 1 });
complaintSchema.index({ category: 1 });
complaintSchema.index({ 'aiAnalysis.status': 1 });
complaintSchema.index({ 'imageAnalysis.status': 1 });
complaintSchema.index({ 'duplicateCheck.isPotentialDuplicate': 1 });
complaintSchema.index({ assignedDepartment: 1 });
complaintSchema.index({ assignedOfficer: 1 });
complaintSchema.index({ ward: 1 });
complaintSchema.index({ 'location.latitude': 1, 'location.longitude': 1 });
complaintSchema.index({ status: 1, 'location.latitude': 1, 'location.longitude': 1 });
complaintSchema.index({ createdAt: -1 });
complaintSchema.index({ createdAt: -1, status: 1 });
complaintSchema.index({ createdAt: -1, category: 1 });
complaintSchema.index({ 'sla.status': 1 });
complaintSchema.index({ 'sla.deadline': 1 });
complaintSchema.index({ 'sla.currentEscalationLevel': 1 });
complaintSchema.index({ 'sla.monitoringActive': 1, 'sla.deadline': 1 });
complaintSchema.index({ 'resolutionEvidence.status': 1 });
complaintSchema.index({ assignedOfficer: 1, 'resolutionEvidence.status': 1 });
complaintSchema.index({ 'resolutionEvidence.adminReview.status': 1 });
complaintSchema.index({ 'resolutionEvidence.reopenCount': 1 });

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
    wardName: this.ward && this.ward.name ? this.ward.name : (this.wardName || null),
    wardCode: this.ward && this.ward.code ? this.ward.code : (this.wardCode || null),
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
    resolutionEvidence: this.resolutionEvidence
      ? {
          status: this.resolutionEvidence.status || 'Not Submitted',
          remarks: this.resolutionEvidence.remarks || '',
          beforeImages: (this.resolutionEvidence.beforeImages || []).map((img) => ({
            url: img.url,
            caption: img.caption || '',
            uploadedAt: img.uploadedAt
          })),
          afterImages: (this.resolutionEvidence.afterImages || []).map((img) => ({
            url: img.url,
            caption: img.caption || '',
            uploadedAt: img.uploadedAt
          })),
          submittedAt: this.resolutionEvidence.submittedAt || null,
          submittedByName: this.resolutionEvidence.submittedByName || (this.assignedOfficerName || 'Field Officer'),
          citizenVerification: this.resolutionEvidence.citizenVerification
            ? {
                verifiedAt: this.resolutionEvidence.citizenVerification.verifiedAt || null,
                rejectedAt: this.resolutionEvidence.citizenVerification.rejectedAt || null,
                rejectionReason: this.resolutionEvidence.citizenVerification.rejectionReason || null,
                rejectionEvidence: (this.resolutionEvidence.citizenVerification.rejectionEvidence || []).map((r) => ({
                  url: r.url,
                  uploadedAt: r.uploadedAt
                }))
              }
            : null,
          reopenCount: this.resolutionEvidence.reopenCount || 0,
          maxReopenLimit: this.resolutionEvidence.maxReopenLimit || 3,
          reopeningHistory: (this.resolutionEvidence.reopeningHistory || []).map((rh) => ({
            reopenedAt: rh.reopenedAt,
            reason: rh.reason,
            evidenceImages: (rh.evidenceImages || []).map((img) => ({ url: img.url })),
            previousStatus: rh.previousStatus,
            adminReviewRequired: Boolean(rh.adminReviewRequired)
          })),
          adminReview: this.resolutionEvidence.adminReview
            ? {
                status: this.resolutionEvidence.adminReview.status || 'Not Required',
                reviewedAt: this.resolutionEvidence.adminReview.reviewedAt || null,
                actionTaken: this.resolutionEvidence.adminReview.actionTaken || null
              }
            : null,
          verificationHistory: (this.resolutionEvidence.verificationHistory || []).map((vh) => ({
            action: vh.action,
            actorName: vh.actorName || '',
            actorRole: vh.actorRole || 'system',
            timestamp: vh.timestamp,
            remarks: vh.remarks || ''
          }))
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
    ward: this.ward ? (this.ward._id ? this.ward._id.toString() : this.ward.toString()) : null,
    wardName: this.ward && this.ward.name ? this.ward.name : (this.wardName || null),
    wardCode: this.ward && this.ward.code ? this.ward.code : (this.wardCode || null),
    wardTransferHistory: (this.wardTransferHistory || []).map((t) => ({
      id: t._id ? t._id.toString() : undefined,
      previousWard: t.previousWard ? t.previousWard.toString() : null,
      previousWardName: t.previousWardName || null,
      previousWardCode: t.previousWardCode || null,
      destinationWard: t.destinationWard ? t.destinationWard.toString() : null,
      destinationWardName: t.destinationWardName,
      destinationWardCode: t.destinationWardCode,
      previousDepartment: t.previousDepartment ? t.previousDepartment.toString() : null,
      previousDepartmentName: t.previousDepartmentName || null,
      destinationDepartment: t.destinationDepartment ? t.destinationDepartment.toString() : null,
      destinationDepartmentName: t.destinationDepartmentName || null,
      transferredBy: t.transferredBy ? t.transferredBy.toString() : null,
      transferredByName: t.transferredByName || 'Municipal Administrator',
      reason: t.reason,
      transferredAt: t.transferredAt
    })),
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
    })),
    resolutionEvidence: this.resolutionEvidence
      ? {
          status: this.resolutionEvidence.status || 'Not Submitted',
          remarks: this.resolutionEvidence.remarks || '',
          beforeImages: (this.resolutionEvidence.beforeImages || []).map((img) => ({
            url: img.url,
            publicId: img.publicId || '',
            caption: img.caption || '',
            uploadedAt: img.uploadedAt,
            uploadedBy: img.uploadedBy ? img.uploadedBy.toString() : null
          })),
          afterImages: (this.resolutionEvidence.afterImages || []).map((img) => ({
            url: img.url,
            publicId: img.publicId || '',
            caption: img.caption || '',
            uploadedAt: img.uploadedAt,
            uploadedBy: img.uploadedBy ? img.uploadedBy.toString() : null
          })),
          submittedAt: this.resolutionEvidence.submittedAt || null,
          submittedBy: this.resolutionEvidence.submittedBy ? this.resolutionEvidence.submittedBy.toString() : null,
          submittedByName: this.resolutionEvidence.submittedByName || this.assignedOfficerName || null,
          citizenVerification: this.resolutionEvidence.citizenVerification
            ? {
                verifiedAt: this.resolutionEvidence.citizenVerification.verifiedAt || null,
                verifiedBy: this.resolutionEvidence.citizenVerification.verifiedBy ? this.resolutionEvidence.citizenVerification.verifiedBy.toString() : null,
                rejectedAt: this.resolutionEvidence.citizenVerification.rejectedAt || null,
                rejectionReason: this.resolutionEvidence.citizenVerification.rejectionReason || null,
                rejectionEvidence: (this.resolutionEvidence.citizenVerification.rejectionEvidence || []).map((r) => ({
                  url: r.url,
                  publicId: r.publicId || '',
                  uploadedAt: r.uploadedAt
                }))
              }
            : null,
          reopenCount: this.resolutionEvidence.reopenCount || 0,
          maxReopenLimit: this.resolutionEvidence.maxReopenLimit || 3,
          reopeningHistory: (this.resolutionEvidence.reopeningHistory || []).map((rh) => ({
            reopenedAt: rh.reopenedAt,
            citizenId: rh.citizenId ? rh.citizenId.toString() : null,
            citizenEmail: rh.citizenEmail || null,
            reason: rh.reason,
            evidenceImages: (rh.evidenceImages || []).map((img) => ({
              url: img.url,
              publicId: img.publicId || ''
            })),
            previousStatus: rh.previousStatus,
            adminReviewRequired: Boolean(rh.adminReviewRequired)
          })),
          adminReview: this.resolutionEvidence.adminReview
            ? {
                status: this.resolutionEvidence.adminReview.status || 'Not Required',
                reviewedAt: this.resolutionEvidence.adminReview.reviewedAt || null,
                reviewedBy: this.resolutionEvidence.adminReview.reviewedBy ? this.resolutionEvidence.adminReview.reviewedBy.toString() : null,
                reviewedByName: this.resolutionEvidence.adminReview.reviewedByName || null,
                notes: this.resolutionEvidence.adminReview.notes || '',
                actionTaken: this.resolutionEvidence.adminReview.actionTaken || null
              }
            : null,
          verificationHistory: (this.resolutionEvidence.verificationHistory || []).map((vh) => ({
            action: vh.action,
            actor: vh.actor ? vh.actor.toString() : null,
            actorName: vh.actorName || '',
            actorRole: vh.actorRole || 'system',
            timestamp: vh.timestamp,
            remarks: vh.remarks || '',
            metadata: vh.metadata || {}
          }))
        }
      : null
  };
};

export const Complaint = mongoose.model('Complaint', complaintSchema);

export default Complaint;
