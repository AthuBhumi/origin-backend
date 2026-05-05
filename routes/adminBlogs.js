const express = require('express');
const db = require('../config/database');
const verifyAdmin = require('../middleware/adminAuth');
const upload = require('../middleware/upload');

const router = express.Router();

// Get all blogs
router.get('/', verifyAdmin, (req, res) => {
  db.all('SELECT * FROM blogs ORDER BY created_at DESC', (err, blogs) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json({ success: true, blogs });
  });
});

// Get single blog
router.get('/:id', verifyAdmin, (req, res) => {
  db.get('SELECT * FROM blogs WHERE id = ?', [req.params.id], (err, blog) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!blog) return res.status(404).json({ error: 'Blog not found' });
    res.json({ success: true, blog });
  });
});

// Create blog
router.post('/', verifyAdmin, (req, res, next) => {
  upload.single('cover_image')(req, res, (err) => {
    if (err) {
      console.error('Upload error:', err.message);
      return res.status(400).json({ error: err.message });
    }
    next();
  });
}, (req, res) => {
  const { title, content, excerpt, category, tags, status } = req.body;
  const cover_image = req.file ? `/uploads/${req.file.filename}` : null;
  const baseSlug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const slug = baseSlug + '-' + Date.now();

  db.run(
    'INSERT INTO blogs (title, slug, content, excerpt, cover_image, category, tags, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [title, slug, content, excerpt, cover_image, category || null, tags, status || 'draft'],
    function(err) {
      if (err) {
        console.error('Blog create error:', err.message);
        return res.status(500).json({ error: err.message });
      }
      res.json({ success: true, id: this.lastID, message: 'Blog created' });
    }
  );
});

// Update blog
router.put('/:id', verifyAdmin, (req, res, next) => {
  upload.single('cover_image')(req, res, (err) => {
    if (err) {
      console.error('Upload error:', err.message);
      return res.status(400).json({ error: err.message });
    }
    next();
  });
}, (req, res) => {
  const { title, content, excerpt, category, tags, status } = req.body;
  const cover_image = req.file ? `/uploads/${req.file.filename}` : null;
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  let query = 'UPDATE blogs SET title=?, slug=?, content=?, excerpt=?, category=?, tags=?, status=?, updated_at=CURRENT_TIMESTAMP';
  let params = [title, slug, content, excerpt, category, tags, status || 'draft'];

  if (cover_image) {
    query += ', cover_image=?';
    params.push(cover_image);
  }

  query += ' WHERE id=?';
  params.push(req.params.id);

  db.run(query, params, function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Blog not found' });
    res.json({ success: true, message: 'Blog updated' });
  });
});

// Delete blog
router.delete('/:id', verifyAdmin, (req, res) => {
  db.run('DELETE FROM blogs WHERE id = ?', [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (this.changes === 0) return res.status(404).json({ error: 'Blog not found' });
    res.json({ success: true, message: 'Blog deleted' });
  });
});

module.exports = router;