const express = require('express');
const db = require('../config/database');
const verifyAdmin = require('../middleware/adminAuth');

const router = express.Router();

// Public: Sign up for free trial
router.post('/', (req, res) => {
  const { product_id, name, email, phone, company } = req.body;

  if (!product_id || !name || !email) {
    return res.status(400).json({ error: 'Product, name and email are required' });
  }

  // Check if product exists and has trial
  db.get('SELECT * FROM products WHERE id = ? AND status = ?', [product_id, 'active'], (err, product) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!product) return res.status(404).json({ error: 'Product not found' });
    if (!product.trial_days || product.trial_days <= 0) {
      return res.status(400).json({ error: 'This product does not offer a free trial' });
    }

    // Check if already signed up
    db.get('SELECT * FROM trial_signups WHERE product_id = ? AND email = ?', [product_id, email], (err, existing) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      if (existing) {
        return res.status(400).json({ error: 'You have already signed up for this trial', trial: existing });
      }

      // Calculate expiry date
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + product.trial_days);

      db.run(
        'INSERT INTO trial_signups (product_id, name, email, phone, company, expires_at) VALUES (?, ?, ?, ?, ?, ?)',
        [product_id, name, email, phone || null, company || null, expiresAt.toISOString()],
        function(err) {
          if (err) return res.status(500).json({ error: 'Failed to create trial signup' });
          res.json({
            success: true,
            message: `Your ${product.trial_days}-day free trial has started!`,
            trial: {
              id: this.lastID,
              product_name: product.name,
              trial_days: product.trial_days,
              trial_url: product.trial_url,
              expires_at: expiresAt.toISOString()
            }
          });
        }
      );
    });
  });
});

// Admin: Get all trial signups
router.get('/', verifyAdmin, (req, res) => {
  db.all(`
    SELECT ts.*, p.name as product_name 
    FROM trial_signups ts 
    LEFT JOIN products p ON ts.product_id = p.id 
    ORDER BY ts.created_at DESC
  `, (err, signups) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json({ success: true, signups });
  });
});

// Admin: Get trial signup stats
router.get('/stats', verifyAdmin, (req, res) => {
  db.get('SELECT COUNT(*) as total FROM trial_signups', (err, row) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    db.get("SELECT COUNT(*) as active FROM trial_signups WHERE expires_at > datetime('now')", (err2, row2) => {
      res.json({
        success: true,
        total: row.total,
        active: row2 ? row2.active : 0
      });
    });
  });
});

// Admin: Delete trial signup
router.delete('/:id', verifyAdmin, (req, res) => {
  db.run('DELETE FROM trial_signups WHERE id = ?', [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (this.changes === 0) return res.status(404).json({ error: 'Signup not found' });
    res.json({ success: true, message: 'Trial signup deleted' });
  });
});

module.exports = router;
