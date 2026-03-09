const express = require('express');
const db = require('../config/database');

const router = express.Router();

// Get all published blogs (public)
router.get('/', (req, res) => {
  db.all('SELECT * FROM blogs WHERE status = "published" ORDER BY created_at DESC', (err, blogs) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json({ success: true, blogs });
  });
});

// Get single blog by slug (public)
router.get('/:slug', (req, res) => {
  db.get('SELECT * FROM blogs WHERE slug = ? AND status = "published"', [req.params.slug], (err, blog) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!blog) return res.status(404).json({ error: 'Blog not found' });
    res.json({ success: true, blog });
  });
});

module.exports = router;