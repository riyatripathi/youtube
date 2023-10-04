const express = require("express");
const router = express.Router();
const fs = require("fs");
const multer = require("multer");
const db = require("./../database/db");
const upload = require("../config/multer");
const logger = require("../logger");
const redis = require("redis");
const { cache } = require("ejs");
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
  return new Promise((resolve, reject) => {
    db.all(query, [length, start], (err, rows) => {
      if (err) {
        logger.error("Error fetching products:", err);
        reject(err);
      }
      resolve(rows);
    });
  });
}

// router.post("/add-product", upload.single("productImage"), (req, res) => {
//   logger.debug("Request for adding product");
//   let {
//     productName,
//     productDescription,
//     productLink,
//     affiliateLink,
//     youtubeLink,
//   } = req.body;

//   const image_url = extractFileIdFromDriveLink(productLink);
//   if (image_url != null) productLink = image_url;
//   const query =
//     "INSERT INTO products ( product_name, product_description, product_link, affiliate_link, youtube_link) VALUES (?, ?, ?, ?, ?)";
//   const values = [
//     productName,
//     productDescription,
//     productLink,
//     affiliateLink,
//     youtubeLink,
//   ];

//   db.run(query, values, function (err) {
//     if (err) {
//       logger.error("Error adding product to the database:", err);
//       return res.status(500).json({ error: "Internal Server Error" });
//     }
//     values.unshift(this.lastID);
//     logger.info("Product added successfully:", values);
//     res.json({
//       message: "Product added successfully",
//       data: values,
//     });
//   });
// });

router.post("/add-product", upload.single("productImage"), (req, res) => {
  logger.debug("Request for adding product");
  let {
    productName,
    productDescription,
    // productLink, image linkn removing it adding upload direct from admin panel
    affiliateLink,
    youtubeLink,
  } = req.body;

  if (!req.file) {
    // Handle the case where no file was uploaded
    return res.status(400).json({ error: "No image uploaded" });
  }

  // const { image_url, path } = req.file;
  filename = req.file.filename;
  // console.log(req.file);
  // const image_url = extractFileIdFromDriveLink(productLink);
  if (filename != null) productLink = filename;
  // console.log(image_url);
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

router.delete("/products/delete/:productId", async (req, res) => {
  let productId = req.params.productId;
  logger.debug(`Request for deleting product ${productId}`);
  if (productId && productId.length > 0) {
    productId = productId.substring(1);
  }
  console.log(productId);
  // get product from product id
  const product = await getProductById(productId);
  // get product product_link attribute
  const productLink = product.product_link;
  db.run("DELETE FROM products WHERE product_id = ?", [productId], (err) => {
    if (err) {
      logger.error("Error deleting product:", err);
      res.status(500).json({ error: "Internal server error" });
    } else {
      logger.info(`Product deleted successfully from Database ${productId}`);
    }
  });

  // check product exists in cache of key pin_products if yes then delete it
  let cacheKey = `pin_products`;

  // get products from cache
  let products = await client.get(cacheKey);
  if (products) {
    // pin_products exits in cache, get the data
    products = JSON.parse(products);
    // remove the product from products whose product id is equal to product id
    products = products.filter((product) => {
      return product.product_id != productId;
    });
    client.set(cacheKey, JSON.stringify(products), {
      EX: 3600, // cache for 1 hour
    });
  }

  cacheKey = `search_product_${productId}`;
  // delete product from cache
  // delete the cache
  await client.del(cacheKey);

  try {
    // liner search the all cache keys for id, if product id found delete that key's value from cache
    const pattern = `products_*_${FETCH_LIMIT}`;
    const keys = await client.keys(pattern);
    for (const key of keys) {
      const value = await client.get(key);
      // if product id found in the value which is array of dictionary
      let product = null;
      if (value) {
        products = JSON.parse(value);
        // find productID exists in products
        products = products.filter((product) => {
          return product.product_id == productId;
        });
        if (products.length > 0) {
          // delete key
          client.del(key);
          break;
        }
      }
    }
    logger.info(`Product deleted successfully from Cache ${productId}`);
    // delete the image from public/images
    const imagePath = `public/images/${productLink}`;
    fs.unlink(imagePath, (err) => {
      if (err) {
        logger.error(`Error deleting product image: ${err}`);
      }
    });
    res.status(200).json({ message: "Product deleted successfully" });
    // res.status(200).redirect("/admin");
  } catch (err) {
    logger.error(`Error deleting product: ${err}`);
    res.status(500).json({ error: "Internal server error" });
  }
});

// edit changes route having product id specified
router.post("/find-product/:productId", (req, res) => {
  logger.debug("Request for fetching product /find-product/:productId");
  let productId = req.params.productId;
  productId = productId.substring(1);
  const query = "SELECT * FROM products WHERE product_id = ?";

  db.get(query, [productId], (err, product) => {
    if (err) {
      logger.error(`Error fetching product: ${err}`);
      return res.status(500).json({ error: "Internal Server Error" });
    }
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }
    res.json(product);
  });
});

router.post(
  "/update-product/:productId",
  upload.single("productImage"),
  async (req, res) => {
    let productId = req.params.productId.replace("e", "");
    logger.debug(`Request for updating product, update-product/${productId}`);
    let {
      editProductName,
      editProductDescription,
      editAffiliateLink,
      editYoutubeLink,
      editProductLink,
    } = req.body;
    if (req.file) {
      ImagePath = `public/images/${editProductLink}`;
      fs.unlinkSync(ImagePath);
      editProductLink = req.file.filename;
    }

    // const image_url = extractFileIdFromDriveLink(editProductLink);
    // if (image_url != null) editProductLink = image_url;
    const query =
      "UPDATE products SET product_name = ?, product_description = ?, product_link = ?, youtube_link = ?, affiliate_link = ? WHERE product_id = ?";
    values = [
      editProductName,
      editProductDescription,
      editProductLink,
      editYoutubeLink,
      editAffiliateLink,
      productId.replace("e", ""),
    ];
    console.log(values);
    db.run(query, values, (err) => {
      if (err) {
        logger.error("Error updating product:", err);
        return res.status(500).json({ error: "Internal Server Error" });
      }
      logger.info("Product updated successfully");
    });

    // check product exists in cache of key pin_products if yes then delete it
    let cacheKey = `pin_products`;
    // get products from cache
    let products = await client.get(cacheKey);
    if (products) {
      // pin_products exits in cache, get the data
      products = JSON.parse(products);
      // update the dict whose product_id is ProductId
      products = products.map((product) => {
        if (product.product_id == productId) {
          product.product_name = editProductName;
          product.product_description = editProductDescription;
          product.product_link = editProductLink;
          product.youtube_link = editYoutubeLink;
          product.affiliate_link = editAffiliateLink;
        }
        return product;
      });

      client.set(cacheKey, JSON.stringify(products), {
        EX: 86400, // cache for 1 day
      });
    }

    cacheKey = `search_product_${productId}`;
    // get the product if exists and update
    products = await client.get(cacheKey);
    if (products) {
      if (Array.isArray(products)) {
        products = JSON.parse(products);
      } else {
        products = [JSON.parse(products)];
      }
      // update the dict whose product_id is ProductId
      products = products.map((product) => {
        if (product.product_id == productId) {
          product.product_name = editProductName;
          product.product_description = editProductDescription;
          product.product_link = editProductLink;
          product.youtube_link = editYoutubeLink;
          product.affiliate_link = editAffiliateLink;
        }
        return product;
      });

      client.set(cacheKey, JSON.stringify(products), {
        EX: 86400, // cache for 1 day
      });
    }

    try {
      // liner search the all cache keys for id, if product id found delete that key's value from cache
      const pattern = `products_*_${FETCH_LIMIT}`;
      const keys = await client.keys(pattern);
      for (const key of keys) {
        const value = await client.get(key);
        // if product id found in the value which is array of dictionary
        let product = null;
        if (value) {
          products = JSON.parse(value);
          // find productID exists in products
          products = products.map((product) => {
            if (product.product_id == productId) {
              product.product_name = editProductName;
              product.product_description = editProductDescription;
              product.product_link = editProductLink;
              product.youtube_link = editYoutubeLink;
              product.affiliate_link = editAffiliateLink;
            }
            return product;
          });
          client.set(key, JSON.stringify(products), {
            EX: 3600, // cache for 1 hour
          });
        }
      }
    } catch (err) {
      logger.error(`Error deleting product: ${err}`);
      res.status(500).json({ error: "Internal server error" });
    }
    res.status(200).redirect("/admin");
  }
);

// Server-side route for searching products
router.post("/search-products", async (req, res) => {
  logger.debug("Request for searching products");
  const searchQuery = req.body.searchQuery;
  const cacheKey = `search_product_${searchQuery}`;
  const products = await client.get(cacheKey);
  if (products) {
    logger.info("Product found in cache");
    if (Array.isArray(products)) {
      res.json(JSON.parse(products));
    } else {
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
});

router.get("/click-on-product/:id", async (req, res) => {
  logger.debug("Request for clicking on product");
  const productId = req.params.id;
  const query = "UPDATE products SET clicks = clicks + 1 WHERE product_id = ?";
  const values = [productId];
  db.run(query, values, (err) => {
    if (err) {
      logger.error("Error updating product:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }
    logger.info("Product clicked successfully");
  });
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

router.get("/pin-products", async (req, res) => {
  logger.debug("Request for pinning products");
  try {
    const products = await getPinProducts();
    res.json(products);
  } catch (error) {
    logger.error("Error processing server-side request:", error);
    res.status(500).json({ error: "Server error" });
  }
});

async function getPinProducts() {
  logger.debug("Fetching pin products");
  // fetch pin products from redis whose key is pin_products
  cacheKey = `pin_products`;
  let products = await client.get(cacheKey);
  return JSON.parse(products);
}

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
