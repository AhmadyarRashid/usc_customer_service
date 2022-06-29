const jwt = require("jsonwebtoken");
const constant = require("../config/constants");
const { getResponseObject } = require("./response");

module.exports.verifyToken = (req, res, next) => {
  if (!req.headers.authorization || !req.headers.authorization.startsWith(constant.tokenHeaderKey)) {
    res.status(401).send(getResponseObject("un-authorized", 401, 0));
  } else {
    const idToken = req.headers.authorization.substring(7, req.headers.authorization.length);
    try {
      req.user = jwt.verify(idToken, constant.tokenKey);
    } catch (err) {
      console.log(err);
      res.status(401).send(getResponseObject("un-authorized", 401, 0));
    }
    return next();
  }
};