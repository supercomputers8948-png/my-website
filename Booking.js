const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema({
  id: String,
  deviceType: String,
  dateSlot: String,
  description: String,
  contactPhone: String,
  status: { type: String, default: "Pending" },
  estimate: { type: Number, default: null },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Booking", bookingSchema);
