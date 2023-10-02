const express = require("express");
const router = express.Router();
const sqlite3 = require("sqlite3").verbose();

const db = new sqlite3.Database("database.db");

// Route to display products on the website
router.get("/", (req, res) => {
  res.render("index");
});

// router.get("/products", (req, res) => {
//   const limit = 10; // Or whatever number of items you want per page
//   const offset = req.query.page ? req.query.page * limit : 0;

//   db.all(
//     "SELECT * FROM products LIMIT ? OFFSET ?",
//     [limit, offset],
//     (err, data) => {
//       if (err) {
//         console.error(err.message);
//         res.status(500).send("Internal Server Error");
//         return;
//       }
//       res.json(data);
//     }
//   );
// });

module.exports = router;
