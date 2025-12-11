require("dotenv").config();
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const fs = require("fs");
const path = require("path");
const os = require("os");
const PDFDocument = require("pdfkit");
const { v4: uuidv4 } = require("uuid");
const mongoose = require("mongoose");

// ---------- MONGOOSE MODELS ----------
const Booking = require("./Booking");
const C2CRequest = require("./C2CRequest");
const CscBooking = require("./CscBooking");
const ContactMessage = require("./ContactMessage");
const Product = require("./Product");

const app = express();
const PORT = process.env.PORT || 10000;

// ---------- MONGODB CONNECTION ----------
function maskUri(uri) {
  if (!uri) return "";
  try {
    return uri.replace(/\/\/([^:]+):([^@]+)@/, "//$1:***@");
  } catch {
    return uri;
  }
}

if (!process.env.MONGODB_URI) {
  console.error("❌ MONGODB_URI is not set in environment variables");
} else {
  console.log("MONGODB_URI preview:", maskUri(process.env.MONGODB_URI).slice(0, 120));
  mongoose
    .connect(process.env.MONGODB_URI) // mongoose v6+ uses sensible defaults
    .then(() => console.log("🌿 MongoDB Connected"))
    .catch((err) => {
      console.error("MongoDB Error:", err && err.message ? err.message : err);
    });
}

// ---------- MIDDLEWARE ----------
app.use(cors());
app.use(express.json({ limit: "5mb" }));
app.use(morgan("dev"));

// ---------- STATIC FRONTEND ----------
const publicDir = __dirname;
app.use(express.static(publicDir));

app.get("/", (req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

app.get("/admin", (req, res) => {
  res.sendFile(path.join(publicDir, "admin.html"));
});

app.get("/admin-product", (req, res) => {
  res.sendFile(path.join(publicDir, "admin_product.html"));
});

app.get("/track", (req, res) => {
  res.sendFile(path.join(publicDir, "track.html"));
});

// ---------- PDFs (safe for serverless) ----------
const pdfsBase = path.join(os.tmpdir(), "super-computers-pdfs");
// Do NOT create the dir at import time; create inside handler
app.use("/pdfs", express.static(pdfsBase));

const fmtINR = (x) => "₹" + Number(x || 0).toLocaleString("en-IN");

// ---------- HEALTH ----------
app.get("/api/health", (req, res) => {
  res.json({ ok: true, message: "Super Computers API running ✅" });
});

// =====================================================
// 1) CUSTOMER-FACING ROUTES
// =====================================================

app.get("/api/products", async (req, res) => {
  try {
    const items = await Product.find({ hideProduct: { $ne: true } })
      .sort({ category: 1, title: 1 })
      .lean();
    res.json({ success: true, items });
  } catch (err) {
    console.error("Products error:", err);
    res.status(500).json({ success: false, message: "Server error while loading products" });
  }
});

app.post("/api/book", async (req, res) => {
  try {
    const { device_type, date_slot, description, contact_phone } = req.body || {};
    if (!device_type || !date_slot || !description || !contact_phone) {
      return res.status(400).json({ success: false, message: "Missing fields" });
    }

    const id = "TF" + new Date().getFullYear() + "-" + uuidv4().slice(0, 8).toUpperCase();

    const booking = {
      id,
      deviceType: device_type,
      dateSlot: date_slot,
      description,
      contactPhone: contact_phone,
      status: "Pending",
      estimate: null,
      createdAt: new Date().toISOString(),
    };

    await Booking.create(booking);
    res.json({ success: true, message: `Booking created with Ticket ID: ${id}`, bookingId: id });
  } catch (err) {
    console.error("Book error:", err);
    res.status(500).json({ success: false, message: "Server error while booking" });
  }
});

app.get("/api/track", async (req, res) => {
  try {
    const query = (req.query.phone || "").trim();
    if (!query) {
      return res.status(400).json({ success: false, message: "Phone or Ticket ID required" });
    }

    let booking;
    if (/^TF\d{4}-/i.test(query)) {
      booking = await Booking.findOne({ id: query.toUpperCase() }).lean();
    } else {
      booking = await Booking.findOne({ contactPhone: query }).lean();
    }

    if (!booking) return res.json({ success: false, message: "No booking found" });

    res.json({ success: true, booking });
  } catch (err) {
    console.error("Track error:", err);
    res.status(500).json({ success: false, message: "Server error while tracking" });
  }
});

app.post("/api/c2c", async (req, res) => {
  try {
    const { c2c_brand, c2c_amount, c2c_name, c2c_phone } = req.body || {};
    if (!c2c_brand || !c2c_amount || !c2c_name || !c2c_phone) {
      return res.status(400).json({ success: false, message: "Missing fields" });
    }

    const id = "C2C-" + uuidv4().slice(0, 8).toUpperCase();
    const request = {
      id,
      brand: c2c_brand,
      amount: Number(c2c_amount),
      name: c2c_name,
      phone: c2c_phone,
      createdAt: new Date().toISOString(),
    };

    await C2CRequest.create(request);
    res.json({ success: true, refId: id });
  } catch (err) {
    console.error("C2C error:", err);
    res.status(500).json({ success: false, message: "Server error while C2C" });
  }
});

app.post("/api/csc-booking", async (req, res) => {
  try {
    const { service, date, name, phone, notes } = req.body || {};
    if (!service || !date || !name || !phone) {
      return res.status(400).json({ success: false, message: "Missing fields" });
    }

    const id = "CSC-" + uuidv4().slice(0, 8).toUpperCase();
    const entry = { id, service, date, name, phone, notes: notes || "", createdAt: new Date().toISOString() };

    await CscBooking.create(entry);
    res.json({ success: true, token: id });
  } catch (err) {
    console.error("CSC booking error:", err);
    res.status(500).json({ success: false, message: "Server error while CSC" });
  }
});

app.post("/api/contact", async (req, res) => {
  try {
    const { c_name, c_email, c_phone, c_subject, c_message } = req.body || {};
    if (!c_name || !c_email || !c_subject || !c_message) {
      return res.status(400).json({ success: false, message: "Missing fields" });
    }

    const id = "CT-" + uuidv4().slice(0, 8).toUpperCase();
    const msg = {
      id,
      name: c_name,
      email: c_email,
      phone: c_phone || "",
      subject: c_subject,
      message: c_message,
      createdAt: new Date().toISOString(),
    };

    await ContactMessage.create(msg);
    res.json({ success: true, refId: id });
  } catch (err) {
    console.error("Contact error:", err);
    res.status(500).json({ success: false, message: "Server error while contact" });
  }
});

// CART → PDF (INVOICE) - safe for serverless
app.post("/api/cart-pdf", async (req, res) => {
  const { items, subtotal, timestamp } = req.body || {};

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, message: "Cart is empty." });
  }

  // Ensure pdfs dir exists in writable temp dir
  try {
    await fs.promises.mkdir(pdfsBase, { recursive: true });
  } catch (err) {
    console.error("Could not create temp pdfs dir, proceeding (writes may fail):", err);
  }

  const orderId = "ORD-" + uuidv4().slice(0, 8).toUpperCase();
  const filename = `${orderId}.pdf`;
  const filePath = path.join(pdfsBase, filename);

  try {
    const doc = new PDFDocument({ margin: 40 });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    doc.fontSize(22).text("Super Computers", { align: "center" });
    doc.moveDown(0.3);
    doc.fontSize(11).text("Galiveedu, Near ZPHS Boys High School", { align: "center" });
    doc.text("Annamyya Dist, Andhra Pradesh - 516267", { align: "center" });
    doc.text("Phone: +91 8688188948", { align: "center" });
    doc.moveDown(0.5);
    doc.moveTo(40, doc.y).lineTo(570, doc.y).stroke();
    doc.moveDown();

    doc.fontSize(14).text("Order Invoice", { align: "center" });
    doc.moveDown();

    doc.fontSize(11);
    doc.text(`Order ID : ${orderId}`);
    doc.text(`Date     : ${timestamp || new Date().toLocaleString("en-IN")}`);
    doc.moveDown();

    doc.fontSize(12).text("Items:", { underline: true });
    doc.moveDown(0.5);

    items.forEach((item, index) => {
      doc
        .fontSize(11)
        .text(
          `${index + 1}. ${item.title}  -  ${fmtINR(item.price)} x ${item.qty}  =  ${fmtINR(
            item.price * item.qty
          )}`
        );
    });

    doc.moveDown();
    doc.fontSize(13).text(`Subtotal: ${fmtINR(subtotal)}`, { align: "right" });

    doc.moveDown(2);
    doc.fontSize(10).text("Thank you for shopping with Super Computers.", { align: "center" });
    doc.text("For any support, please contact: +91 8688188948", { align: "center" });

    doc.end();

    stream.on("finish", () => {
      try {
        const pdfUrl = `${req.protocol}://${req.get("host")}/pdfs/${filename}`;
        res.json({ success: true, pdfUrl, orderId });
      } catch (err) {
        console.error("Error sending pdf response:", err);
        res.status(500).json({ success: false, message: "Failed to generate PDF." });
      }
    });

    stream.on("error", (err) => {
      console.error("PDF stream error:", err);
      res.status(500).json({ success: false, message: "Failed to generate PDF." });
    });
  } catch (err) {
    console.error("PDF generation error:", err);
    res.status(500).json({ success: false, message: "Failed to generate PDF." });
  }
});

// =====================================================
// 2) ADMIN APIs
// =====================================================

function checkAdminKey(req, res, next) {
  const clientKey = req.headers["x-admin-key"];
  const serverKey = process.env.ADMIN_KEY;

  if (!clientKey || clientKey !== serverKey) {
    return res.status(401).json({ success: false, message: "Unauthorized: invalid admin key" });
  }
  next();
}

app.get("/api/admin/summary", checkAdminKey, async (req, res) => {
  try {
    const [bookingCount, c2cCount, cscCount, contactCount, productCount] = await Promise.all([
      Booking.countDocuments(),
      C2CRequest.countDocuments(),
      CscBooking.countDocuments(),
      ContactMessage.countDocuments(),
      Product.countDocuments(),
    ]);

    res.json({
      success: true,
      data: { bookingCount, c2cCount, cscCount, contactCount, productCount },
    });
  } catch (err) {
    console.error("Admin summary error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.get("/api/admin/bookings", checkAdminKey, async (req, res) => {
  try {
    const bookings = await Booking.find().sort({ createdAt: -1 }).limit(300).lean();
    res.json({ success: true, bookings });
  } catch (err) {
    console.error("Admin bookings error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.patch("/api/admin/bookings/:id", checkAdminKey, async (req, res) => {
  try {
    const { status, estimate, finalAmount } = req.body;
    const update = {};

    if (status) update.status = status;
    if (estimate === null || estimate === "" || typeof estimate === "undefined") update.estimate = null;
    else update.estimate = Number(estimate);

    if (finalAmount === null || finalAmount === "" || typeof finalAmount === "undefined") update.finalAmount = null;
    else update.finalAmount = Number(finalAmount);

    update.updatedAt = new Date();

    const booking = await Booking.findByIdAndUpdate(req.params.id, update, { new: true });

    if (!booking) return res.status(404).json({ success: false, message: "Booking not found" });

    res.json({ success: true, booking });
  } catch (err) {
    console.error("Admin update booking error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.get("/api/admin/c2c", checkAdminKey, async (req, res) => {
  try {
    const items = await C2CRequest.find().sort({ createdAt: -1 }).limit(300).lean();
    res.json({ success: true, items });
  } catch (err) {
    console.error("Admin c2c error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.get("/api/admin/csc", checkAdminKey, async (req, res) => {
  try {
    const items = await CscBooking.find().sort({ createdAt: -1 }).limit(300).lean();
    res.json({ success: true, items });
  } catch (err) {
    console.error("Admin csc error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.get("/api/admin/contacts", checkAdminKey, async (req, res) => {
  try {
    const items = await ContactMessage.find().sort({ createdAt: -1 }).limit(300).lean();
    res.json({ success: true, items });
  } catch (err) {
    console.error("Admin contacts error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.get("/api/admin/products", checkAdminKey, async (req, res) => {
  try {
    const items = await Product.find().sort({ category: 1, title: 1 }).lean();
    res.json({ success: true, items });
  } catch (err) {
    console.error("Admin products error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.post("/api/admin/products", checkAdminKey, async (req, res) => {
  console.log("📥 CREATE PRODUCT BODY RECEIVED:", req.body);
  try {
    const { title, category, description, price, offerPercentage, stock, hideProduct, images, offerExpiry } =
      req.body || {};

    if (!title || !category || (price === undefined || price === null)) {
      return res.status(400).json({ success: false, message: "Product title, category and price are required." });
    }

    const now = new Date();
    const priceNum = Number(price);
    const offerPercentNum =
      offerPercentage === null || offerPercentage === "" || typeof offerPercentage === "undefined"
        ? 0
        : Number(offerPercentage);
    const stockNum = stock === null || stock === "" || typeof stock === "undefined" ? 0 : Number(stock);

    let offerExpiryDate = null;
    if (offerExpiry) {
      const dt = new Date(offerExpiry);
      if (!isNaN(dt.getTime())) offerExpiryDate = dt;
    }

    const imageList = Array.isArray(images) ? images : images ? [images] : [];

    const product = await Product.create({
      title,
      category,
      description: description || "",
      price: priceNum,
      offerPercentage: offerPercentNum,
      stock: stockNum,
      hideProduct: !!hideProduct,
      images: imageList,
      offerExpiry: offerExpiryDate,
      createdAt: now,
      updatedAt: now,
      priceHistory: [
        {
          price: priceNum,
          offerPercentage: offerPercentNum,
          changedAt: now,
        },
      ],
    });

    res.json({ success: true, product });
  } catch (err) {
    console.error("🔥 PRODUCT CREATE ERROR:", err);
    if (err.name === "ValidationError") {
      return res.status(400).json({ success: false, message: "Product validation failed.", errors: err.errors });
    }
    res.status(500).json({ success: false, message: err.message || "Server error while saving product." });
  }
});

app.patch("/api/admin/products/:id", checkAdminKey, async (req, res) => {
  console.log("📥 UPDATE PRODUCT BODY RECEIVED:", req.body);
  try {
    const { title, category, description, price, offerPercentage, stock, hideProduct, images, offerExpiry } =
      req.body || {};

    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: "Product not found" });

    let priceChanged = false;

    if (typeof title !== "undefined") product.title = title;
    if (typeof category !== "undefined") product.category = category;
    if (typeof description !== "undefined") product.description = description;

    if (typeof price !== "undefined" && price !== "") {
      const newPrice = Number(price);
      if (product.price !== newPrice) {
        product.price = newPrice;
        priceChanged = true;
      }
    }

    if (typeof offerPercentage !== "undefined") {
      const newOffer = offerPercentage === "" || offerPercentage === null ? 0 : Number(offerPercentage);
      if (product.offerPercentage !== newOffer) {
        product.offerPercentage = newOffer;
        priceChanged = true;
      }
    }

    if (typeof stock !== "undefined") product.stock = stock === "" || stock === null ? 0 : Number(stock);
    if (typeof hideProduct !== "undefined") product.hideProduct = !!hideProduct;
    if (typeof images !== "undefined") product.images = Array.isArray(images) ? images : images ? [images] : [];
    if (typeof offerExpiry !== "undefined") {
      if (!offerExpiry) product.offerExpiry = null;
      else {
        const dt = new Date(offerExpiry);
        if (!isNaN(dt.getTime())) product.offerExpiry = dt;
      }
    }

    if (priceChanged) {
      product.priceHistory = product.priceHistory || [];
      product.priceHistory.push({ price: product.price, offerPercentage: product.offerPercentage, changedAt: new Date() });
    }

    product.updatedAt = new Date();
    await product.save();

    res.json({ success: true, item: product });
  } catch (err) {
    console.error("🔥 PRODUCT UPDATE ERROR:", err);
    if (err.name === "ValidationError") {
      return res.status(400).json({ success: false, message: "Product validation failed.", errors: err.errors });
    }
    res.status(500).json({ success: false, message: err.message || "Server error while updating product." });
  }
});

// =====================================================
// SERVER START
// =====================================================
const server = app.listen(PORT, () => {
  console.log(`✅ Super Computers backend running on port ${PORT}`);
});

// Graceful shutdown
function shutdown() {
  console.log("Shutting down server...");
  server.close(() => {
    mongoose.disconnect().finally(() => {
      process.exit(0);
    });
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
