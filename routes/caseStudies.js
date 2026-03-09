const express = require('express');
const db = require('../config/database');

const router = express.Router();

// Get all published case studies (public)
router.get('/', (req, res) => {
  db.all('SELECT * FROM case_studies WHERE status = "published" ORDER BY created_at DESC', (err, caseStudies) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json({ success: true, caseStudies });
  });
});

// Get single case study by slug (public)
router.get('/:slug', (req, res) => {
  db.get('SELECT * FROM case_studies WHERE slug = ? AND status = "published"', [req.params.slug], (err, caseStudy) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!caseStudy) return res.status(404).json({ error: 'Case study not found' });
    res.json({ success: true, caseStudy });
  });
});

module.exports = router;