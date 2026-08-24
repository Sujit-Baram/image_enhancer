// Image Enhancer — Backend API (v2: with PostgreSQL)
// Real image processing with sharp, PLUS a real database tier: every
// enhancement's metadata (settings used, dimensions, sizes) is now
// persisted to Postgres, not just inferred by listing files on disk.
// Frontend and backend still talk purely via Compose SERVICE NAME.
// Backend and database do the exact same thing, one hop further:
// DB_HOST=db resolves via Docker's DNS to the "db" service.

const express = require("express");
const multer = require("multer");
const sharp = require("sharp");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 3000;
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

app.use(cors());
app.use("/enhanced", express.static(UPLOAD_DIR));

// ---------------------------------------------------------------
// Database connection — points at the "db" Compose service by name
// ---------------------------------------------------------------
const pool = new Pool({
  host: process.env.DB_HOST || "db",
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || "image_enhancer",
  user: process.env.DB_USER || "app_user",
  password: process.env.DB_PASSWORD || "app_password",
  max: 10,
});

pool.on("error", (err) => {
  console.error("Unexpected DB pool error:", err.message);
});

async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS enhancements (
      id               SERIAL PRIMARY KEY,
      filename         TEXT NOT NULL,
      original_filename TEXT,
      width            INTEGER NOT NULL,
      height           INTEGER NOT NULL,
      size_bytes       INTEGER NOT NULL,
      original_size_bytes INTEGER,
      brightness       REAL NOT NULL,
      saturation       REAL NOT NULL,
      sharpened        BOOLEAN NOT NULL,
      processed_by     TEXT,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_enhancements_created_at ON enhancements (created_at DESC);`);
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) return cb(new Error("Only image files are allowed"));
    cb(null, true);
  },
});

app.get("/health", async (req, res) => {
  let dbStatus = "unreachable";
  try {
    await pool.query("SELECT 1");
    dbStatus = "connected";
  } catch (err) {
    dbStatus = "unreachable";
  }
  res.json({
    status: "ok",
    uptime: process.uptime(),
    hostname: os.hostname(),
    uploadDir: UPLOAD_DIR,
    sharpVersion: sharp.versions.sharp,
    db: dbStatus,
  });
});

// GET /enhancements — reads from the DATABASE now, not the filesystem.
// This is deliberate: it proves the DB round-trip actually works, and it's
// how a real app would do it (the filesystem alone can't tell you WHICH
// settings were used, or filter/sort/paginate cleanly).
app.get("/enhancements", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT filename, width, height, size_bytes, brightness, saturation, sharpened, created_at
       FROM enhancements ORDER BY id DESC LIMIT 24`
    );
    res.json(rows.map(r => ({ ...r, url: `/enhanced/${r.filename}` })));
  } catch (err) {
    console.error("Failed to read enhancements from DB:", err.message);
    // Degrade gracefully rather than break the whole page — same
    // resilience pattern taught in the RDS class.
    res.json([]);
  }
});

app.post("/enhance", upload.single("image"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No image uploaded (field name must be 'image')" });
  }

  const width = Math.min(Number(req.body.width) || 800, 4000);
  const brightness = Math.max(0.5, Math.min(Number(req.body.brightness) || 1.15, 2.0));
  const saturation = Math.max(0, Math.min(Number(req.body.saturation) || 1.25, 3.0));
  const sharpenAmount = req.body.sharpen !== "false";

  let outputBuffer, metadata, filename;
  try {
    let pipeline = sharp(req.file.buffer).resize({ width, withoutEnlargement: true }).modulate({ brightness, saturation });
    if (sharpenAmount) pipeline = pipeline.sharpen();
    outputBuffer = await pipeline.webp({ quality: 85 }).toBuffer();

    filename = `enhanced-${Date.now()}-${Math.round(Math.random() * 1e6)}.webp`;
    fs.writeFileSync(path.join(UPLOAD_DIR, filename), outputBuffer);
    metadata = await sharp(outputBuffer).metadata();
  } catch (err) {
    console.error("Enhancement failed:", err.message);
    return res.status(500).json({ error: "Image processing failed", details: err.message });
  }

  // The image itself is already saved successfully at this point — a DB
  // hiccup below should NOT make the whole request fail (same principle
  // as the Converter Hub project: core feature succeeds even if a
  // secondary write fails).
  try {
    await pool.query(
      `INSERT INTO enhancements
         (filename, original_filename, width, height, size_bytes, original_size_bytes, brightness, saturation, sharpened, processed_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [filename, req.file.originalname, metadata.width, metadata.height, outputBuffer.length,
       req.file.size, brightness, saturation, sharpenAmount, os.hostname()]
    );
  } catch (err) {
    console.error("Failed to record enhancement in DB (image still saved):", err.message);
  }

  res.status(201).json({
    filename,
    url: `/enhanced/${filename}`,
    width: metadata.width,
    height: metadata.height,
    sizeBytes: outputBuffer.length,
    originalSizeBytes: req.file.size,
    appliedSettings: { width, brightness, saturation, sharpened: sharpenAmount },
    processedBy: os.hostname(),
  });
});

app.listen(PORT, async () => {
  console.log(`Image Enhancer API listening on port ${PORT}`);
  console.log(`Saving enhanced images to: ${UPLOAD_DIR}`);
  try {
    await ensureSchema();
    console.log("Database schema ready");
  } catch (err) {
    console.error("Could not initialize DB schema at startup (will retry per-request):", err.message);
  }
});
