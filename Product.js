// models/Product.js
const mongoose = require("mongoose");

const PriceHistorySchema = new mongoose.Schema(
  {
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    offerPercentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 90,
    },
    changedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const ProductSchema = new mongoose.Schema({
  // Short internal product code (you already have a unique index on this in Mongo)
  code: {
    type: String,
    trim: true,
  },

  // Display name
  title: {
    type: String,
    required: [true, "Product title is required"],
    trim: true,
  },

  // "computers" | "mobiles" | "accessories" | "other"
  category: {
    type: String,
    required: [true, "Category is required"],
    enum: ["computers", "mobiles", "accessories", "other"],
    default: "computers",
  },

  description: {
    type: String,
    default: "",
    trim: true,
  },

  // Final selling price
  price: {
    type: Number,
    required: [true, "Price is required"],
    min: 0,
  },

  // Discount percentage
  offerPercentage: {
    type: Number,
    default: 0,
    min: 0,
    max: 90,
  },

  stock: {
    type: Number,
    default: 0,
    min: 0,
  },

  // If true ⇒ hide from public shop
  hideProduct: {
    type: Boolean,
    default: false,
  },

  // Multiple images; shop uses images[0]
  images: {
    type: [String],
    default: [],
  },

  offerExpiry: {
    type: Date,
    default: null,
  },

  priceHistory: {
    type: [PriceHistorySchema],
    default: [],
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },

  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// 🚫 no app.post, no pre('save'), no next()

module.exports = mongoose.model("Product", ProductSchema);
