const express = require("express");
const router = express.Router();
const sqlite3 = require("sqlite3").verbose();
const db = require("./../database/db");
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const bcrypt = require("bcryptjs");
const logger = require("../logger");
const redis = require("redis");
const client = redis.createClient();
client.on("error", (err) => {
  logger.error("Redis Error:", err);
});

client.connect().then((res) => {
  logger.info("Connected to Redis");
});

// Configure passport local strategy
passport.use(
  new LocalStrategy((username, password, done) => {
    db.get(
      "SELECT id, username, password FROM admin_users WHERE username = ?",
      [username],
      (err, user) => {
        if (err) {
          logger.error(`Error during authentication: ${err}`);
          return done(err);
        }

        if (!user) {
          logger.warn(`Incorrect username ${username}`);
          return done(null, false, { message: "Incorrect username." });
        }

        bcrypt.compare(password, user.password, (err, isMatch) => {
          if (err) {
            logger.error(`Error during password comparison: ${err}`);
            return done(err);
          }

          if (isMatch) {
            logger.info(`User authenticated successfully: ${user.username}`);
            return done(null, user);
          } else {
            logger.warn(`Incorrect password for user: ${user.username}`);
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
  logger.info(`Rendering admin panel for user: ${req.user.username}`);
  res.render("admin");
});

router.get("/pin-product/:id", ensureAuthenticated, async (req, res) => {
  logger.debug("Request for pinning product");
  // if pin update the pin in database also upload the product in cache for 1 day
  const productId = req.params.id;
  const query = "UPDATE products SET pin = 1 WHERE product_id = ?";
  const values = [productId];
  db.run(query, values, (err) => {
    if (err) {
      logger.error("Error updating product:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }
    logger.info("Product pinned successfully in database");
  });
  try {
    product = await getProductById(productId);
    // set the json in cache for 1 day, if already exists, get the data, update the cache data and again set the data if not then set the data
    const cacheKey = `pin_products`;
    let products = await client.get(cacheKey);
    if (products) {
      // pin_products exits in cache, get the data
      products = JSON.parse(products);
      // now update the new value in products i.e., product variable
      products.push(product);
      client.set(cacheKey, JSON.stringify(products), {
        EX: 86400, // cache for 1 day
      });
    } else {
      // pin_products not exits in cache
      client.set(cacheKey, JSON.stringify([product]), {
        EX: 86400, // cache for 1 day
      });
    }
    logger.debug("Product pinned successfully in Cache");
    res
      .status(200)
      .json({ message: "Product pinned successfully in Database and Cache" });
  } catch (err) {
    logger.error("Error updating product:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/unpin-product/:id", ensureAuthenticated, async (req, res) => {
  logger.debug("Request for unpinning product");
  // if pin update the pin in database also upload the product in cache for 1 day
  const productId = req.params.id;
  const query = "UPDATE products SET pin = 0 WHERE product_id = ?";
  const values = [productId];
  db.run(query, values, (err) => {
    if (err) {
      logger.error("Error updating product:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }
    logger.info("Product unpinned successfully in database");
  });
  try {
    product = await getProductById(productId);
    // set the json in cache for 1 day, if already exists, get the data, update the cache data and again set the data if not then set the data
    const cacheKey = `pin_products`;
    let products = await client.get(cacheKey);
    if (products) {
      // pin_products exits in cache, get the data
      products = JSON.parse(products);
      // remove the product from products whose product id is equal to product id
      products = products.filter((product) => {
        return product.product_id != productId;
      });
      client.set(cacheKey, JSON.stringify(products), {
        EX: 86400, // cache for 1 day
      });
    } else {
      // pin_products not exits in cache
      client.set(cacheKey, JSON.stringify([]), {
        EX: 86400, // cache for 1 day
      });
    }
    logger.debug("Product unpinned successfully in Database and Cache");
    res
      .status(200)
      .json({ message: "Product unpinned successfully in Database and Cache" });
  } catch (err) {
    logger.error("Error updating product:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

function getProductById(productId) {
  logger.debug(`Fetching Product from ID: ${productId}`);
  const query = "SELECT * FROM products WHERE product_id = ?";
  return new Promise((resolve, reject) => {
    db.get(query, [productId], (err, row) => {
      if (err) {
        logger.error("Error fetching product:", err);
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
}

module.exports = router;
