const mongoose = require("mongoose");

const upiChangeVerificationSchema = new mongoose.Schema(
  {
    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
      index: true,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },

    otpHash: {
      type: String,
      required: true,
    },

    otpExpiresAt: {
      type: Date,
      required: true,
      index: true,
    },

    attempts: {
      type: Number,
      default: 0,
      min: 0,
    },

    maxAttempts: {
      type: Number,
      default: 5,
    },

    lastSentAt: {
      type: Date,
      required: true,
    },

    verifiedAt: {
      type: Date,
      default: null,
    },

    verificationTokenHash: {
      type: String,
      default: null,
      index: true,
    },

    verificationTokenExpiresAt: {
      type: Date,
      default: null,
    },

    usedAt: {
      type: Date,
      default: null,
    },

    ipAddress: {
      type: String,
      default: "",
    },

    userAgent: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

/*
 * Automatically delete OTP verification records
 * after 30 minutes.
 */
upiChangeVerificationSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 1800 }
);

/*
 * Fast tenant/user lookup.
 */
upiChangeVerificationSchema.index({
  restaurantId: 1,
  userId: 1,
  createdAt: -1,
});

module.exports = mongoose.model(
  "UpiChangeVerification",
  upiChangeVerificationSchema
);