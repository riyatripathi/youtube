const express = require("express");
const router = express.Router();
const passport = require("passport");

// Post request for login
router.post(
  "/",
  passport.authenticate("local", {
    successRedirect: "/admin",
    failureRedirect: "/login",
    failureFlash: true,
  })
);

router.get("/", (req, res) => {
  res.render("login"); // assuming you have a login view template
});

module.exports = router;
