const express = require("express");
const router = express.Router();

router.use("/sms", require("./sms.routes"));

module.exports = router;
