const sqlite3 = require("sqlite3").verbose();
const logger = require("../logger");

const db = new sqlite3.Database("database.db", (err) => {
  if (err) {
    logger.error("Error connecting to database:", err);
    throw err;
  }
  logger.info("Connected to database");
});

module.exports = db;
