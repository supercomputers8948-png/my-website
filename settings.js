// models/Setting.js
const mongoose = require("mongoose");

const SettingSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  text: {
    type: String,
    default: "",
    trim: true,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Setting", SettingSchema);
