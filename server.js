require("dotenv").config();
const express = require("express");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;

if (!JWT_SECRET || !ADMIN_PASSWORD_HASH) {
  console.error(
    "\nMissing JWT_SECRET or ADMIN_PASSWORD_HASH.\n" +
    "Run `npm run hash-password`, copy the output into a .env file (see .env.example), then restart.\n"
  );
  process.exit(1);
}

// DATA_DIR defaults to a local folder for development. In production, point it
// at a mounted persistent disk (see README's "Deploying" section) so hostel
// and resident data survives restarts and redeploys.
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "directory.json");

function loadData() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const h1 = { id: crypto.randomUUID(), name: "Hostel A" };
    const h2 = { id: crypto.randomUUID(), name: "Hostel B" };
    const seed = {
      hostels: [h1, h2],
      entries: [
        { id: crypto.randomUUID(), hostelId: h1.id, room: "204", name: "Priya Sharma" },
        { id: crypto.randomUUID(), hostelId: h1.id, room: "204", name: "Ishita Rao" },
        { id: crypto.randomUUID(), hostelId: h1.id, room: "310", name: "Aman Verma" },
        { id: crypto.randomUUID(), hostelId: h2.id, room: "112", name: "Rohan Gupta" },
      ],
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(seed, null, 2));
  }
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 6,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Try again in 15 minutes." },
});

function requireAuth(req, res, next) {
  const token = req.cookies.session;
  if (!token) return res.status(401).json({ error: "Not authenticated" });
  try {
    jwt.verify(token, JWT_SECRET);
    next();
  } catch (e) {
    return res.status(401).json({ error: "Session expired, log in again" });
  }
}

/* ---------------- Public routes ---------------- */

app.get("/api/directory", (req, res) => {
  res.json(loadData());
});

app.get("/api/session", (req, res) => {
  const token = req.cookies.session;
  if (!token) return res.json({ authenticated: false });
  try {
    jwt.verify(token, JWT_SECRET);
    res.json({ authenticated: true });
  } catch (e) {
    res.json({ authenticated: false });
  }
});

app.post("/api/login", loginLimiter, async (req, res) => {
  const { password } = req.body || {};
  if (!password) return res.status(400).json({ error: "Passcode required" });

  const ok = await bcrypt.compare(password, ADMIN_PASSWORD_HASH);
  if (!ok) return res.status(401).json({ error: "Incorrect passcode" });

  const token = jwt.sign({ role: "admin" }, JWT_SECRET, { expiresIn: "12h" });
  res.cookie("session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 12 * 60 * 60 * 1000,
  });
  res.json({ ok: true });
});

app.post("/api/logout", (req, res) => {
  res.clearCookie("session");
  res.json({ ok: true });
});

/* ---------------- Protected routes ---------------- */

app.post("/api/hostels", requireAuth, (req, res) => {
  const { name } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: "Hostel name required" });
  const data = loadData();
  const hostel = { id: crypto.randomUUID(), name: name.trim() };
  data.hostels.push(hostel);
  saveData(data);
  res.json(hostel);
});

app.delete("/api/hostels/:id", requireAuth, (req, res) => {
  const data = loadData();
  data.hostels = data.hostels.filter((h) => h.id !== req.params.id);
  data.entries = data.entries.filter((e) => e.hostelId !== req.params.id);
  saveData(data);
  res.json({ ok: true });
});

app.post("/api/entries", requireAuth, (req, res) => {
  const { hostelId, room, name } = req.body || {};
  if (!hostelId || !room || !name) {
    return res.status(400).json({ error: "hostelId, room, and name are all required" });
  }
  const data = loadData();
  if (!data.hostels.find((h) => h.id === hostelId)) {
    return res.status(400).json({ error: "Unknown hostel" });
  }
  const entry = { id: crypto.randomUUID(), hostelId, room: String(room).trim(), name: name.trim() };
  data.entries.push(entry);
  saveData(data);
  res.json(entry);
});

app.delete("/api/entries/:id", requireAuth, (req, res) => {
  const data = loadData();
  data.entries = data.entries.filter((e) => e.id !== req.params.id);
  saveData(data);
  res.json({ ok: true });
});

app.listen(PORT, () => console.log(`Hostel Ledger running at http://localhost:${PORT}`));
