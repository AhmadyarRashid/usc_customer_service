const express = require("express");
const quotaController = require("../controllers/quotaController.js");
const { verifyToken } = require("../helpers/auth");

const router = express.Router();

// routes
router.get(
    "/bisp/:cnic",
    quotaController.get_user_quota
);
router.post(
    "/bisp/:cnic",
    quotaController.update_user_quota
);

router.get(
    "/general/:cnic",
    quotaController.get_user_general_quota
);
router.post(
    "/general/:cnic",
    quotaController.update_user_general_quota
);

router.post(
    "/:cnic/familyId",
    verifyToken,
    quotaController.upate_family_id
);

module.exports = router;
