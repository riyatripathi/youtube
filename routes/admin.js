const express = require("express");
const router = express.Router();
const sqlite3 = require("sqlite3").verbose();
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const bcrypt = require("bcryptjs");

const db = new sqlite3.Database("database.db");

// Configure passport local strategy
passport.use(
  new LocalStrategy((username, password, done) => {
    db.get(
      "SELECT id, username, password FROM admin_users WHERE username = ?",
      [username],
      (err, user) => {
        if (err) return done(err);

        if (!user) {
          return done(null, false, { message: "Incorrect username." });
        }

        bcrypt.compare(password, user.password, (err, isMatch) => {
          if (err) return done(err);

          if (isMatch) {
            return done(null, user);
          } else {
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
  console.log("req.isAuthenticated()", req.isAuthenticated());
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect("/login");
}

// Route for the admin panel
router.get("/", ensureAuthenticated, (req, res) => {
  res.render("admin");
});

module.exports = router;
