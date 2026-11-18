import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

/**
 * User Schema
 * Represents citizens and municipal administrators in CivicFix AI.
 */
const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters long'],
      maxlength: [100, 'Name cannot exceed 100 characters']
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        'Please provide a valid email address'
      ]
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters long'],
      select: false // Excluded from normal query results
    },
    role: {
      type: String,
      enum: {
        values: ['citizen', 'admin', 'officer'],
        message: '{VALUE} is not a valid user role'
      },
      default: 'citizen'
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      default: null
    },
    isActive: {
      type: Boolean,
      default: true
    },
    emailNotificationsEnabled: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

// Indexes
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ role: 1 });
userSchema.index({ department: 1 });

// Pre-save hook: Hash password with bcrypt before saving
userSchema.pre('save', async function () {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password')) {
    return;
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

/**
 * Instance method to compare plain-text password with hashed password
 * @param {string} enteredPassword
 * @returns {Promise<boolean>}
 */
userSchema.methods.matchPassword = async function (enteredPassword) {
  if (!this.password) {
    return false;
  }
  return await bcrypt.compare(enteredPassword, this.password);
};

/**
 * Returns safe user object without password or sensitive internals
 * @returns {object}
 */
userSchema.methods.toSafeObject = function () {
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    role: this.role,
    department: this.department ? (this.department._id ? this.department._id.toString() : this.department.toString()) : null,
    departmentDetails: this.department && typeof this.department === 'object' && this.department.name ? {
      id: this.department._id ? this.department._id.toString() : undefined,
      name: this.department.name,
      code: this.department.code
    } : undefined,
    isActive: this.isActive,
    emailNotificationsEnabled: this.emailNotificationsEnabled === true,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};

export const User = mongoose.model('User', userSchema);

export default User;
