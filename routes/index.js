const express = require('express');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('database.db');

// Route to display products on the website
router.get('/', (req, res) => {
  db.all('SELECT * FROM products', (err, data) => {
    if (err) {
      console.error(err.message);
      res.status(500).send('Internal Server Error');
      return;
    }
    res.render('index', { products: data });
  });
});

module.exports = router;
