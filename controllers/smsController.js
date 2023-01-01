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
  // winston.info('ready to hit Send Message API');
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
        winston.error(`Send Message Session Expired : ${JSON.stringify(parseResponse)}`);
        callback(null, true);
        // loginNTC12(() => {
        //   sendMessage(to, message);
        //   // callback(null, true);
        // })
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
  let getBispNumber = '';
  let stericMobileNo = "+92*****";
  res.status(200).send({ "rescode": 1, "message": "Success" });
  try {
    // text contains number and its length must be 13
    const userCNIC = parseInt(text);
    if (userCNIC && userCNIC.toString().length == 13) {

      // first of all get mobile no from  bisp verification
      try {
        const responseB = await axios.post(`http://58.65.177.220:5134/api/Dashboard/GetUtilityStoreCnicVerfication?cnic=` + userCNIC, {}, {
          headers: {
            Authorization: `Bearer ${global.bispToken}`
          }
        });
        getBispNumber = responseB.data;
        stericMobileNo += String(responseB.data).substring(7);
      } catch(error) {
        // ignore bisp is not working
        winston.error(String(error));
      }

      // check if cnic exists and its verified or not
      const checkBispEntryExists = await db.executeQuery(`select * from users where cnic = ? and mobile_no = ?;`, [String(userCNIC), String(getBispNumber)]);
      if(checkBispEntryExists.length > 0) {
        const BOTP = Math.floor(Math.random() * 100000);
        await db.executeQuery(`update users set otp = ?, status = ?, is_bisp_verified = ?, mobile_no = ? where cnic = ?`, [BOTP, true, true, String(getBispNumber), String(userCNIC)]);
           if(getBispNumber == from) {
              // res.send('Your Bisp OTP is 1122');
              sendMessage(from, `یوٹیلیٹی اسٹور پر خریداری کے لیے آپ کا (بی آئی ایس پی) کوڈ ہے ${BOTP}`, () => {});
           } else {
            //  res.send('Your Bisp OTP number sent to your register number');
            sendMessage(getBispNumber, `یوٹیلیٹی اسٹور پر خریداری کے لیے آپ کا (بی آئی ایس پی) کوڈ ہے ${BOTP}`, () => {});
            sendMessage(from, `آپ کا (بی آئی ایس پی) کوڈ آپ کے رجسٹرڈ موبائل نمبر پر بھیجا گیا ہے۔ ${stericMobileNo}`, () => {});
           }
        return;
      }

      const isCnicExists = await db.executeQuery(`select * from users where cnic = ?`, [String(userCNIC)]);
      if (isCnicExists.length == 0) { // is cnic not exists
        const isMobileNoExists = await db.executeQuery(`select * from users where mobile_no = ?`, [from]);
        if (isMobileNoExists.length > 0) {
          winston.info(`Send Acknowledge to NTC: ${from},  Mobile No already registered with other CNIC`);
          // res.status(200).send({ "rescode": 1, "message": "Success" });
          sendMessage(from, 'This Mobile No already registered with other CNIC. Please use different mobile no', () => {});
        } else {
          const OTP = Math.floor(Math.random() * 100000);

          try{
            // bisp verification
          //  const response = await axios.post(`http://58.65.177.220:5134/api/Dashboard/GetUtilityStoreCnicVerfication?cnic=` + userCNIC, {}, {
          //    headers: {
          //      Authorization: `Bearer ${global.bispToken}`
          //    }
          //  });
           const bispVerificationResponse = getBispNumber;
           console.log('bisp verification ===', userCNIC, getBispNumber);
           if (bispVerificationResponse && Number.isInteger(Number(bispVerificationResponse))) {
             await db.executeQuery(`insert into users (cnic, mobile_no, otp, created_date, status, is_bisp_verified) values (?,?,?,?,?,?)`,
             [String(userCNIC), String(bispVerificationResponse), OTP, new Date(), true, true]);
             if(bispVerificationResponse == from) {
                sendMessage(from, `یوٹیلیٹی اسٹور پر خریداری کے لیے آپ کا (بی آئی ایس پی) کوڈ ہے ${OTP}`, () => {});
             } else {
              sendMessage(bispVerificationResponse, `یوٹیلیٹی اسٹور پر خریداری کے لیے آپ کا (بی آئی ایس پی) کوڈ ہے ${OTP}`, () => {});
              sendMessage(from, `آپ کا (بی آئی ایس پی) کوڈ آپ کے رجسٹرڈ موبائل نمبر پر بھیجا گیا ہے۔ ${stericMobileNo}`, () => {});
             }
           } else {
             db.executeQuery(`insert into users (cnic, mobile_no, otp, created_date, status, is_bisp_verified) values (?,?,?,?,?,?)`,
              [String(userCNIC), String(from), OTP, new Date(), true, false])
             .then(() => {
                sendMessage(from, `یوٹیلیٹی اسٹور پر خریداری کے لیے آپ کا کوڈ ہے۔ ${OTP}`, () => {});
             })
             .catch(err => {
                winston.error('Error in update general subsidy line 184 == ', err);
             });
           }  
         }catch(error) {
           console.log('bisp error ==', error);
         }

          
          // winston.info(`Send Acknowledge to NTC: ${from}, CNIC Doesn't exist in DB. Your OTP ${OTP}`);
          // res.status(200).send({ "rescode": 1, "message": "Success" });
          
        }
      } else if (isCnicExists.length > 0 && isCnicExists[0]['mobile_no'] !== from) {  // If CNIC exists but mobile no diff
        winston.info(`Send Acknowledge to NTC: ${from}, Your CNIC registered with different mobile no`);
        // res.status(200).send({ "rescode": 1, "message": "Success" });
        sendMessage(from, 'Your CNIC registered with different mobile no', () => {});
      } else {  // rest of scenarios handle here
        const OTP = Math.floor(Math.random() * 100000);
        // await db.executeQuery(`update users set otp = ?, status = ? where cnic = ?`, [OTP, true, String(userCNIC)]);
        // winston.info(`Send Acknowledge to NTC: ${from}, Your OTP ${OTP}`);


        try{
          // bisp verification
        //  const response = await axios.post(`http://58.65.177.220:5134/api/Dashboard/GetUtilityStoreCnicVerfication?cnic=` + userCNIC, {}, {
        //    headers: {
        //      Authorization: `Bearer ${global.bispToken}`
        //    }
        //  });
         const bispVerificationResponse = getBispNumber;
         if (bispVerificationResponse && Number.isInteger(Number(bispVerificationResponse))) {
           await db.executeQuery(`update users set otp = ?, status = ?, is_bisp_verified = ?, mobile_no = ? where cnic = ?`, [OTP, true, true, String(bispVerificationResponse), String(userCNIC)]);
           if(bispVerificationResponse == from) {
              // res.send('Your Bisp OTP is 1122');
              sendMessage(from, `یوٹیلیٹی اسٹور پر خریداری کے لیے آپ کا (بی آئی ایس پی) کوڈ ہے ${OTP}`, () => {});
           } else {
            //  res.send('Your Bisp OTP number sent to your register number');
            sendMessage(bispVerificationResponse, `یوٹیلیٹی اسٹور پر خریداری کے لیے آپ کا (بی آئی ایس پی) کوڈ ہے ${OTP}`, () => {});
            sendMessage(from, `آپ کا (بی آئی ایس پی) کوڈ آپ کے رجسٹرڈ موبائل نمبر پر بھیجا گیا ہے۔ ${stericMobileNo}`, () => {});
           }
         } else {
            db.executeQuery(`update users set otp = ?, status = ?, is_bisp_verified = ? where cnic = ?`, [OTP, true, false, String(userCNIC)])
              .then(() => {
                sendMessage(from, `یوٹیلیٹی اسٹور پر خریداری کے لیے آپ کا کوڈ ہے۔ ${OTP}`, () => {});
              })
              .catch(err => {
                winston.error('error on update general subsidy line no 230 ==', err);
              });
         }  
       }catch(error) {
         winston.error('bisp error ==', error);
       }


      }
    } else {
      winston.info(`Send Acknowledge to NTC: ${from}, Please send valid 13 digit CNIC without dashes ${text}`);
      sendMessage(from, 'Please send valid 13 digit CNIC without dashes', () => {});
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
  try {
    // winston.info(`Verify OTP ===== ${JSON.stringify(req.body)} and ${req.headers.authorization}`);
    // res.setHeader('Content-Type', 'application/json');
    // res.status(200).send(getResponseObject('OTP Verified', 200, 1));
    // return;
    const fetchMobileNo = await db.executeQuery(`select otp, mobile_no from users where cnic = ? and is_bisp_verified = ? limit 1`, [cnic, 0]);
    if (fetchMobileNo.length < 1) {
      res.status(200).send(getResponseObject('No Data Found against cnic in general subsidy', 404, 0));
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

module.exports.bispVerifyOTP = async (req, res) => {
  const { cnic, otp: OTP } = req.body;
  try {
    const fetchMobileNo = await db.executeQuery(`select otp, mobile_no from users where cnic = ? and is_bisp_verified = ? limit 1`, [cnic, 1]);
    if (fetchMobileNo.length < 1) {
      res.status(200).send(getResponseObject('No Data Found against CNIC in Bisp', 404, 0));
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
