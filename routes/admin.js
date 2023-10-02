const express = require("express");
const router = express.Router();
const sqlite3 = require("sqlite3").verbose();
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const bcrypt = require("bcryptjs");
const logger = require("../logger");

const db = new sqlite3.Database("database.db");

// Configure passport local strategy
passport.use(
  new LocalStrategy((username, password, done) => {
    db.get(
      "SELECT id, username, password FROM admin_users WHERE username = ?",
      [username],
      (err, user) => {
        if (err) {
          logger.error("Error during authentication:", err);
          return done(err);
        }

        if (!user) {
          logger.warn("Incorrect username:", username);
          return done(null, false, { message: "Incorrect username." });
        }

        bcrypt.compare(password, user.password, (err, isMatch) => {
          if (err) {
            logger.error("Error during password comparison:", err);
            return done(err);
          }

          if (isMatch) {
            logger.info("User authenticated successfully:", user.username);
            return done(null, user);
          } else {
            logger.warn("Incorrect password for user:", user.username);
            return done(null, false, { message: "Incorrect password." });
          }
        });
      }
    );
  })
);

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  db.get(
    "SELECT id, username FROM admin_users WHERE id = ?",
    [id],
    (err, user) => {
      done(err, user);
    }
  );
});

// Middleware to ensure the user is authenticated
function ensureAuthenticated(req, res, next) {
  logger.debug("Checking authentication status");
  if (req.isAuthenticated()) {
    return next();
  }
  logger.warn("User is not authenticated, redirecting to /login");
  res.redirect("/login");
}

// Route for the admin panel
router.get("/", ensureAuthenticated, (req, res) => {
  logger.info("Rendering admin panel for user:", req.user.username);
  res.render("admin");
});

module.exports = router;
