const express = require("express");
const router = express.Router();
const multer = require("multer");
const db = require("./../database/db");
const upload = require("../config/multer");

function extractFileIdFromDriveLink(driveLink) {
  const match = /\/d\/([a-zA-Z0-9_-]+)/.exec(driveLink);
  if (match && match[1]) {
    return match[1];
  }
  return null;
}

// Define a GET route to fetch products list
router.get("/products", (req, res) => {
  const query = "SELECT * FROM products";
  db.all(query, [], (err, rows) => {
    if (err) {
      console.error("Error fetching products:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }
    res.json(rows);
  });
});

router.post("/add-product", upload.single("productImage"), (req, res) => {
  let { productName, productDescription, productLink, youtubeLink } = req.body;

  const image_url = extractFileIdFromDriveLink(productLink);
  if (image_url != null) productLink = image_url;
  console.log(image_url);
  const query =
    "INSERT INTO products ( product_name, product_description, product_link, youtube_link) VALUES (?, ?, ?, ?)";
  const values = [productName, productDescription, productLink, youtubeLink];

  db.run(query, values, (err) => {
    if (err) {
      console.error("Error adding product to the database:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }
    res.json({
      message: "Product added successfully",
      data: values,
    });
  });
});

router.delete("/products/delete/:productId", (req, res) => {
  let productId = req.params.productId;
  if (productId && productId.length > 0) {
    productId = productId.substring(1);
  }
  db.run("DELETE FROM products WHERE product_id = ?", [productId], (err) => {
    if (err) {
      console.error("Error deleting product:", err);
      res.status(500).json({ error: "Internal server error" });
    } else {
      res.json({ message: "Product deleted successfully" });
    }
  });
});

// edit changes route having product id specified
router.post("/find-product/:productId", (req, res) => {
  let productId = req.params.productId;
  productId = productId.substring(1);
  const query = "SELECT * FROM products WHERE product_id = ?";

  db.get(query, [productId], (err, product) => {
    if (err) {
      console.error("Error fetching product:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }
    res.json(product);
  });
});

router.post("/update-product/:productId", (req, res) => {
  let productId = req.params.productId;
  productId = productId.substring(1);
  let {
    editProductName,
    editProductDescription,
    editProductLink,
    editYoutubeLink,
  } = req.body;
  const image_url = extractFileIdFromDriveLink(editProductLink);
  if (image_url != null) editProductLink = image_url;
  console.log(image_url);
  const query =
    "UPDATE products SET product_name = ?, product_description = ?, product_link = ?, youtube_link = ? WHERE product_id = ?";
  const values = [
    editProductName,
    editProductDescription,
    editProductLink,
    editYoutubeLink,
    productId,
  ];
  db.run(query, values, (err) => {
    if (err) {
      console.error("Error updating product:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }
    console.log("updated successfully");
    res.redirect("/admin");
  });
});

// Server-side route for searching products
router.post("/search-products", (req, res) => {
  const searchQuery = req.body.searchQuery;

  // Use the searchQuery to search for products in your database
  const query = `
      SELECT * FROM products 
      WHERE product_id = ? OR product_name = ?`;

  db.all(query, [searchQuery, searchQuery], (err, results) => {
    if (err) {
      console.error("Error searching for products:", err);
      res.status(500).json({ error: "Internal Server Error" });
    } else {
      res.json(results);
    }
  });
});

router.post("/server-side-products", async (req, res) => {
  try {
    const draw = req.body.draw || 0;
    const start = req.body.start || 0;
    const length = req.body.length || 0;
    const searchValue = req.body.search ? req.body.search.value || "" : "";

    // Calculate the total records in the database (without filtering)
    const totalRecords = await getTotalRecords();

    // Calculate the total records after filtering
    const filteredRecords = await getFilteredRecords(searchValue);

    // Fetch data from the database
    const products = await getProducts(searchValue, start, length);

    // Send the response to DataTables
    const response = {
      draw: draw,
      recordsTotal: totalRecords,
      recordsFiltered: filteredRecords,
      data: products,
    };

    res.json(response);
  } catch (error) {
    console.error("Error processing server-side request:", error);
    res.status(500).json({ error: "Server error" });
  }
});

const productsPerPage = 10;
router.get("/load-more-products", (req, res) => {
  const page = req.query.page || 1;
  console.log(page);
  const offset = (page - 1) * productsPerPage;
  console.log(offset);

  // Query the database for the next set of products
  db.all(
    "SELECT * FROM products LIMIT ? OFFSET ?",
    [productsPerPage, offset],
    (err, data) => {
      if (err) {
        console.error(err.message);
        res.status(500).send("Internal Server Error");
        return;
      }

      // Return the list of products as JSON
      res.json(data);
    }
  );
});

// Function to get the total number of records in the database
function getTotalRecords() {
  return new Promise((resolve, reject) => {
    db.get("SELECT COUNT(*) as count FROM products", (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row.count);
      }
    });
  });
}

// Function to get the total number of filtered records
function getFilteredRecords(searchValue) {
  return new Promise((resolve, reject) => {
    const searchQuery = `%${searchValue}%`;
    const query = `
      SELECT COUNT(*) as count
      FROM products
      WHERE product_name LIKE ? OR product_description LIKE ?
    `;

    db.get(query, [searchQuery, searchQuery], (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row.count);
      }
    });
  });
}

// Function to get product data based on DataTables request
function getProducts(searchValue, start, length) {
  return new Promise((resolve, reject) => {
    const searchQuery = `%${searchValue}%`;
    const query = `
      SELECT *
      FROM products
      WHERE product_name LIKE ? OR product_description LIKE ?
      LIMIT ?, ?
    `;

    db.all(query, [searchQuery, searchQuery, start, length], (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}
module.exports = router;
