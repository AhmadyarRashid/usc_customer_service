module.exports = responseHandler;

function responseHandler(req, res, next) {
    let responseObj = { success: false, code: 200, message: "", payload: null }

    res.sendSuccessResponse = (payload) => {
        responseObj.success = true;
        responseObj.payload = payload;
        res.status(200).json(responseObj);
    }

    res.sendNotFoundResponse = () => {
        responseObj.code = 404;
        responseObj.message = "No record found";
        res.status(200).json(responseObj);
    }

    res.sendFailureResponse = (code, message) => {
        responseObj.success = false;
        responseObj.code = code ? code : 400;
        responseObj.message = message ? message : "Validation failed";
        res.status(200).json(responseObj);
    }

    res.sendErrorResponse = (message) => {
        responseObj.success = false;
        responseObj.code = 500;
        responseObj.message = message ? message : "Internal server error";
        res.status(200).json(responseObj);
    }

    res.sendUnauthorizedErrorResponse = () => {
        responseObj.success = false;
        responseObj.code = code ? code : 401;
        responseObj.message = message ? message : "Unauthorized: Invalid Token";
        res.status(200).json({ responseObj });
    }
    next();
}