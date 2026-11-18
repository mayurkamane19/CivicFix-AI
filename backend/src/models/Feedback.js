import mongoose from 'mongoose';

/**
 * Feedback Schema
 * Captures citizen satisfaction ratings and comments for resolved public issue complaints.
 */
const feedbackSchema = new mongoose.Schema(
  {
    complaint: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Complaint',
      required: [true, 'Complaint reference is required'],
      unique: true // Strictly enforces one feedback record per complaint
    },
    citizen: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Citizen reference is required']
    },
    rating: {
      type: Number,
      required: [true, 'Rating is required'],
      min: [1, 'Rating must be at least 1'],
      max: [5, 'Rating cannot exceed 5'],
      validate: {
        validator: Number.isInteger,
        message: '{VALUE} is not an integer rating'
      }
    },
    comment: {
      type: String,
      trim: true,
      maxlength: [500, 'Feedback comment cannot exceed 500 characters'],
      default: ''
    }
  },
  {
    timestamps: true
  }
);

// Query optimization & constraint indexes
feedbackSchema.index({ complaint: 1 }, { unique: true });
feedbackSchema.index({ citizen: 1 });
feedbackSchema.index({ rating: 1 });
feedbackSchema.index({ createdAt: -1 });

/**
 * Returns safe representation of feedback object without internal Mongoose fields
 * @returns {object}
 */
feedbackSchema.methods.toSafeObject = function () {
  return {
    id: this._id ? this._id.toString() : undefined,
    complaint: this.complaint
      ? (this.complaint._id ? this.complaint._id.toString() : this.complaint.toString())
      : undefined,
    citizen: this.citizen
      ? (this.citizen._id ? this.citizen._id.toString() : this.citizen.toString())
      : undefined,
    rating: this.rating,
    comment: this.comment || '',
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};

export const Feedback = mongoose.model('Feedback', feedbackSchema);
export default Feedback;
