// ============================================
//  ISAIAH AMOS — PORTFOLIO SERVER
//  server.js — Entry point
// ============================================

'use strict';

require('dotenv').config();

const express    = require('express');
const mongoose   = require('mongoose');
const path       = require('path');
const helmet     = require('helmet');
const cors       = require('cors');
const rateLimit  = require('express-rate-limit');
const session    = require('express-session');
const MongoStore = require('connect-mongo');

const publicRouter = require('./routes/public');
const adminRouter  = require('./routes/admin');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Database ──────────────────────────────────
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('[DB] MongoDB connected'))
  .catch(err => { console.error('[DB] Connection failed:', err.message); process.exit(1); });

// ── Security headers ──────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:  ["'self'"],
      scriptSrc:   ["'self'", "'unsafe-inline'"],
      styleSrc:    ["'self'", "'unsafe-inline'",
                    'https://fonts.googleapis.com',
                    'https://cdnjs.cloudflare.com'],
      fontSrc:     ["'self'", 'https://fonts.gstatic.com',
                    'https://cdnjs.cloudflare.com'],
      imgSrc:      ["'self'", 'data:', 'https://res.cloudinary.com'],
      connectSrc:  ["'self'"],
      frameSrc:    ["'none'"],
      objectSrc:   ["'none'"],
    },
  },
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// ── CORS ──────────────────────────────────────
app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || 'http://localhost:3000',
  credentials: true,
}));

// ── Body parsers ──────────────────────────────
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false, limit: '10kb' }));

// ── Session ───────────────────────────────────
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: process.env.MONGO_URI }),
  cookie: {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge:   1000 * 60 * 60 * 8,
  },
  name: 'sid',
}));

// ── Rate limiter ──────────────────────────────
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests. Please try again later.' },
}));

// ── Static files ──────────────────────────────
app.use(express.static(path.join(__dirname, 'public'), {
  index: false,
  maxAge: '1d',
}));

// ── API + Admin routes ────────────────────────
app.use('/api',   publicRouter);
app.use('/admin', adminRouter);

// ── Frontend page routes ──────────────────────
app.get('/admin/login',     (_req, res) => res.sendFile(path.join(__dirname, 'public/admin/login.html')));
app.get('/admin/dashboard', (_req, res) => res.sendFile(path.join(__dirname, 'public/admin/dashboard.html')));
app.get('*',                (_req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));

// ── Global error handler ──────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (res.headersSent) return;
  console.error('[ERROR]', err.message);
  res.status(err.status || 500).json({ message: 'Internal server error.' });
});

// ── Start ─────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[SERVER] Running on http://localhost:${PORT}`);
});
