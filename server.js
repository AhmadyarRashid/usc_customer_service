const bodyParser = require("body-parser");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const errorHandler = require("./helpers/error-handler");
const responseHandler = require("./middlewares/response");
const logger = require('./helpers/logger')('server.js');
const {
    createAdminLoginIfNotExist
} = require("./helpers/admin")
const readXlsxFile = require('read-excel-file/node')

// config, helpers & middleware
const config = require("./config/config");

// db reference
const db = require("./helpers/db");

const app = express();
app.use(cors());
app.use(helmet());
app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(bodyParser.json());

app.use(responseHandler);

// create default admin login if not exists
createAdminLoginIfNotExist()

app.get('/', (req, res) => {
    console.log('get req body', req.body);
    res.status(200).send('OK');
});

app.post('/', (req, res) => {
    console.log('post req body', req.body);
    res.status(200).send('OK');
});

/* registering routes */
app.use("/api", require("./routes/index"));

/* global error handeler*/
app.use(errorHandler);

/* creating server */
app.listen(config.server_port, () => {
    //logger.info(`Server listening on port ${config.server_port}`);
    console.log(`Server listening on port ${config.server_port}`);
});