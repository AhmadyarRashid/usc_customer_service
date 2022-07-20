const express = require("express");
const quotaController = require("../controllers/quotaController.js");
const { verifyToken } = require("../helpers/auth");

const router = express.Router();

// routes
router.get(
    "/:cnic",
    // verifyToken,
    quotaController.get_user_quota
);
router.post(
    "/:cnic",
    // verifyToken,
    quotaController.update_user_quota
);

module.exports = router;
