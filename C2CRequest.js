const mongoose = require("mongoose");

const c2cSchema = new mongoose.Schema({
  id: String,
  brand: String,
  amount: Number,
  name: String,
  phone: String,
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("C2CRequest", c2cSchema);
