// routes/public.js
// Public-facing API — no auth required

'use strict';

const router  = require('express').Router();
const rateLimit = require('express-rate-limit');
const validator = require('validator');

const Project        = require('../models/Project');
const ContactMessage = require('../models/ContactMessage');

// ── Rate limiters ─────────────────────────────

// Contact form: max 5 submissions per 15 minutes per IP
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { message: 'Too many messages sent. Please wait a few minutes before trying again.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── GET /api/projects ─────────────────────────
// Returns all published projects, ordered by `order` then newest first
router.get('/projects', async (req, res) => {
  try {
    const projects = await Project
      .find({})
      .sort({ order: 1, createdAt: -1 })
      .select('-imageFilename -__v')
      .lean();

    res.json({ projects });
  } catch (err) {
    console.error('[API] GET /projects:', err.message);
    res.status(500).json({ message: 'Could not load projects.' });
  }
});

// ── POST /api/contact ─────────────────────────
router.post('/contact', contactLimiter, async (req, res) => {
  try {
    const { name, email, subject, message, _honey } = req.body;

    // ── Honeypot check ────────────────────────
    if (_honey) {
      // Silently accept — bots shouldn't know they were caught
      return res.json({ message: 'Message sent!' });
    }

    // ── Field presence ────────────────────────
    const errors = [];

    if (!name    || typeof name    !== 'string') errors.push('name');
    if (!email   || typeof email   !== 'string') errors.push('email');
    if (!subject || typeof subject !== 'string') errors.push('subject');
    if (!message || typeof message !== 'string') errors.push('message');

    if (errors.length) {
      return res.status(400).json({ message: 'Please fill in all required fields.' });
    }

    // ── Trim ──────────────────────────────────
    const cleanName    = validator.escape(name.trim());
    const cleanEmail   = email.trim().toLowerCase();
    const cleanSubject = validator.escape(subject.trim());
    const cleanMessage = validator.escape(message.trim());

    // ── Field validation ──────────────────────
    if (cleanName.length    < 2   || cleanName.length    > 100) return res.status(400).json({ message: 'Invalid name.' });
    if (!validator.isEmail(cleanEmail))                          return res.status(400).json({ message: 'Invalid email address.' });
    if (cleanSubject.length < 3   || cleanSubject.length > 150) return res.status(400).json({ message: 'Invalid subject.' });
    if (cleanMessage.length < 10  || cleanMessage.length > 2000)return res.status(400).json({ message: 'Message must be 10–2000 characters.' });

    // ── Save to DB ────────────────────────────
    const ip = req.ip || req.headers['x-forwarded-for'] || '';

    await ContactMessage.create({
      name:    cleanName,
      email:   cleanEmail,
      subject: cleanSubject,
      message: cleanMessage,
      ip,
    });

    res.json({ message: 'Message sent! I\'ll get back to you soon.' });

  } catch (err) {
    console.error('[API] POST /contact:', err.message);
    res.status(500).json({ message: 'Could not send your message. Please try again.' });
  }
});

module.exports = router;
