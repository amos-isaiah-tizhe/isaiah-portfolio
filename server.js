// ============================================
//  ISAIAH AMOS — PORTFOLIO SERVER
//  server.js — Entry point
// ============================================

'use strict';

require('dotenv').config();

const express  = require('express');
const mongoose = require('mongoose');
const path     = require('path');
const helmet   = require('helmet');
const cors     = require('cors');
const rateLimit= require('express-rate-limit');
const session  = require('express-session');
const MongoStore = require('connect-mongo');

// ── Route files ──────────────────────────────
const publicRouter = require('./routes/public');
const adminRouter  = require('./routes/admin');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Database ─────────────────────────────────
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('[DB] MongoDB connected'))
  .catch(err => { console.error('[DB] Connection failed:', err.message); process.exit(1); });

// ── Security middleware ───────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:  ["'self'"],
      scriptSrc:   ["'self'", "'unsafe-inline'"],       // inline scripts in admin HTML
      styleSrc:    ["'self'", "'unsafe-inline'",
                    'https://fonts.googleapis.com',
                    'https://cdnjs.cloudflare.com'],
      fontSrc:     ["'self'", 'https://fonts.gstatic.com',
                    'https://cdnjs.cloudflare.com'],
      imgSrc:      ["'self'", 'data:'],
      connectSrc:  ["'self'"],
      frameSrc:    ["'none'"],
      objectSrc:   ["'none'"],
    },
  },
  crossOriginResourcePolicy: { policy: 'same-origin' },
}));

// ── CORS (same-origin for production) ────────
app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || 'http://localhost:3000',
  credentials: true,
}));

// ── Body parsers ─────────────────────────────
app.use(express.json({ limit: '10kb' }));           // cap JSON body
app.use(express.urlencoded({ extended: false, limit: '10kb' }));

// ── Session ───────────────────────────────────
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: process.env.MONGO_URI }),
  cookie: {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',  // HTTPS only in prod
    sameSite: 'lax',
    maxAge:   1000 * 60 * 60 * 8,                    // 8 hours
  },
  name: 'sid',                                        // hide default name
}));

// ── Global rate limiter ───────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 min
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests. Please try again later.' },
});
app.use(globalLimiter);

// ── Static files ──────────────────────────────
// Serve uploaded images
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  maxAge: '7d',
  etag: true,
}));

// Serve public frontend (HTML/CSS/JS)
app.use(express.static(path.join(__dirname, 'public'), {
  index: false,   // we handle the route manually
  maxAge: '1d',
}));

// ── API routes ────────────────────────────────
app.use('/api',   publicRouter);
app.use('/admin', adminRouter);

// ── Frontend routes ───────────────────────────
// Admin pages — served only from /admin/
app.get('/admin/login',     (req, res) => res.sendFile(path.join(__dirname, 'public/admin/login.html')));
app.get('/admin/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'public/admin/dashboard.html')));

// Portfolio — catch-all
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

// ── Global error handler ─────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message);
  res.status(err.status || 500).json({ message: 'Internal server error.' });
});

// ── Start ─────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[SERVER] Running on http://localhost:${PORT}`);
});
