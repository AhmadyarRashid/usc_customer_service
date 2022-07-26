const express = require("express");
const router = express.Router();

router.use("/sms", require("./sms.routes"));
router.use("/quota", require("./quota.routes"));

module.exports = router;
