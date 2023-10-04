const winston = require("winston");
const { createLogger, transports, format } = winston;
require("dotenv").config();
const DailyRotateFile = require("winston-daily-rotate-file");
const path = require("path");

// Define the log directory and filename pattern
const logDirectory = path.join(__dirname, "logs");
const logFilename = "application-%DATE%.log";

// Create the transport for daily rotating log files
const transport = new DailyRotateFile({
  filename: path.join(logDirectory, logFilename),
  datePattern: "YYYY-MM-DD",
  zippedArchive: true,
  maxSize: "20m", // Maximum log file size before rotation
  maxFiles: "7d", // Retain logs for 7 days
});

// Create the Winston logger
const logger = createLogger({
  level: process.env.LOGLEVEL || "debug",
  format: format.combine(
    format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    format.printf(({ timestamp, level, message }) => {
      return `[${timestamp}] [${level.toUpperCase()}]: ${message}`;
    })
  ),
  transports: [
    new transports.Console(), // Log to console
    transport, // Log to rotating files
  ],
});

module.exports = logger;
