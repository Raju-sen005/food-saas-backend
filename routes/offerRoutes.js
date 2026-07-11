const express = require("express");
const router = express.Router();
const { createOffer, getOffers, deleteOffer } = require("../controllers/offerController");
const { protect } = require("../middleware/auth"); // Apne auth middleware ka path dein

router.route("/")
  .get(protect, getOffers)
  .post(protect, createOffer);

router.route("/:id")
  .delete(protect, deleteOffer);

module.exports = router;