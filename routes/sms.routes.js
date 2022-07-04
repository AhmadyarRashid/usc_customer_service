const express = require("express");
const smsController = require("../controllers/smsController");
const { verifyToken } = require("../helpers/auth");

const router = express.Router();

// routes
router.post("/login", smsController.login);
router.post("/", smsController.recievedSMS);
router.get("/:cnic", verifyToken, smsController.getMobileNo);
router.post("/verify-otp", verifyToken, smsController.verifyOTP);

router.post("/login-ntc", smsController.loginNTC);

module.exports = router;
