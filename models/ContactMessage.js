// models/ContactMessage.js

'use strict';

const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema(
  {
    name: {
      type:      String,
      required:  true,
      trim:      true,
      maxlength: 100,
    },
    email: {
      type:      String,
      required:  true,
      trim:      true,
      lowercase: true,
      maxlength: 254,
    },
    subject: {
      type:      String,
      required:  true,
      trim:      true,
      maxlength: 150,
    },
    message: {
      type:      String,
      required:  true,
      trim:      true,
      maxlength: 2000,
    },
    ip: {
      type:    String,
      default: '',
    },
    read: {
      type:    Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('ContactMessage', contactSchema);
