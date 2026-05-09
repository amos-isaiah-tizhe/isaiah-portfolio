// routes/admin.js
// Admin CMS API — authentication + project management

'use strict';

const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const validator = require('validator');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

const Project = require('../models/Project');
const ContactMessage = require('../models/ContactMessage');

// ── Cloudinary config ─────────────────────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ── Multer — Cloudinary storage ───────────────
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'isaiah-portfolio',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [
      {
        width: 1200,
        crop: 'limit',
        quality: 'auto',
      },
    ],
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 3 * 1024 * 1024,
  },

  fileFilter(_req, file, cb) {
    const allowed = [
      'image/jpeg',
      'image/png',
      'image/webp',
    ];

    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          'Only JPEG, PNG, and WebP images are allowed.'
        )
      );
    }
  },
});

// ── Auth middleware ───────────────────────────
function requireAuth(req, res, next) {
  if (req.session && req.session.adminId) {
    return next();
  }

  return res.status(401).json({
    message: 'Unauthorised. Please log in.',
  });
}

// ── Login rate limiter ────────────────────────
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,

  message: {
    message:
      'Too many login attempts. Please wait 15 minutes and try again.',
  },

  standardHeaders: true,
  legacyHeaders: false,
});

// ════════════════════════════════════════════
// AUTH ROUTES
// ════════════════════════════════════════════

// POST /admin/login
router.post('/login', loginLimiter, (req, res) => {
  const {
    username,
    password,
    _honey,
  } = req.body;

  // Honeypot
  if (_honey) {
    return res.json({
      redirect: '/admin/dashboard',
    });
  }

  // Validation
  if (!username || !password) {
    return res.status(400).json({
      message: 'Username and password are required.',
    });
  }

  if (
    typeof username !== 'string' ||
    username.length > 60
  ) {
    return res.status(400).json({
      message: 'Invalid credentials.',
    });
  }

  if (
    typeof password !== 'string' ||
    password.length > 128
  ) {
    return res.status(400).json({
      message: 'Invalid credentials.',
    });
  }

  const expectedUsername =
    process.env.ADMIN_USERNAME;

  const expectedPassword =
    process.env.ADMIN_PASSWORD;

  const userMatch =
    username === expectedUsername;

  const passMatch =
    password === expectedPassword;

  if (!userMatch || !passMatch) {
    return setTimeout(() => {
      res.status(401).json({
        message:
          'Invalid username or password.',
      });
    }, 400);
  }

  // Regenerate session
  req.session.regenerate((err) => {
    if (err) {
      return res.status(500).json({
        message:
          'Session error. Try again.',
      });
    }

    req.session.adminId = 'admin';
    req.session.username = expectedUsername;

    res.json({
      redirect: '/admin/dashboard',
    });
  });
});

// POST /admin/logout
router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('sid');

    res.json({
      message: 'Logged out.',
    });
  });
});

// GET /admin/me
router.get('/me', requireAuth, (req, res) => {
  res.json({
    username: req.session.username,
  });
});

// ════════════════════════════════════════════
// PROJECT CRUD
// ════════════════════════════════════════════

// GET /admin/api/projects
router.get(
  '/api/projects',
  requireAuth,
  async (_req, res) => {
    try {
      const projects = await Project.find({})
        .sort({ createdAt: -1 })
        .lean();

      res.json({ projects });
    } catch (err) {
      console.error(
        '[ADMIN] GET /api/projects:',
        err.message
      );

      res.status(500).json({
        message: 'Could not load projects.',
      });
    }
  }
);

// POST /admin/api/projects
router.post(
  '/api/projects',
  requireAuth,
  upload.single('image'),
  async (req, res) => {
    try {
      const {
        title,
        description,
        category,
        liveUrl,
      } = req.body;

      if (!title || !description) {
        if (req.file) {
          await cloudinary.uploader.destroy(
            req.file.filename
          );
        }

        return res.status(400).json({
          message:
            'Title and description are required.',
        });
      }

      if (!req.file) {
        return res.status(400).json({
          message: 'An image is required.',
        });
      }

      const cleanTitle = validator
        .escape(title.trim())
        .substring(0, 120);

      const cleanDescription = validator
        .escape(description.trim())
        .substring(0, 400);

      const cleanCategory = category || '';

      const cleanLiveUrl = liveUrl
        ? liveUrl.trim()
        : '';

      if (
        cleanLiveUrl &&
        !validator.isURL(cleanLiveUrl, {
          protocols: ['http', 'https'],
          require_protocol: true,
        })
      ) {
        await cloudinary.uploader.destroy(
          req.file.filename
        );

        return res.status(400).json({
          message: 'Invalid Live URL.',
        });
      }

      const project = await Project.create({
        title: cleanTitle,
        description: cleanDescription,
        category: cleanCategory,
        liveUrl: cleanLiveUrl,
        imageUrl: req.file.path,
        imageFilename: req.file.filename,
      });

      res.status(201).json({
        message: 'Project created.',
        project,
      });
    } catch (err) {
      if (req.file) {
        await cloudinary.uploader.destroy(
          req.file.filename
        );
      }

      console.error(
        '[ADMIN] POST /api/projects:',
        err.message
      );

      res.status(500).json({
        message: 'Could not create project.',
      });
    }
  }
);

// PUT /admin/api/projects/:id
router.put(
  '/api/projects/:id',
  requireAuth,
  upload.single('image'),
  async (req, res) => {
    try {
      const { id } = req.params;

      if (!id.match(/^[a-f\d]{24}$/i)) {
        if (req.file) {
          await cloudinary.uploader.destroy(
            req.file.filename
          );
        }

        return res.status(400).json({
          message: 'Invalid project ID.',
        });
      }

      const project = await Project.findById(id);

      if (!project) {
        if (req.file) {
          await cloudinary.uploader.destroy(
            req.file.filename
          );
        }

        return res.status(404).json({
          message: 'Project not found.',
        });
      }

      const {
        title,
        description,
        category,
        liveUrl,
      } = req.body;

      if (!title || !description) {
        if (req.file) {
          await cloudinary.uploader.destroy(
            req.file.filename
          );
        }

        return res.status(400).json({
          message:
            'Title and description are required.',
        });
      }

      project.title = validator
        .escape(title.trim())
        .substring(0, 120);

      project.description = validator
        .escape(description.trim())
        .substring(0, 400);

      project.category = category || '';

      const cleanLiveUrl = liveUrl
        ? liveUrl.trim()
        : '';

      if (
        cleanLiveUrl &&
        !validator.isURL(cleanLiveUrl, {
          protocols: ['http', 'https'],
          require_protocol: true,
        })
      ) {
        if (req.file) {
          await cloudinary.uploader.destroy(
            req.file.filename
          );
        }

        return res.status(400).json({
          message: 'Invalid Live URL.',
        });
      }

      project.liveUrl = cleanLiveUrl;

      // Replace image
      if (req.file) {

        // Delete old image
        if (project.imageFilename) {
          await cloudinary.uploader.destroy(
            project.imageFilename
          );
        }

        project.imageUrl = req.file.path;
        project.imageFilename =
          req.file.filename;
      }

      await project.save();

      res.json({
        message: 'Project updated.',
        project,
      });
    } catch (err) {
      if (req.file) {
        await cloudinary.uploader.destroy(
          req.file.filename
        );
      }

      console.error(
        '[ADMIN] PUT /api/projects:',
        err.message
      );

      res.status(500).json({
        message: 'Could not update project.',
      });
    }
  }
);

// DELETE /admin/api/projects/:id
router.delete(
  '/api/projects/:id',
  requireAuth,
  async (req, res) => {
    try {
      const { id } = req.params;

      if (!id.match(/^[a-f\d]{24}$/i)) {
        return res.status(400).json({
          message: 'Invalid project ID.',
        });
      }

      const project =
        await Project.findByIdAndDelete(id);

      if (!project) {
        return res.status(404).json({
          message: 'Project not found.',
        });
      }

      // Delete image from Cloudinary
      if (project.imageFilename) {
        await cloudinary.uploader.destroy(
          project.imageFilename
        );
      }

      res.json({
        message: 'Project deleted.',
      });
    } catch (err) {
      console.error(
        '[ADMIN] DELETE /api/projects:',
        err.message
      );

      res.status(500).json({
        message: 'Could not delete project.',
      });
    }
  }
);

// ════════════════════════════════════════════
// CONTACT MESSAGES
// ════════════════════════════════════════════

// GET /admin/api/messages
router.get(
  '/api/messages',
  requireAuth,
  async (_req, res) => {
    try {
      const messages =
        await ContactMessage.find({})
          .sort({ createdAt: -1 })
          .lean();

      res.json({ messages });
    } catch (err) {
      console.error(
        '[ADMIN] GET /api/messages:',
        err.message
      );

      res.status(500).json({
        message: 'Could not load messages.',
      });
    }
  }
);

// ════════════════════════════════════════════
// MULTER ERROR HANDLER
// ════════════════════════════════════════════

router.use((err, req, res, next) => {

  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      message: 'Image must be under 3 MB.',
    });
  }

  if (
    err.message &&
    err.message.includes('Only JPEG')
  ) {
    return res.status(400).json({
      message: err.message,
    });
  }

  next(err);
});

module.exports = router;