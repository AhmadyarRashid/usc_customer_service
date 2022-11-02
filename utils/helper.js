const https = require('https');
const axios = require("axios");
const constants = require("../config/constants");
const winston = require("../config/winston");

module.exports.getNtcToken = function () {
    console.log('get Token request =====', global.ntcToken);
    const instance = axios.create({
        httpsAgent: new https.Agent({
            rejectUnauthorized: false
        })
    });
    instance
        .post(`${constants.ntcBaseUrl}`, {
            process: constants.process,
            userid: constants.ntcUserId,
            pass: constants.ntcPass
        })
        .then(response => {
            console.log('repsonse login request ==', response);
            const apiResponse = response.data;
            winston.info(`response rescode : ${apiResponse.rescode}`);
            winston.info(`response data : ${apiResponse.data}`);
            if (apiResponse.rescode === 1) {
                global.ntcToken = apiResponse.data || '';
            }
        })
        .catch(error => {
            console.log('error in request', error);
            winston.error(`login api error: ${error}`);
        });
};