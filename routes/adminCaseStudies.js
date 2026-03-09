const express = require('express');
const db = require('../config/database');
const verifyAdmin = require('../middleware/adminAuth');
const upload = require('../middleware/upload');

const router = express.Router();

// Get all case studies
router.get('/', verifyAdmin, (req, res) => {
  db.all('SELECT * FROM case_studies ORDER BY created_at DESC', (err, caseStudies) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json({ success: true, caseStudies });
  });
});

// Get single case study
router.get('/:id', verifyAdmin, (req, res) => {
  db.get('SELECT * FROM case_studies WHERE id = ?', [req.params.id], (err, caseStudy) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!caseStudy) return res.status(404).json({ error: 'Case study not found' });
    res.json({ success: true, caseStudy });
  });
});

// Create case study
router.post('/', verifyAdmin, upload.single('cover_image'), (req, res) => {
  const { title, client_name, industry, challenge, solution, results, technologies, testimonial, status } = req.body;
  const cover_image = req.file ? `/uploads/${req.file.filename}` : null;
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  db.run(
    'INSERT INTO case_studies (title, slug, client_name, industry, challenge, solution, results, cover_image, technologies, testimonial, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [title, slug, client_name, industry, challenge, solution, results, cover_image, technologies, testimonial, status || 'draft'],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, id: this.lastID, message: 'Case study created' });
    }
  );
});

// Update case study
router.put('/:id', verifyAdmin, upload.single('cover_image'), (req, res) => {
  const { title, client_name, industry, challenge, solution, results, technologies, testimonial, status } = req.body;
  const cover_image = req.file ? `/uploads/${req.file.filename}` : null;
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  let query = 'UPDATE case_studies SET title=?, slug=?, client_name=?, industry=?, challenge=?, solution=?, results=?, technologies=?, testimonial=?, status=?, updated_at=CURRENT_TIMESTAMP';
  let params = [title, slug, client_name, industry, challenge, solution, results, technologies, testimonial, status || 'draft'];

  if (cover_image) {
    query += ', cover_image=?';
    params.push(cover_image);
  }

  query += ' WHERE id=?';
  params.push(req.params.id);

  db.run(query, params, function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Case study not found' });
    res.json({ success: true, message: 'Case study updated' });
  });
});

// Delete case study
router.delete('/:id', verifyAdmin, (req, res) => {
  db.run('DELETE FROM case_studies WHERE id = ?', [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (this.changes === 0) return res.status(404).json({ error: 'Case study not found' });
    res.json({ success: true, message: 'Case study deleted' });
  });
});

module.exports = router;