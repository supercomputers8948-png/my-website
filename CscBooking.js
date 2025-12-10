const mongoose = require("mongoose");

const cscBookingSchema = new mongoose.Schema({
  id: String,
  service: String,
  date: String,
  name: String,
  phone: String,
  notes: String,
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("CscBooking", cscBookingSchema);
