// NPM dependencies
const { createLogger, format, transports } = require("winston");
const path = require("path");
const fs = require("fs");
require("winston-daily-rotate-file");

const logDirectory = "./logs";

// Create log directory if it does not exist.
if (!fs.existsSync(logDirectory)) {
  fs.mkdirSync(logDirectory);
}

const logFile = path.join(logDirectory, "api-logs");
// Defining custom logging format
const customFormat = format.printf(
  ({ level, message, timestamp }) => `${timestamp} ${level}: ${message}`
);

// Creating logger object
const logger = createLogger({
  format: format.combine(
    format.colorize(),
    format.label(),
    format.timestamp({
      format: "YYYY-MM-DD HH:mm:ss",
    }),
    customFormat
  ),
  transports: [
    new transports.Console(),
    new transports.DailyRotateFile({
      filename: `${logFile}-%DATE%.log`,
      datePattern: "YYYY-MM-DD",
    }),
  ],
  level: "debug",
});

module.exports = logger;