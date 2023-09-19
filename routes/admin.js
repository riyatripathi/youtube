const express = require("express");
const router = express.Router();
const sqlite3 = require("sqlite3").verbose();

const db = new sqlite3.Database("database.db");

// Route for the admin panel
router.get("/", (req, res) => {
  res.render("admin");
});


module.exports = router;
