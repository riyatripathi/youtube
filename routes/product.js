const express = require("express");
const router = express.Router();
// const multer = require("multer");
const db = require("./../database/db");
const upload = require("../config/multer");
const logger = require("../logger");
const redis = require("redis");
const client = redis.createClient();
client.on("error", (err) => {
  logger.error("Redis Error:", err);
});

client.connect().then((res) => {
  logger.info("Connected to Redis");
});

const FETCH_LIMIT = 4;

function extractFileIdFromDriveLink(driveLink) {
  const match = /\/d\/([a-zA-Z0-9_-]+)/.exec(driveLink);
  logger.info(
    `Extracting Drive Link -> ID, RegEx Match Found for drive Link: ${driveLink}`
  );
  if (match && match[1]) {
    logger.info("Extracting Drive Link -> ID: ", match[1]);
    return match[1];
  }
  return null;
}

// Define a GET route to fetch products list
// router.get("/products", async (req, res) => {
//   logger.debug("Request for fetching products");
//   const limit = 2;
//   const page = parseInt(req.query.page, 10) || 0;
//   const offset = page * limit;
//   const totalRecords = await getTotalRecords();
//   if (offset > totalRecords) {
//     return res.status(404).json({ status: 404, error: "No products found" });
//   }
//   logger.debug(`Fetching products (Page: ${page}, Limit: ${limit})`);
//   const query = `SELECT * FROM products LIMIT ? OFFSET ?`;
//   db.all(query, [limit, offset], (err, rows) => {
//     if (err) {
//       logger.error("Error fetching products:", err);
//       return res
//         .status(500)
//         .json({ status: 500, error: "Internal Server Error" });
//     }
//     res.json(rows);
//   });
// });

router.get("/products", async (req, res) => {
  logger.debug("Request for fetching all products from cache");
  const limit = FETCH_LIMIT;
  const page = parseInt(req.query.page, 10) || 0;
  const offset = page * limit;
  const totalRecords = await getTotalRecords();
  if (offset > totalRecords) {
    return res.status(404).json({ status: 404, error: "No products found" });
  }
  logger.debug(`Fetching all products (Page: ${page}, Limit: ${limit})`);
  const products = await getCachedProducts(offset, limit);
  res.json(products);
});

async function getCachedProducts(start, length) {
  const cacheKey = `products_${start}_${length}`;
  return new Promise(async (resolve, reject) => {
    const products = await client.get(cacheKey);
    if (products) {
      logger.debug("Fetched Products from Cache");
      resolve(JSON.parse(products));
    } else {
      const products = await getAllProducts(start, length);
      if (products.length != FETCH_LIMIT) {
        resolve(products);
      } else {
        client.set(cacheKey, JSON.stringify(products), {
          EX: 3600,
        }); // cache for 1 hour
        resolve(products);
      }
    }
  });
}

function getAllProducts(start, length) {
  query = `SELECT * FROM products LIMIT ? OFFSET ?`;
  console.log(query);
  return new Promise((resolve, reject) => {
    db.all(query, [length, start], (err, rows) => {
      if (err) {
        logger.error("Error fetching products:", err);
        reject(err);
      }
      console.log(rows);
      resolve(rows);
    });
  });
}

router.post("/add-product", upload.single("productImage"), (req, res) => {
  logger.debug("Request for adding product");
  let {
    productName,
    productDescription,
    productLink,
    affiliateLink,
    youtubeLink,
  } = req.body;

  const image_url = extractFileIdFromDriveLink(productLink);
  if (image_url != null) productLink = image_url;
  const query =
    "INSERT INTO products ( product_name, product_description, product_link, affiliate_link, youtube_link) VALUES (?, ?, ?, ?, ?)";
  const values = [
    productName,
    productDescription,
    productLink,
    affiliateLink,
    youtubeLink,
  ];

  db.run(query, values, function (err) {
    if (err) {
      logger.error("Error adding product to the database:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }
    values.unshift(this.lastID);
    logger.info("Product added successfully:", values);
    res.json({
      message: "Product added successfully",
      data: values,
    });
  });
});

router.delete("/products/delete/:productId", (req, res) => {
  logger.debug("Request for deleting product");
  let productId = req.params.productId;
  if (productId && productId.length > 0) {
    productId = productId.substring(1);
  }
  db.run("DELETE FROM products WHERE product_id = ?", [productId], (err) => {
    if (err) {
      logger.error("Error deleting product:", err);
      res.status(500).json({ error: "Internal server error" });
    } else {
      logger.info("Product deleted successfully");
      res.json({ message: "Product deleted successfully" });
    }
  });
});

// edit changes route having product id specified
router.post("/find-product/:productId", (req, res) => {
  logger.debug("Request for fetching product /find-product/:productId");
  let productId = req.params.productId;
  productId = productId.substring(1);
  const query = "SELECT * FROM products WHERE product_id = ?";

  db.get(query, [productId], (err, product) => {
    if (err) {
      logger.error("Error fetching product:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }
    res.json(product);
  });
});

router.post("/update-product/:productId", (req, res) => {
  logger.debug("Request for updating product, update-product/:productId");
  let productId = req.params.productId;
  productId = productId.substring(1);
  let {
    editProductName,
    editProductDescription,
    editProductLink, // drive image id or link
    editAffiliateLink,
    editYoutubeLink,
  } = req.body;
  const image_url = extractFileIdFromDriveLink(editProductLink);
  if (image_url != null) editProductLink = image_url;
  const query =
    "UPDATE products SET product_name = ?, product_description = ?, product_link = ?, youtube_link = ?, affiliate_link = ? WHERE product_id = ?";
  const values = [
    editProductName,
    editProductDescription,
    editProductLink,
    editYoutubeLink,
    editAffiliateLink,
    productId,
  ];
  db.run(query, values, (err) => {
    if (err) {
      logger.error("Error updating product:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }
    logger.info("Product updated successfully");
    res.redirect("/admin");
  });
});

// Server-side route for searching products
router.post("/search-products", async (req, res) => {
  logger.debug("Request for searching products");
  const searchQuery = req.body.searchQuery;
  const cacheKey = `search_product_${searchQuery}`;
  const products = await client.get(cacheKey);
  if (products) {
    logger.debug("Product found in cache");
    if(Array.isArray(products)){
        res.json(JSON.parse(products));
    }else{
        res.json([JSON.parse(products)]);
    }
  } else {
    const products = await getProductById(searchQuery);
    if (!products) {
      return res.status(404).json({ error: "Product not found" });
    }
    client.set(cacheKey, JSON.stringify(products), {
      EX: 3600,
    }); // // cache for 1 hour
    // if products is array then return products else if it is dict then add in array then return that product array
    if (Array.isArray(products)) {
      res.json(products);
    } else {
      res.json([products]);
    }
  }
  // client.get(cacheKey, async (err, cachedProduct) => {
  //   if (err) {
  //     logger.error("Error fetching product from cache:", err);
  //   }

  //   if (cachedProduct) {
  //     logger.info("Product found in cache");
  //     res.json(JSON.parse(cachedProduct));
  //   } else {
  //     const product = await getProductById(searchQuery);
  //     if (!product) {
  //       return res.status(404).json({ error: "Product not found" });
  //     }

  //     client.setex(cacheKey, 3600, JSON.stringify(product)); // cache for 1 hour
  //     console.log(product);
  //     res.json(product);
  //   }
  // });
});

router.post("/server-side-products", async (req, res) => {
  logger.debug("Request for server-side products");
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
    logger.error("Error processing server-side request:", error);
    res.status(500).json({ error: "Server error" });
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

// Function to get the total number of records in the database
function getTotalRecords() {
  // Get the total number of records
  logger.debug("Fetching total number of records");
  return new Promise((resolve, reject) => {
    db.get("SELECT COUNT(*) as count FROM products", (err, row) => {
      if (err) {
        logger.error("Error fetching total number of records:", err);
        reject(err);
      } else {
        logger.debug(`Total number of records: ${row.count}`);
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
  logger.info("Fetching products based on DataTables request");
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
        logger.error("Error fetching products:", err);
        reject(err);
      } else {
        logger.info("Fetched products:", rows.length);
        resolve(rows);
      }
    });
  });
}
module.exports = router;
