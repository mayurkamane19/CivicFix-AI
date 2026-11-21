import mongoose from 'mongoose';

/**
 * PushSubscription Schema
 * Stores Web Push API subscriptions associated with authenticated users.
 * Anti-IDOR & Account Isolation: Each subscription is strictly associated with a User.
 */
const pushSubscriptionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
      index: true
    },
    endpoint: {
      type: String,
      required: [true, 'Push endpoint URL is required'],
      unique: true,
      trim: true
    },
    keys: {
      p256dh: {
        type: String,
        required: [true, 'p256dh key is required'],
        trim: true
      },
      auth: {
        type: String,
        required: [true, 'auth secret is required'],
        trim: true
      }
    },
    userAgent: {
      type: String,
      trim: true,
      default: ''
    }
  },
  {
    timestamps: true
  }
);

export const PushSubscription = mongoose.model('PushSubscription', pushSubscriptionSchema);
export default PushSubscription;
