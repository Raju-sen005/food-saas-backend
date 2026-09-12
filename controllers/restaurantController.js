const mongoose = require("mongoose");
const Restaurant = require("../models/Restaurant");
const QRCode = require("qrcode");
const cloudinary = require("../config/cloudinary");
const { emitToRestaurant } = require("../services/socketService");
const crypto = require("crypto");
const UpiChangeVerification = require("../models/UpiChangeVerification");
/*
|--------------------------------------------------------------------------
| CONSTANTS
|--------------------------------------------------------------------------
*/

const MAX_NAME_LENGTH = 120;
const MAX_SLUG_LENGTH = 80;
const MAX_PHONE_LENGTH = 20;
const MAX_EMAIL_LENGTH = 150;

const MAX_STREET_LENGTH = 250;
const MAX_CITY_LENGTH = 100;
const MAX_STATE_LENGTH = 100;
const MAX_ZIP_LENGTH = 12;

const UPI_REGEX = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z]{2,64}$/;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PHONE_REGEX = /^\+?[0-9()\-\s]{7,20}$/;

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

/*
|--------------------------------------------------------------------------
| HELPERS
|--------------------------------------------------------------------------
*/

const getTenantId = (req) => {
  const restaurantId = req.user?.restaurantId;

  if (!restaurantId) {
    return null;
  }

  const id =
    typeof restaurantId === "object" ? restaurantId?._id : restaurantId;

  return id ? String(id) : null;
};

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const cleanString = (value, maxLength) => {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().replace(/\s+/g, " ").slice(0, maxLength);
};

const cleanSlug = (value) => {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_LENGTH);
};

const OTP_LENGTH = 6;
const OTP_EXPIRY_MINUTES = 10;
const OTP_RESEND_COOLDOWN_SECONDS = 60;
const MAX_OTP_ATTEMPTS = 5;
const VERIFICATION_TOKEN_EXPIRY_MINUTES = 10;

const getOtpSecret = () => {
  if (!process.env.UPI_OTP_SECRET) {
    throw new Error("UPI_OTP_SECRET is not configured");
  }

  return process.env.UPI_OTP_SECRET;
};

const generateOtp = () => {
  return crypto.randomInt(0, 1000000).toString().padStart(OTP_LENGTH, "0");
};

const hashValue = (value) => {
  return crypto
    .createHmac("sha256", getOtpSecret())
    .update(String(value))
    .digest("hex");
};

const generateVerificationToken = () => {
  return crypto.randomBytes(32).toString("hex");
};

const addMinutes = (minutes) => {
  return new Date(Date.now() + minutes * 60 * 1000);
};
/*
|--------------------------------------------------------------------------
| CLOUDINARY UPLOAD
|--------------------------------------------------------------------------
*/

const uploadBufferToCloudinary = (buffer, folder) =>
  new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image",

        transformation: [
          {
            width: 1000,
            height: 1000,
            crop: "limit",
            quality: "auto",
            fetch_format: "auto",
          },
        ],
      },

      (error, result) => {
        if (error) {
          return reject(error);
        }

        resolve(result);
      },
    );

    uploadStream.end(buffer);
  });

/*
|--------------------------------------------------------------------------
| UPDATE PROFILE
|--------------------------------------------------------------------------
*/

exports.updateRestaurantProfile = async (req, res) => {
  try {
    /*
     * --------------------------------------------------
     * TENANT
     * --------------------------------------------------
     */

    const restaurantId = getTenantId(req);

    if (!restaurantId || !isValidObjectId(restaurantId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid restaurant context",
      });
    }

    /*
     * --------------------------------------------------
     * LOAD ONLY CURRENT TENANT
     * --------------------------------------------------
     */

    const restaurant = await Restaurant.findOne({
      _id: restaurantId,
    }).select(
      "_id name slug phone email themeColor address upiId upiQrCode fssaiNumber gstNumber logo isActive isApproved",
    );

    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: "Restaurant not found",
      });
    }

    /*
     * Disabled restaurant should not be
     * modified through normal restaurant panel.
     */

    if (restaurant.isActive === false) {
      return res.status(403).json({
        success: false,
        message: "Restaurant account is disabled",
      });
    }

    const updates = {};

    /*
     * --------------------------------------------------
     * NAME
     * --------------------------------------------------
     */

    if (req.body.name !== undefined) {
      const name = cleanString(req.body.name, MAX_NAME_LENGTH);

      if (!name) {
        return res.status(400).json({
          success: false,
          message: "Restaurant name is required",
        });
      }

      updates.name = name;
    }

    /*
     * --------------------------------------------------
     * SLUG
     * --------------------------------------------------
     */

    if (req.body.slug !== undefined) {
      const slug = cleanSlug(req.body.slug);

      if (!slug || !SLUG_REGEX.test(slug)) {
        return res.status(400).json({
          success: false,
          message: "Invalid restaurant slug",
        });
      }

      /*
       * Tenant-independent uniqueness.
       *
       * Two restaurants must never
       * share the same public slug.
       */

      const existing = await Restaurant.findOne({
        slug,
        _id: {
          $ne: restaurant._id,
        },
      })
        .select("_id")
        .lean();

      if (existing) {
        return res.status(409).json({
          success: false,
          message: "This restaurant URL is already in use",
        });
      }

      updates.slug = slug;
    }

    /*
     * --------------------------------------------------
     * PHONE
     * --------------------------------------------------
     */

    if (req.body.phone !== undefined) {
      const phone = cleanString(req.body.phone, MAX_PHONE_LENGTH);

      if (phone && !PHONE_REGEX.test(phone)) {
        return res.status(400).json({
          success: false,
          message: "Invalid phone number",
        });
      }

      updates.phone = phone;
    }

    /*
     * --------------------------------------------------
     * EMAIL
     * --------------------------------------------------
     */

    if (req.body.email !== undefined) {
      const email = cleanString(req.body.email, MAX_EMAIL_LENGTH).toLowerCase();

      if (email && !EMAIL_REGEX.test(email)) {
        return res.status(400).json({
          success: false,
          message: "Invalid email address",
        });
      }

      updates.email = email;
    }

    /*
     * --------------------------------------------------
     * THEME COLOR
     * --------------------------------------------------
     */

    if (req.body.themeColor !== undefined) {
      const themeColor = cleanString(req.body.themeColor, 20);

      if (!/^#[0-9A-Fa-f]{6}$/.test(themeColor)) {
        return res.status(400).json({
          success: false,
          message: "Invalid theme color",
        });
      }

      updates.themeColor = themeColor;
    }

    /*
     * --------------------------------------------------
     * UPI
     * --------------------------------------------------
     */

    if (req.body.upiId !== undefined) {
      const requestedUpi =
        typeof req.body.upiId === "string"
          ? req.body.upiId.trim().toLowerCase()
          : "";

      /*
       * UPI is immutable after
       * first successful configuration.
       */

      if (restaurant.upiId) {
        if (!requestedUpi || requestedUpi !== restaurant.upiId.toLowerCase()) {
          return res.status(403).json({
            success: false,
            code: "UPI_LOCKED",
            message:
              "UPI ID is already configured and cannot be changed. Please contact platform admin.",
          });
        }
      } else {
        /*
         * First-time setup.
         */

        if (!requestedUpi) {
          updates.upiId = "";
          updates.upiQrCode = "";
        } else {
          if (!UPI_REGEX.test(requestedUpi)) {
            return res.status(400).json({
              success: false,
              code: "INVALID_UPI_ID",
              message: "Please enter a valid UPI ID",
            });
          }

          const restaurantName =
            updates.name || restaurant.name || "Restaurant";

          const upiString =
            `upi://pay?pa=${encodeURIComponent(requestedUpi)}` +
            `&pn=${encodeURIComponent(restaurantName)}` +
            `&cu=INR`;

          let qrCode;

          try {
            qrCode = await QRCode.toDataURL(upiString, {
              errorCorrectionLevel: "H",
              margin: 2,
              scale: 6,
              color: {
                dark: "#000000",
                light: "#FFFFFF",
              },
            });
          } catch (qrError) {
            console.error("QR generation failed:", qrError);

            return res.status(500).json({
              success: false,
              message: "Unable to generate payment QR",
            });
          }

          updates.upiId = requestedUpi;

          updates.upiQrCode = qrCode;
        }
      }
    }

    /*
     * --------------------------------------------------
     * FSSAI & GST
     * --------------------------------------------------
     */

    const FSSAI_REGEX = /^\d{14}$/;

    const GST_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

    // FSSAI
    if (req.body.fssaiNumber !== undefined) {
      const fssaiNumber =
        typeof req.body.fssaiNumber === "string"
          ? req.body.fssaiNumber.trim().toUpperCase()
          : "";

      if (fssaiNumber && !FSSAI_REGEX.test(fssaiNumber)) {
        return res.status(400).json({
          success: false,
          code: "INVALID_FSSAI_NUMBER",
          message: "FSSAI number must be exactly 14 digits",
        });
      }

      updates.fssaiNumber = fssaiNumber;
    }

    // GST
    if (req.body.gstNumber !== undefined) {
      const gstNumber =
        typeof req.body.gstNumber === "string"
          ? req.body.gstNumber.trim().toUpperCase()
          : "";

      if (gstNumber && !GST_REGEX.test(gstNumber)) {
        return res.status(400).json({
          success: false,
          code: "INVALID_GST_NUMBER",
          message: "Please enter a valid GST number",
        });
      }

      updates.gstNumber = gstNumber;
    }
    /*
     * --------------------------------------------------
     * ADDRESS
     * --------------------------------------------------
     *
     * Supports both:
     *
     * address: {...}
     *
     * and multipart:
     *
     * address[street]
     */

    const hasObjectAddress =
      req.body.address && typeof req.body.address === "object";

    const hasMultipartAddress =
      req.body["address[street]"] !== undefined ||
      req.body["address[city]"] !== undefined ||
      req.body["address[state]"] !== undefined ||
      req.body["address[zip]"] !== undefined;

    if (hasObjectAddress || hasMultipartAddress) {
      const source = hasObjectAddress ? req.body.address : req.body;

      const current = restaurant.address || {};

      updates.address = {
        street:
          source.street !== undefined
            ? cleanString(source.street, MAX_STREET_LENGTH)
            : current.street || "",

        city:
          source.city !== undefined
            ? cleanString(source.city, MAX_CITY_LENGTH)
            : current.city || "",

        state:
          source.state !== undefined
            ? cleanString(source.state, MAX_STATE_LENGTH)
            : current.state || "",

        zip:
          source.zip !== undefined
            ? cleanString(source.zip, MAX_ZIP_LENGTH)
            : current.zip || "",
      };
    }

    /*
     * --------------------------------------------------
     * LOGO
     * --------------------------------------------------
     */

    if (req.file) {
      if (!ALLOWED_IMAGE_TYPES.has(req.file.mimetype)) {
        return res.status(400).json({
          success: false,
          message: "Only JPG, PNG and WebP images are allowed",
        });
      }

      if (req.file.size > 5 * 1024 * 1024) {
        return res.status(413).json({
          success: false,
          message: "Logo image must be smaller than 5MB",
        });
      }

      try {
        const uploadResult = await uploadBufferToCloudinary(
          req.file.buffer,
          "chotu/restaurants/logos",
        );

        updates.logo = uploadResult.secure_url;
      } catch (uploadError) {
        console.error("Cloudinary upload failed:", uploadError);

        return res.status(502).json({
          success: false,
          message: "Unable to upload restaurant logo",
        });
      }
    }

    /*
     * --------------------------------------------------
     * NOTHING TO UPDATE
     * --------------------------------------------------
     */

    if (Object.keys(updates).length === 0) {
      return res.status(200).json({
        success: true,
        message: "No changes were required",
        data: restaurant,
      });
    }

    /*
     * --------------------------------------------------
     * ATOMIC TENANT-SCOPED UPDATE
     * --------------------------------------------------
     */

    const updatedRestaurant = await Restaurant.findOneAndUpdate(
      {
        _id: restaurantId,
      },
      {
        $set: updates,
      },
      {
        new: true,
        runValidators: true,
      },
    )
      .select(
        "_id name slug phone email themeColor address logo upiId upiQrCode fssaiNumber gstNumber isActive isApproved",
      )
      .lean();

    if (!updatedRestaurant) {
      return res.status(404).json({
        success: false,
        message: "Restaurant not found",
      });
    }

    /*
     * --------------------------------------------------
     * REALTIME TENANT EVENT
     * --------------------------------------------------
     */

    emitToRestaurant(restaurantId, "RESTAURANT_PROFILE_UPDATED", {
      restaurantId,
      changes: Object.keys(updates),
    });

    return res.status(200).json({
      success: true,
      message: "Restaurant profile updated successfully",
      data: updatedRestaurant,
    });
  } catch (error) {
    /*
     * Mongo unique index protection.
     */

    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Restaurant slug is already in use",
      });
    }

    console.error("Update Restaurant Profile:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to update restaurant profile",
    });
  }
};

/*
|--------------------------------------------------------------------------
| PUBLIC RESTAURANT DETAILS
|--------------------------------------------------------------------------
*/

exports.getPublicRestaurantDetails = async (req, res) => {
  try {
    const slug = cleanSlug(req.params?.slug);

    if (!slug) {
      return res.status(400).json({
        success: false,
        message: "Invalid restaurant slug",
      });
    }

    /*
     * IMPORTANT:
     *
     * Public endpoint must NEVER
     * return complete Restaurant document.
     */

    const restaurant = await Restaurant.findOne({
      slug,
      isActive: true,
    })
      .select("_id name slug logo themeColor address isActive")
      .lean();

    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: "Restaurant not found or disabled",
      });
    }

    return res.status(200).json({
      success: true,
      data: restaurant,
    });
  } catch (error) {
    console.error("Get Public Restaurant:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to load restaurant",
    });
  }
};

/*
|--------------------------------------------------------------------------
| ADMIN PROFILE
|--------------------------------------------------------------------------
*/

exports.getRestaurantProfile = async (req, res) => {
  try {
    const restaurantId = getTenantId(req);

    if (!restaurantId || !isValidObjectId(restaurantId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid restaurant context",
      });
    }

    /*
     * Explicit tenant-scoped query.
     */

    const restaurant = await Restaurant.findOne({
      _id: restaurantId,
    })
      .select(
        "_id name slug phone email themeColor address logo upiId upiQrCode fssaiNumber gstNumber isActive isApproved",
      )
      .lean();

    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: "Restaurant not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: restaurant,
    });
  } catch (error) {
    console.error("Get Restaurant Profile:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to load restaurant profile",
    });
  }
};

exports.requestUpiChangeOtp = async (req, res) => {
  try {
    const restaurantId = getTenantId(req);
    const userId = req.user?._id;

    // --------------------------------------------------
    // 1. Validate tenant context
    // --------------------------------------------------
    if (!restaurantId || !isValidObjectId(restaurantId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid restaurant context",
      });
    }

    // --------------------------------------------------
    // 2. Validate authentication
    // --------------------------------------------------
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    // --------------------------------------------------
    // 3. OWNER ONLY
    // --------------------------------------------------
    if (req.user?.role !== "OWNER") {
      return res.status(403).json({
        success: false,
        code: "OWNER_ONLY",
        message: "Only restaurant owner can change UPI ID",
      });
    }

    // --------------------------------------------------
    // 4. Get restaurant
    //
    // IMPORTANT:
    // Email is taken from Restaurant.email
    // NOT req.user.email
    // --------------------------------------------------
    const restaurant = await Restaurant.findOne({
      _id: restaurantId,
      isActive: true,
    })
      .select("_id name email upiId")
      .lean();

    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: "Restaurant not found",
      });
    }

    // --------------------------------------------------
    // 5. UPI must already be configured
    // --------------------------------------------------
    if (!restaurant.upiId) {
      return res.status(400).json({
        success: false,
        code: "UPI_NOT_CONFIGURED",
        message: "UPI ID is not configured yet",
      });
    }

    // --------------------------------------------------
    // 6. Get EMAIL FROM RESTAURANT PROFILE
    //
    // This is the important change.
    // OTP will be sent to:
    //
    // Restaurant.email
    //
    // NOT:
    // req.user.email
    // --------------------------------------------------
    const restaurantEmail = String(restaurant.email || "")
      .trim()
      .toLowerCase();

    // --------------------------------------------------
    // 7. Validate Restaurant Profile email
    // --------------------------------------------------
    if (!restaurantEmail || !EMAIL_REGEX.test(restaurantEmail)) {
      return res.status(400).json({
        success: false,
        code: "RESTAURANT_EMAIL_NOT_CONFIGURED",
        message: "Restaurant profile email is not configured",
      });
    }

    // --------------------------------------------------
    // 8. Find latest active OTP request
    // --------------------------------------------------
    const existing = await UpiChangeVerification.findOne({
      restaurantId,
      userId,
      usedAt: null,
      verifiedAt: null,
    }).sort({ createdAt: -1 });

    // --------------------------------------------------
    // 9. 60-second resend cooldown
    // --------------------------------------------------
    if (existing?.lastSentAt) {
      const elapsed = Date.now() - new Date(existing.lastSentAt).getTime();

      if (elapsed < OTP_RESEND_COOLDOWN_SECONDS * 1000) {
        const retryAfter = Math.ceil(
          (OTP_RESEND_COOLDOWN_SECONDS * 1000 - elapsed) / 1000,
        );

        return res.status(429).json({
          success: false,
          code: "OTP_COOLDOWN",
          message: `Please wait ${retryAfter} seconds before requesting another OTP`,
          retryAfter,
        });
      }
    }

    // --------------------------------------------------
    // 10. Invalidate previous OTP requests
    // --------------------------------------------------
    await UpiChangeVerification.updateMany(
      {
        restaurantId,
        userId,
        usedAt: null,
        verifiedAt: null,
      },
      {
        $set: {
          usedAt: new Date(),
        },
      },
    );

    // --------------------------------------------------
    // 11. Generate OTP
    // --------------------------------------------------
    const otp = generateOtp();

    // --------------------------------------------------
    // 12. Create verification record
    // --------------------------------------------------
    const verification = await UpiChangeVerification.create({
      restaurantId,
      userId,

      // IMPORTANT:
      // Save Restaurant Profile email
      email: restaurantEmail,

      // Never save raw OTP
      otpHash: hashValue(otp),

      otpExpiresAt: addMinutes(OTP_EXPIRY_MINUTES),

      attempts: 0,
      maxAttempts: MAX_OTP_ATTEMPTS,

      lastSentAt: new Date(),

      ipAddress: req.ip || "",
      userAgent: req.get("user-agent") || "",
    });

    // --------------------------------------------------
    // 13. Send OTP email
    // --------------------------------------------------
    try {
      const { sendUpiChangeOtp } = require("../services/emailService");

      await sendUpiChangeOtp({
        // IMPORTANT:
        // OTP goes to Restaurant.email
        email: restaurantEmail,

        restaurantName: restaurant.name,

        otp,
      });
    } catch (emailError) {
      // ------------------------------------------------
      // Email failed -> invalidate OTP immediately
      // ------------------------------------------------
      await UpiChangeVerification.updateOne(
        {
          _id: verification._id,
        },
        {
          $set: {
            usedAt: new Date(),
          },
        },
      );

      console.error("UPI OTP email failed:", emailError);

      return res.status(502).json({
        success: false,
        code: "OTP_EMAIL_FAILED",
        message: "Unable to send verification email. Please try again later.",
      });
    }

    // --------------------------------------------------
    // 14. Mask email for frontend
    // --------------------------------------------------
    const maskedEmail = restaurantEmail.replace(/^(.{2}).*(@.*)$/, "$1***$2");

    // --------------------------------------------------
    // 15. Success
    // --------------------------------------------------
    return res.status(200).json({
      success: true,

      message: "Verification OTP has been sent to the restaurant profile email",

      expiresInSeconds: OTP_EXPIRY_MINUTES * 60,

      maskedEmail,
    });
  } catch (error) {
    console.error("Request UPI Change OTP:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to start UPI change verification",
    });
  }
};

exports.verifyUpiChangeOtp = async (req, res) => {
  try {
    const restaurantId = getTenantId(req);
    const userId = req.user?._id;

    if (!restaurantId || !isValidObjectId(restaurantId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid restaurant context",
      });
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (req.user?.role !== "OWNER") {
      return res.status(403).json({
        success: false,
        code: "OWNER_ONLY",
        message: "Only restaurant owner can verify UPI change",
      });
    }

    const otp = String(req.body?.otp || "").trim();

    if (!/^\d{6}$/.test(otp)) {
      return res.status(400).json({
        success: false,
        code: "INVALID_OTP_FORMAT",
        message: "Please enter a valid 6-digit OTP",
      });
    }

    const verification = await UpiChangeVerification.findOne({
      restaurantId,
      userId,
      usedAt: null,
      verifiedAt: null,
    }).sort({ createdAt: -1 });

    if (!verification) {
      return res.status(400).json({
        success: false,
        code: "OTP_NOT_FOUND",
        message: "Verification request not found or already expired",
      });
    }

    /*
     * Expiry check.
     */
    if (verification.otpExpiresAt.getTime() < Date.now()) {
      await UpiChangeVerification.updateOne(
        { _id: verification._id },
        {
          $set: {
            usedAt: new Date(),
          },
        },
      );

      return res.status(400).json({
        success: false,
        code: "OTP_EXPIRED",
        message: "OTP has expired. Please request a new OTP.",
      });
    }

    /*
     * Attempt limit.
     */
    if (verification.attempts >= verification.maxAttempts) {
      await UpiChangeVerification.updateOne(
        { _id: verification._id },
        {
          $set: {
            usedAt: new Date(),
          },
        },
      );

      return res.status(429).json({
        success: false,
        code: "OTP_ATTEMPTS_EXCEEDED",
        message: "Too many incorrect attempts. Please request a new OTP.",
      });
    }

    const incomingHash = hashValue(otp);

    const isValid = crypto.timingSafeEqual(
      Buffer.from(incomingHash, "hex"),
      Buffer.from(verification.otpHash, "hex"),
    );

    if (!isValid) {
      const updated = await UpiChangeVerification.findOneAndUpdate(
        {
          _id: verification._id,
          usedAt: null,
          verifiedAt: null,
        },
        {
          $inc: {
            attempts: 1,
          },
        },
        {
          new: true,
        },
      );

      const remaining = Math.max(
        0,
        verification.maxAttempts -
          (updated?.attempts || verification.attempts + 1),
      );

      return res.status(400).json({
        success: false,
        code: "INVALID_OTP",
        message: "Incorrect OTP",
        remainingAttempts: remaining,
      });
    }

    /*
     * Generate one-time verification token.
     */
    const verificationToken = generateVerificationToken();

    const verificationTokenHash = hashValue(verificationToken);

    await UpiChangeVerification.updateOne(
      {
        _id: verification._id,
        usedAt: null,
        verifiedAt: null,
      },
      {
        $set: {
          verifiedAt: new Date(),
          verificationTokenHash,
          verificationTokenExpiresAt: addMinutes(
            VERIFICATION_TOKEN_EXPIRY_MINUTES,
          ),
        },
      },
    );

    return res.status(200).json({
      success: true,
      message: "OTP verified successfully. You can now change your UPI ID.",

      /*
       * Frontend sends this token only to the
       * dedicated UPI change endpoint.
       */
      verificationToken,

      expiresInSeconds: VERIFICATION_TOKEN_EXPIRY_MINUTES * 60,
    });
  } catch (error) {
    console.error("Verify UPI Change OTP:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to verify OTP",
    });
  }
};

exports.changeUpiId = async (req, res) => {
  try {
    const restaurantId = getTenantId(req);
    const userId = req.user?._id;

    if (!restaurantId || !isValidObjectId(restaurantId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid restaurant context",
      });
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    /*
     * OWNER ONLY
     */
    if (req.user?.role !== "OWNER") {
      return res.status(403).json({
        success: false,
        code: "OWNER_ONLY",
        message: "Only restaurant owner can change UPI ID",
      });
    }

    const verificationToken = String(
      req.headers["x-upi-verification-token"] || "",
    ).trim();

    if (!verificationToken) {
      return res.status(403).json({
        success: false,
        code: "UPI_VERIFICATION_REQUIRED",
        message: "UPI change verification is required",
      });
    }

    if (verificationToken.length !== 64) {
      return res.status(403).json({
        success: false,
        code: "INVALID_VERIFICATION_TOKEN",
        message: "Invalid UPI verification token",
      });
    }

    const requestedUpi =
      typeof req.body?.upiId === "string"
        ? req.body.upiId.trim().toLowerCase()
        : "";

    if (!requestedUpi) {
      return res.status(400).json({
        success: false,
        code: "INVALID_UPI_ID",
        message: "UPI ID is required",
      });
    }

    if (!UPI_REGEX.test(requestedUpi)) {
      return res.status(400).json({
        success: false,
        code: "INVALID_UPI_ID",
        message: "Please enter a valid UPI ID",
      });
    }

    /*
     * Hash supplied verification token.
     */
    const tokenHash = hashValue(verificationToken);

    /*
     * CRITICAL TENANT + USER SCOPING
     */
    const verification = await UpiChangeVerification.findOne({
      restaurantId,
      userId,

      verificationTokenHash: tokenHash,

      verifiedAt: {
        $ne: null,
      },

      usedAt: null,

      verificationTokenExpiresAt: {
        $gt: new Date(),
      },
    });

    if (!verification) {
      return res.status(403).json({
        success: false,
        code: "UPI_VERIFICATION_INVALID",
        message:
          "UPI verification is invalid or expired. Please verify OTP again.",
      });
    }

    /*
     * Load current tenant.
     */
    const restaurant = await Restaurant.findOne({
      _id: restaurantId,
      isActive: true,
    }).select("_id name upiId upiQrCode");

    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: "Restaurant not found",
      });
    }

    /*
     * Generate NEW QR.
     */
    const upiString =
      `upi://pay?pa=${encodeURIComponent(requestedUpi)}` +
      `&pn=${encodeURIComponent(restaurant.name || "Restaurant")}` +
      `&cu=INR`;

    let qrCode;

    try {
      qrCode = await QRCode.toDataURL(upiString, {
        errorCorrectionLevel: "H",
        margin: 2,
        scale: 6,
        color: {
          dark: "#000000",
          light: "#FFFFFF",
        },
      });
    } catch (qrError) {
      console.error("UPI QR generation failed:", qrError);

      return res.status(500).json({
        success: false,
        message: "Unable to generate payment QR",
      });
    }

    /*
     * Atomic tenant-scoped update.
     *
     * We also make sure UPI still exists,
     * because this endpoint is only for changing
     * an already configured UPI.
     */
    const updatedRestaurant = await Restaurant.findOneAndUpdate(
      {
        _id: restaurantId,
        isActive: true,

        upiId: {
          $exists: true,
          $nin: ["", null],
        },
      },
      {
        $set: {
          upiId: requestedUpi,
          upiQrCode: qrCode,
        },
      },
      {
        new: true,
        runValidators: true,
      },
    )
      .select(
        "_id name slug phone email themeColor address logo upiId upiQrCode fssaiNumber gstNumber isActive isApproved",
      )
      .lean();

    if (!updatedRestaurant) {
      return res.status(409).json({
        success: false,
        code: "UPI_CHANGE_CONFLICT",
        message: "UPI configuration changed. Please start verification again.",
      });
    }

    /*
     * Consume verification token.
     *
     * One token = one UPI change.
     */
    const consumed = await UpiChangeVerification.findOneAndUpdate(
      {
        _id: verification._id,
        usedAt: null,
      },
      {
        $set: {
          usedAt: new Date(),
        },
      },
      {
        new: true,
      },
    );

    if (!consumed) {
      /*
       * Extremely defensive check.
       *
       * Ideally transaction is better for strict
       * atomicity between verification consumption
       * and restaurant update.
       */
      return res.status(409).json({
        success: false,
        code: "VERIFICATION_ALREADY_USED",
        message: "Verification has already been used",
      });
    }

    /*
     * Tenant-specific realtime event.
     */
    emitToRestaurant(restaurantId, "RESTAURANT_UPI_UPDATED", {
      restaurantId,
      changedBy: String(userId),
    });

    return res.status(200).json({
      success: true,
      message: "UPI ID updated successfully",
      data: {
        upiId: updatedRestaurant.upiId,
        upiQrCode: updatedRestaurant.upiQrCode,
      },
    });
  } catch (error) {
    console.error("Change UPI ID:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to change UPI ID",
    });
  }
};
