const express = require("express");
const router = express.Router();
const sqlite3 = require("sqlite3").verbose();
const logger = require("../logger");
const db = new sqlite3.Database("database.db");

// Route to display products on the website
router.get("/", (req, res) => {
  logger.debug("Request for Index Page");
  res.render("index");
});

module.exports = router;
