const express = require("express");
const router = express.Router();
const { createOffer, getOffers, deleteOffer } = require("../controllers/offerController");
const { protect, restrictTo } = require("../middleware/auth");

router.route("/")
  .get(protect, getOffers)
  .post(protect, restrictTo('OWNER'), createOffer);

router.route("/:id")
  .delete(protect, restrictTo('OWNER'), deleteOffer);

module.exports = router;