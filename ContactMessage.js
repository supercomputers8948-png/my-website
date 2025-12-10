const mongoose = require("mongoose");

const contactSchema = new mongoose.Schema({
  id: String,
  name: String,
  email: String,
  phone: String,
  subject: String,
  message: String,
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("ContactMessage", contactSchema);
