const express = require("express");

const router = express.Router();

const {
  updateRestaurantProfile,
  getPublicRestaurantDetails,
  getRestaurantProfile,
   requestUpiChangeOtp,
  verifyUpiChangeOtp,
  changeUpiId,
} = require("../controllers/restaurantController");

const {
  protect,
  authorize,
} = require("../middleware/auth");

const tenantContext =
  require("../middleware/tenant");

const upload =
  require("../middleware/upload");

/*
|--------------------------------------------------------------------------
| ADMIN PROFILE READ
|--------------------------------------------------------------------------
*/
/*
|--------------------------------------------------------------------------
| UPI CHANGE SECURITY FLOW
|--------------------------------------------------------------------------
*/

/*
 * Step 1:
 * Send OTP to authenticated OWNER email.
 */
router.post(
  "/profile/upi/request-otp",
  protect,
  authorize("OWNER"),
  tenantContext,
  requestUpiChangeOtp
);

/*
 * Step 2:
 * Verify OTP.
 */
router.post(
  "/profile/upi/verify-otp",
  protect,
  authorize("OWNER"),
  tenantContext,
  verifyUpiChangeOtp
);

/*
 * Step 3:
 * Change UPI after successful verification.
 */
router.patch(
  "/profile/upi",
  protect,
  authorize("OWNER"),
  tenantContext,
  changeUpiId
);

router.get(
  "/profile",
  protect,
  authorize(
    "OWNER",
    "MANAGER"
  ),
  tenantContext,
  getRestaurantProfile
);

/*
|--------------------------------------------------------------------------
| ADMIN PROFILE UPDATE
|--------------------------------------------------------------------------
|
| OWNER + MANAGER
|
| If only OWNER should be allowed to
| change UPI/business identity, create
| a separate OWNER-only endpoint later.
|
*/

router.patch(
  "/profile",
  protect,
  authorize(
    "OWNER",
    "MANAGER"
  ),
  tenantContext,
  upload.single("logo"),
  updateRestaurantProfile
);

/*
|--------------------------------------------------------------------------
| PUBLIC RESTAURANT
|--------------------------------------------------------------------------
*/

router.get(
  "/public/:slug",
  getPublicRestaurantDetails
);

module.exports = router;