const express = require('express');
const db = require('../config/database');
const verifyAdmin = require('../middleware/adminAuth');

const router = express.Router();

// Get all enquiries
router.get('/', verifyAdmin, (req, res) => {
  db.all('SELECT * FROM enquiries ORDER BY created_at DESC', (err, enquiries) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json({ success: true, enquiries });
  });
});

// Get single enquiry
router.get('/:id', verifyAdmin, (req, res) => {
  db.get('SELECT * FROM enquiries WHERE id = ?', [req.params.id], (err, enquiry) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!enquiry) return res.status(404).json({ error: 'Enquiry not found' });
    res.json({ success: true, enquiry });
  });
});

// Mark enquiry as read
router.put('/:id/read', verifyAdmin, (req, res) => {
  db.run('UPDATE enquiries SET is_read = 1, status = "read", updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [req.params.id], function(err) {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json({ success: true, message: 'Enquiry marked as read' });
    });
});

// Delete enquiry
router.delete('/:id', verifyAdmin, (req, res) => {
  db.run('DELETE FROM enquiries WHERE id = ?', [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (this.changes === 0) return res.status(404).json({ error: 'Enquiry not found' });
    res.json({ success: true, message: 'Enquiry deleted' });
  });
});

module.exports = router;