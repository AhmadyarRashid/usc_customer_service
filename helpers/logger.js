const { createLogger, format, transports } = require('winston');
const fs = require('fs');
const path = require('path');
const util = require('util');

const env = process.env.NODE_ENV || 'development';
const logDir = 'log';

// Create the log directory if it does not exist
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir);
}

const filename = path.join(logDir, 'app.log');

const winstonLogger = function (fileName) {
    return createLogger({
        // change level if in dev environment versus production
        level: env === 'production' ? 'info' : 'debug',
        format: format.combine(
            format.label({ label: fileName }),
            format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
            format.json()
        ),
        transports: [
            new transports.Console({
                format: format.combine(
                    format.colorize(),
                    format.printf(
                        info =>
                            `${info.timestamp} ${info.level} [${info.label}]: ${info.message}`
                    )
                )
            }),
            new transports.File({
                filename
            })
        ]
    });
}

const logger = function (fileName) {
    function debug(message) {
        winstonLogger(fileName).debug(message)
    }

    function error(error) {
        if (error.stack) {
            winstonLogger(fileName).error(error.stack)
        }
        else {
            winstonLogger(fileName).error(error);
        }
    }

    function info(message) {
        winstonLogger(fileName).info(message);
    }
    return {
        debug: debug,
        info: info,
        error: error
    }
}

module.exports = logger;