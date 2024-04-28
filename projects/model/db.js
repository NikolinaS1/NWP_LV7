const mongoose = require("mongoose");

mongoose
  .connect("mongodb://127.0.0.1:27017", {})
  .then(() => {
    console.log("MongoDB connected successfully");
  })
  .catch((err) => {
    console.error("Error connecting to MongoDB:", err);
  });
