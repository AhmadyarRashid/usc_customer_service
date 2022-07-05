const jwt = require("jsonwebtoken");
const axios = require("axios");
const db = require("../helpers/db");
const { getResponseObject } = require("../helpers/response");
const constants = require("../config/constants");
const winston = require("../config/winston");

var util = require('util')

// constant variables
let ntcToken = '';

// helper functions
const loginNTC12 = callback => {
  winston.info('ready to hit Login API');

  axios
    .post(`${constants.ntcBaseUrl}`, {
      process: constants.process,
      userid: constants.ntcUserId,
      pass: constants.ntcPass
    })
    .then(response => {
      const apiResponse = response.data;
      winston.info(`response rescode : ${apiResponse.rescode}`);
      winston.info(`response data : ${apiResponse.data}`);
      if (apiResponse.rescode === 1) {
        ntcToken = apiResponse.data || '';
      }
      callback();
    })
    .catch(error => {
      winston.error(`login api error: ${error}`);
      callback();
    });
};

const sendMessage = (to, message, callback = () => null) => {
  winston.info('ready to hit Send Message API');
  axios
    .post(`${constants.ntcBaseUrl}`, {
      process: 'SEND_SMS',
      userid: constants.ntcUserId,
      token: ntcToken,
      MSISDN: to,
      from: constants.shortCode,
      message,
      dlr: 1
    })
    .then(async response => {
      const parseResponse = response.data;
      winston.info(`Send SMS Response : ${JSON.stringify(parseResponse)}`);
      if (parseResponse['rescode'] === 0) {
        loginNTC12(() => {
          sendMessage(to, message);
          callback(null, true);
        })
      } else {
        callback(null, true);
      }
    })
    .catch(error => {
      callback('Something went wrong', null);
      winston.error(`send Message api error: ${error}`);
    })
};

// controllers
module.exports.loginNTC = (req, res) => {
  winston.info('loginNTC');
  axios
    .post(`${constants.ntcBaseUrl}`, {
      process: constants.process,
      userid: constants.ntcUserId,
      pass: constants.ntcPass
    })
    .then(response => {
      const apiResponse = response.data
      winston.info(`response rescode : ${apiResponse.rescode}`);
      winston.info(`response data : ${apiResponse.data}`);
      if (apiResponse.rescode === 1) {
        ntcToken = apiResponse.data || '';
      }
      res.status(200).send(getResponseObject(apiResponse, 200, 0));
    })
    .catch(error => {
      winston.error(`login api error: ${error}`);
      res.status(500).send(getResponseObject('Login API Failed:', 500, 0));
    })
}

module.exports.login = async function (req, res) {
  const { username, password } = req.body;
  try {
    const user = await db.executeQuery(`select * from logins where username = ? and password = ? limit 1`,
      [username, password]);
    if (user.length > 0) {
      const userPayload = {
        userId: user[0].id,
        username: user[0].username,
      };
      // Create token
      console.log("token:", constants.tokenKey)
      const token = jwt.sign(
        userPayload,
        constants.tokenKey,
        {
          expiresIn: "2h",
        }
      );
      res.status(200).send(getResponseObject("Login Successfully", 200, 1, { token, ...userPayload }));
    } else {
      res.status(401).send(getResponseObject("Wrong credentials", 401, 0));
    }
  } catch (error) {
    console.log(error);
    winston.error(`Login:  Payload ${JSON.stringify(req.body)} and its error ${error}`);
    res.status(500).send(getResponseObject("Something went wrong.", 500, 0));
  }
};

module.exports.recievedSMS = async function (req, res) {
  winston.info(`Receive NTC SMS Request Body: ${JSON.stringify(req.body)}`);
  const { from, text } = req.body;
  try {
    // text contains number and its length must be 13
    const userCNIC = parseInt(text);
    if (userCNIC && userCNIC.toString().length == 13) {
      // check if cnic exists and its verified or not
      const isCnicExists = await db.executeQuery(`select * from users where cnic = ?`, [String(userCNIC)]);
      if (isCnicExists.length == 0) { // is cnic not exists
        const isMobileNoExists = await db.executeQuery(`select * from users where mobile_no = ?`, [from]);
        if (isMobileNoExists.length > 0) {
          winston.info('This Mobile No already registered with other CNIC. Please use differnt mobile no');
          sendMessage(from, 'This Mobile No already registered with other CNIC. Please use differnt mobile no', (error, response) => {
            if (error) {
              res.status(200).send({ "rescode": 0, "message": "Failed" });
            } else {
              res.status(200).send({ "rescode": 1, "message": "Success" });
            }
          });
          // res.status(200).send(getResponseObject("This Mobile No already registered with other CNIC. Please use differnt mobile no.", 400, 0));
          return;
        }

        winston.info(`CNIC Doesn't exist in DB`);
        const OTP = Math.floor(Math.random() * 100000);
        await db.executeQuery(`insert into users (cnic, mobile_no, otp, created_date, status) values (?,?,?,?,?)`,
          [String(userCNIC), String(from), OTP, new Date(), true]);
        winston.info(`Your OTP is ${OTP}`);
        sendMessage(from, `Your OTP is ${OTP}`, (error, response) => {
          if (error) {
            res.status(200).send({ "rescode": 0, "message": "Failed" });
          } else {
            res.status(200).send({ "rescode": 1, "message": "Success" });
          }
        });
        // res.status(200).send(getResponseObject(`Your OTP is ${OTP}`, 200, 1));
      } else if (isCnicExists.length > 0 && isCnicExists[0]['mobile_no'] !== from) {  // If CNIC exists but mobile no diff
        winston.info(`Your CNIC registered with different mobile no`);
        sendMessage(from, 'Your CNIC registered with different mobile no', (error, response) => {
          if (error) {
            res.status(200).send({ "rescode": 0, "message": "Failed" });
          } else {
            res.status(200).send({ "rescode": 1, "message": "Success" });
          }
        });
        // res.status(200).send(getResponseObject("Your CNIC registered with different mobile no.", 400, 0));
      } else {  // rest of scenarios handle here
        const OTP = Math.floor(Math.random() * 100000);
        await db.executeQuery(`update users set otp = ?, status = ? where cnic = ?`, [OTP, true, String(userCNIC)]);
        winston.info(`Your OTP is ${OTP}`);
        sendMessage(from, `Your OTP is ${OTP}`, (error, response) => {
          if (error) {
            res.status(200).send({ "rescode": 0, "message": "Failed" });
          } else {
            res.status(200).send({ "rescode": 1, "message": "Success" });
          }
        });
        // res.status(200).send(getResponseObject(`Your OTP is ${OTP}`, 200, 1));
      }
    } else {
      winston.info('Please send valid 13 digit CNIC without dashes');
      sendMessage(from, 'Please send valid 13 digit CNIC without dashes', (error, response) => {
        if (error) {
          res.status(200).send({ "rescode": 0, "message": "Failed" });
        } else {
          res.status(200).send({ "rescode": 1, "message": "Success" });
        }
      });
      // res.status(400).send(getResponseObject("Please send valid 13 digit CNIC without dashes", 400, 0));
    }
  } catch (error) {
    winston.error(`Verify OTP:  Payload ${JSON.stringify(req.body)} and its error ${error}`);
    res.status(500).send(getResponseObject("Something went wrong.", 500, 0));
  }
};

module.exports.getMobileNo = async (req, res) => {
  const { cnic } = req.params;
  try {
    const fetchMobileNo = await db.executeQuery(`select cnic, mobile_no from users where cnic = ? limit 1`, [cnic]);
    if (fetchMobileNo.length < 1) {
      res.status(200).send(getResponseObject('No Data Found', 404, 1));
    } else {
      res.status(200).send(getResponseObject('Data fetched', 200, 1, fetchMobileNo[0]));
    }
  } catch (error) {
    console.log(error);
    winston.error(`Fetch Information:  Payload ${JSON.stringify(req.body)} and its error ${error}`);
    res.status(500).send(getResponseObject("Something went wrong.", 500, 0));
  }
};

module.exports.verifyOTP = async (req, res) => {
  const { cnic, otp: OTP } = req.body;
  try {
    const fetchMobileNo = await db.executeQuery(`select otp, mobile_no from users where cnic = ? limit 1`, [cnic]);
    if (fetchMobileNo.length < 1) {
      res.status(200).send(getResponseObject('No Data Found against CNIC', 404, 1));
    } else {
      const { otp, mobile_no } = fetchMobileNo[0];
      const stericMobileNo = "+92*****" + String(mobile_no).substring(7);
      if (OTP == otp) {
        await db.executeQuery(`update users set otp = ?, status = ? where cnic = ?`, [null, false, cnic]);
        res.status(200).send(getResponseObject('OTP Verified', 200, 1));
      } else {
        res.status(200).send(getResponseObject('Wrong OTP', 200, 0, { cnic, mobile_no: stericMobileNo }));
      }
    }
  } catch (error) {
    winston.error(`Verify OTP:  Payload ${JSON.stringify(req.body)} and its error ${error}`);
    res.status(500).send(getResponseObject("Something went wrong.", 500, 0));
  }
};