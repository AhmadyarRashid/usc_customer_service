const getSuccessResponse = (payload, res) => {
  let responseObj = { isSuccess: true, payload }
  if (res) {
    return res.status(200).json(responseObj);
  }
  else {
    return responseObj;
  }
};


const getFailureResponse = (message, res) => {
  if (!message) {
    message = "Something went wrong.";
  }
  let responseObj = { isSuccess: false, message };
  if (res) {
    return res.status(200).json(responseObj);
  }
  else {
    return responseObj;
  }
};

/**
  * This method creates a response object with given params.
  */
const getResponseObject = (msg, responseCode, success = 1, data = {}) => ({
  success: success,
  response: responseCode,
  message: msg,
  payload: data,
});

module.exports = { getSuccessResponse, getFailureResponse, getResponseObject };
