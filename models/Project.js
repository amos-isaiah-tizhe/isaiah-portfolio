// models/Project.js

'use strict';

const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema(
  {
    title: {
      type:      String,
      required:  [true, 'Title is required'],
      trim:      true,
      maxlength: [120, 'Title cannot exceed 120 characters'],
    },
    description: {
      type:      String,
      required:  [true, 'Description is required'],
      trim:      true,
      maxlength: [400, 'Description cannot exceed 400 characters'],
    },
    category: {
      type:    String,
      trim:    true,
      default: '',
      enum: {
        values:  ['Landing Page','E-Commerce','Blog','WordPress','Graphic Design','Classified Ads','Real Estate','Tools','Other',''],
        message: 'Invalid category',
      },
    },
    imageUrl: {
      type:     String,
      required: [true, 'Image URL is required'],
    },
    imageFilename: {
      type:    String,
      default: '',
    },
    liveUrl: {
      type:    String,
      trim:    true,
      default: '',
      validate: {
        validator(v) {
          if (!v) return true;
          return /^https?:\/\/.+/.test(v);
        },
        message: 'Live URL must start with http:// or https://',
      },
    },
    order: {
      type:    Number,
      default: 0,
    },
  },
  {
    timestamps: true,     // adds createdAt and updatedAt
  }
);

module.exports = mongoose.model('Project', projectSchema);
