// routes/public.js
'use strict';

const router    = require('express').Router();
const rateLimit = require('express-rate-limit');
const validator = require('validator');
const { Resend } = require('resend');

const Project        = require('../models/Project');
const ContactMessage = require('../models/ContactMessage');

const resend = new Resend(process.env.RESEND_API_KEY);

// ── Rate limiters ─────────────────────────────
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 2,
  message: { message: 'Too many messages sent. Please wait a few minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── GET /api/projects ─────────────────────────
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

    // Honeypot
    if (_honey) return res.json({ message: 'Message sent!' });

    // Presence check
    if (!name || !email || !subject || !message) {
      return res.status(400).json({ message: 'Please fill in all required fields.' });
    }

    const cleanName    = validator.escape(name.trim());
    const cleanEmail   = email.trim().toLowerCase();
    const cleanSubject = validator.escape(subject.trim());
    const cleanMessage = validator.escape(message.trim());

    // Validation
    if (cleanName.length    < 2   || cleanName.length    > 100) return res.status(400).json({ message: 'Invalid name.' });
    if (!validator.isEmail(cleanEmail))                          return res.status(400).json({ message: 'Invalid email address.' });
    if (cleanSubject.length < 3   || cleanSubject.length > 150) return res.status(400).json({ message: 'Invalid subject.' });
    if (cleanMessage.length < 10  || cleanMessage.length > 2000)return res.status(400).json({ message: 'Message must be 10–2000 characters.' });

    const ip = req.ip || req.headers['x-forwarded-for'] || '';

    // Save to DB
    await ContactMessage.create({
      name:    cleanName,
      email:   cleanEmail,
      subject: cleanSubject,
      message: cleanMessage,
      ip,
    });

    // Send email notification
    await resend.emails.send({
      from:    'Portfolio Contact <onboarding@resend.dev>',
      to:      process.env.CONTACT_EMAIL,
      replyTo: cleanEmail,
      subject: `New message: ${cleanSubject}`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:auto;padding:32px;background:#f5f3ff;border-radius:12px">
          <h2 style="color:#7C3AED;margin-bottom:24px">New Portfolio Message</h2>
          <table style="width:100%;border-collapse:collapse">
            <tr>
              <td style="padding:10px 0;color:#6b7280;font-size:14px;width:80px">From</td>
              <td style="padding:10px 0;font-weight:600">${cleanName}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;color:#6b7280;font-size:14px">Email</td>
              <td style="padding:10px 0"><a href="mailto:${cleanEmail}" style="color:#7C3AED">${cleanEmail}</a></td>
            </tr>
            <tr>
              <td style="padding:10px 0;color:#6b7280;font-size:14px">Subject</td>
              <td style="padding:10px 0">${cleanSubject}</td>
            </tr>
          </table>
          <div style="margin-top:24px;padding:20px;background:#fff;border-radius:8px;border-left:4px solid #7C3AED">
            <p style="color:#1E1B4B;line-height:1.7;margin:0">${cleanMessage.replace(/\n/g, '<br>')}</p>
          </div>
          <p style="margin-top:24px;font-size:12px;color:#9ca3af">
            Reply directly to this email to respond to ${cleanName}.
          </p>
        </div>
      `,
    });

    res.json({ message: "Message sent! I'll get back to you soon." });

  } catch (err) {
    console.error('[API] POST /contact:', err.message);
    res.status(500).json({ message: 'Could not send your message. Please try again.' });
  }
});

module.exports = router;