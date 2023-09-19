const express = require("express");
const bodyParser = require("body-parser");
const db = require("./database/db"); // Import the database module

const app = express();
const port = process.env.PORT || 5000;

app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static("public"));
app.set("view engine", "ejs");

// Include the route modules
const indexRoutes = require("./routes/index");
const adminRoutes = require("./routes/admin");
const productRoutes = require("./routes/product");

// Use the route modules
app.use("/", indexRoutes);
app.use("/admin", adminRoutes);
app.use("/", productRoutes);

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
