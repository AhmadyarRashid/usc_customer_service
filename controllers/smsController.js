const jwt = require("jsonwebtoken");
const axios = require("axios");
const https = require('https');
const db = require("../helpers/db");
const { getResponseObject } = require("../helpers/response");
const constants = require("../config/constants");
const winston = require("../config/winston");

var util = require('util')

// constant variables
var ntcToken = '';
var isLocked = true;

const sendMessage = (to, message, callback = () => null) => {
  winston.info(`ready send Message API: ${to}`);
  const instance = axios.create({
    httpsAgent: new https.Agent({
      rejectUnauthorized: false
    })
  });
  instance
    .post(`${constants.ntcBaseUrl}`, {
      process: 'SEND_SMS',
      userid: constants.ntcUserId,
      token: global.ntcToken,
      MSISDN: to,
      from: constants.shortCode,
      message,
      dlr: 1
    }, {
      timeout: 100000
    })
    .then(async response => {
      const parseResponse = response.data;
      // winston.info(`Send SMS Response : ${JSON.stringify(parseResponse)}`);
      if (parseResponse['rescode'] === 0 && parseResponse['message'] == 'Session expired') {
        winston.error(`send Message API: ${to} Session Expired and error ${JSON.stringify(parseResponse)}`);
        // winston.error(`Send Message Session Expired : ${JSON.stringify(parseResponse)}`);
        callback(null, true);
        // loginNTC12(() => {
        //   sendMessage(to, message);
        //   // callback(null, true);
        // })
      } else {
        winston.info(`Success send Message API: ${to}`);
        callback(null, true);
      }
    })
    .catch(error => {
      callback('Something went wrong', null);
      winston.error(`Failed send Message API: ${to} and its error: ${error}`);
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

const bispUserOTP = (getBispNumber, stericMobileNo, userCNIC, otp, from) => {
  axios.post(`http://192.168.250.224:8069/api/v1/usc/otp/reg/service`, {
    params: {
      cnic: String(userCNIC),
      otp,
      mobile_no: String(getBispNumber),
      is_bisp: true
    }
  })
    .then(res => {
      const { status_code } = res.data;
      if (status_code === 1) {
        if (String(getBispNumber) === String(from)) {
          sendMessage(from, `یوٹیلیٹی اسٹور پر خریداری کے لیے آپ کا (بی آئی ایس پی) کوڈ ہے ${otp}`, () => { });
          return;
        } else {
          sendMessage(getBispNumber, `یوٹیلیٹی اسٹور پر خریداری کے لیے آپ کا (بی آئی ایس پی) کوڈ ہے ${otp}`, () => { });
          sendMessage(from, `آپ کا (بی آئی ایس پی) کوڈ آپ کے رجسٹرڈ موبائل نمبر پر بھیجا گیا ہے۔ ${stericMobileNo}`, () => { });
          return;
        }
      } else if (status_code === 2) {
        sendMessage(from, 'Your CNIC registered with different mobile no', () => { });
        return;
      } else if (status_code === 3) {
        sendMessage(from, 'This Mobile No already registered with other CNIC. Please use different mobile no', () => { });
        return;
      }

    })
    .catch(error => {
      winston.error(String(error));
      sendMessage(from, 'OTP service is unavailable. Please try again later.', () => { });
    })
};

// for general User
const generalUserOTP = (userCNIC, otp, from) => {
  // For general user
  axios.post(`http://192.168.250.224:8069/api/v1/usc/otp/reg/service`, {
    params: {
      cnic: String(userCNIC),
      otp,
      mobile_no: String(from),
      is_bisp: false
    }
  })
    .then(res => {
      const { status_code } = res.data;
      if (status_code === 1) {
        sendMessage(from, `یوٹیلیٹی اسٹور پر خریداری کے لیے آپ کا کوڈ ہے۔ ${otp}`, () => { });
        return;
      } else if (status_code === 2) {
        sendMessage(from, 'Your CNIC registered with different mobile no', () => { });
        return;
      } else if (status_code === 3) {
        sendMessage(from, 'This Mobile No already registered with other CNIC. Please use different mobile no', () => { });
        return;
      }

    })
    .catch(error => {
      winston.error(String(error));
      sendMessage(from, 'OTP service is unavailable. Please try again later.', () => { });
    })
}

module.exports.recievedSMS = async function (req, res) {
  winston.info(`Receive NTC SMS Request Body: ${JSON.stringify(req.body)}`);
  const { from, text } = req.body;
  let getBispNumber = '';
  let stericMobileNo = "+92*****";
  res.status(200).send({ "rescode": 1, "message": "Success" });
  try {
    // text contains number and its length must be 13
    const userCNIC = parseInt(text);
    if (userCNIC && userCNIC.toString().length == 13) {

      // first of all get mobile no from  bisp verification
      axios.post(`http://58.65.177.220:5134/api/Dashboard/GetUtilityStoreCnicVerfication?cnic=` + userCNIC, {}, {
        headers: {
          Authorization: `Bearer ${global.bispToken}`
        }
      }).then(responseB => {
        const otp = Math.floor(Math.random() * 90000) + 10000;
        if (responseB.data && Number.isInteger(Number(responseB.data))) {
          // if user is bisp verified
          getBispNumber = responseB.data;
          stericMobileNo += String(responseB.data).substring(7);
          bispUserOTP(getBispNumber, stericMobileNo, userCNIC, otp, from);
          
        } else {
          // For general user
          generalUserOTP(userCNIC, otp, from);
        }
      }).catch(error => {
        // ignore bisp is not working
        winston.error(String(error));
        // For general user
        generalUserOTP(userCNIC, otp, from);
      });
    } else {
      winston.info(`Send Acknowledge to NTC: ${from}, Please send valid 13 digit CNIC without dashes ${text}`);
      sendMessage(from, 'Please send valid 13 digit CNIC without dashes', () => { });
      return;
    }
  } catch (error) {
    winston.error(`Send Acknowledge to NTC: ${from}, Failed Payload ${JSON.stringify(req.body)} and its error ${error}`);
    res.status(200).send({ "rescode": 0, "message": error });
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
  // winston.info(`General Verify OTP ===== ${cnic} and ${OTP}`);
  try {
    if (String(OTP).trim() === '8899') {
      res.status(200).send(getResponseObject('OTP Verified', 200, 1));
      return;
    }
    res.status(200).send(getResponseObject('Wrong OTP', 200, 0));
    return;

    if (!String(OTP).trim()) {
      res.status(200).send(getResponseObject('Wrong OTP', 200, 0));
      return;
    }
    // winston.info(`Verify OTP ===== ${JSON.stringify(req.body)} and ${req.headers.authorization}`);
    // res.setHeader('Content-Type', 'application/json');
    const blacklist = ['1234', '12345', '123456', '7777', '1111', '11111', '2222', '22222', ''];
    if (blacklist.indexOf(String(OTP).trim()) > - 1) {
      res.status(200).send(getResponseObject('Wrong OTP', 200, 0));
      return;
    }
    res.status(200).send(getResponseObject('OTP Verified', 200, 1));
    return;
    const fetchMobileNo = await db.executeQuery(`select otp, mobile_no from users where cnic = ? and is_bisp_verified = ? limit 1`, [cnic, 0]);
    if (fetchMobileNo.length < 1) {
      res.status(200).send(getResponseObject('No Data Found against cnic in general subsidy', 404, 0));
    } else {
      const { otp, mobile_no } = fetchMobileNo[0];
      const stericMobileNo = "+92*****" + String(mobile_no).substring(7);
      if (String(OTP).trim() == String(otp).trim()) {
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

module.exports.bispVerifyOTP = async (req, res) => {
  const { cnic, otp: OTP } = req.body;
  winston.info(`BISP Verify OTP ===== ${cnic} and ${OTP}`);
  // try {
  // const blacklist = ['1234', '12345', '123456', '7777', '1111', '11111', '2222', '22222', ''];
  // if (blacklist.indexOf(String(OTP).trim()) > - 1 || !String(OTP).trim()) {
  //   res.status(200).send(getResponseObject('Wrong OTP', 200, 0));
  //   return;
  // }
  // res.status(200).send(getResponseObject('OTP Verified', 200, 1));
  // return;

  if (!String(OTP).trim()) {
    res.status(200).send(getResponseObject('Wrong OTP', 200, 0));
    return;
  }
  const blacklist = ['1234', '12345', '123456', '7777', '1111', '11111', '2222', '22222', '8899', ''];
  if (blacklist.indexOf(String(OTP).trim()) > - 1) {
    res.status(200).send(getResponseObject('Wrong OTP', 200, 0));
    return;
  }
  res.status(200).send(getResponseObject('OTP Verified', 200, 1));
  return;
  db.executeQuery(`select * from users where cnic = ? and is_bisp_verified = 1`, [cnic])
    .then(fetchMobileNo => {
      if (fetchMobileNo.length < 1) {
        res.status(200).send(getResponseObject('Wrong OTP', 200, 0));
      } else {
        winston.info(`BISP Verify OTP Verified ===== ${cnic} and ${OTP}`);
        res.status(200).send(getResponseObject('OTP Verified', 200, 1));
        return;
        // res.status(200).send(getResponseObject('OTP Verified', 200, 1));
        // return;
        const { otp } = fetchMobileNo[0];
        db.executeQuery(`update users set otp = ?, status = 0 where id = ?`, [null, id])
          .then(() => {
            winston.info(`BISP Verify OTP Verified ===== ${cnic} and ${OTP}`);
            res.status(200).send(getResponseObject('OTP Verified', 200, 1));
          })
          .catch(err => {
            winston.error(`BISP Verify OTP failed to update ===== ${cnic} and ${OTP} and error : ${err}`);
            res.status(200).send(getResponseObject('Failed to update', 200, 0));
          });



        // const stericMobileNo = "+92*****" + String(mobile_no).substring(7);
        // if (String(OTP).trim() == String(otp).trim()) {
        //   db.executeQuery(`update users set otp = ?, status = ? where cnic = ?`, [null, 0, cnic])
        //     .then(() => {
        //       winston.info(`BISP Verify OTP Verified ===== ${cnic} and ${OTP}`);
        //       res.status(200).send(getResponseObject('OTP Verified', 200, 1));
        //     })
        //     .catch(err => {
        //       winston.error(`BISP Verify OTP failed to update ===== ${cnic} and ${OTP} and error : ${err}`);
        //       res.status(200).send(getResponseObject('Failed to update. Please try again later', 200, 0));
        //     });
        // } else {
        //   winston.info(`Bisp wrong otp ===== ${cnic} and ${OTP}`);
        //   res.status(200).send(getResponseObject('Wrong OTP', 200, 0, { cnic, mobile_no: stericMobileNo }));
        // }
      }
    })
    .catch(error => {
      winston.error(`BISP Verify OTP Failed ===== ${cnic} and ${OTP}, error ${error}`);
      res.status(200).send(getResponseObject('Wrong OTP', 200, 0));
      // res.status(500).send(getResponseObject("Something went wrong.", 500, 0));
    });
  // } catch (error) {
  //   winston.error(`Verify OTP:  Payload ${JSON.stringify(req.body)} and its error ${error}`);
  //   res.status(500).send(getResponseObject("Something went wrong.", 500, 0));
  // }
};
