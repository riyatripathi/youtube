const express = require("express");
const router = express.Router();
const logger = require("../logger");

router.get("/", (req, res) => {
	logger.info("Request for LOGOUT")
	logger.info(`USER AUTHENTICATED ?: ${req.isAuthenticated()}`);
  if (req.isAuthenticated()) {
    req.logout(function(err){
	if(err) {
		logger.error("Error in LOGOUT.");
		throw err;
	}else{
		res.redirect("/admin")
	}
    });
  } else {
    res.redirect("/login");
  }
});

router.get("/logout", (req, res) => {i
	logger.info("REQUEST FOR LOGOUT")
  if (req.isAuthenticated()) {
    req.logout(() => {
      logger.info(`Admin Logout: ${req.user.username}`);
      req.session.destroy((err)=>{
        if(err){
            logger.error('Error destroying session',err);
        }
      })
      res.redirect("/login");
    });
  } else {
    res.redirect("/login");
  }
});

module.exports = router;
