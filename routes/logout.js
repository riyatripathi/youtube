const express = require("express");
const router = express.Router();
const logger = require("../logger");

router.get("/", (req, res) => {
  if (req.isAuthenticated()) {
    req.logout(() => {
      logger.info(`Admin Logout: ${req.user.username}`);
      res.redirect("/login");
    });
  } else {
    res.redirect("/login");
  }
});

module.exports = router;
