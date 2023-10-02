const express = require("express");
const router = express.Router();
const passport = require("passport");
const logger = require("../logger"); // Import your logger module here

// Post request for login
router.post("/", (req, res, next) => {
  passport.authenticate("local", (err, user, info) => {
    if (err) {
      logger.error("Passport authentication error:", err);
      return next(err);
    }

    if (!user) {
      logger.warn("User authentication failed:", info);
      return res.redirect("/login");
    }

    req.logIn(user, (err) => {
      if (err) {
        logger.error("Error during login:", err);
        return next(err);
      }
      logger.info("User authenticated successfully:", user.username);
      return res.redirect("/admin");
    });
  })(req, res, next);
});

router.get("/", (req, res) => {
  logger.info("Rendering login page");
  res.render("login"); // Assuming you have a login view template
});

module.exports = router;
