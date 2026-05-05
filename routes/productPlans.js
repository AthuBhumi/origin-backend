const express = require('express');
const router = express.Router();
const db = require('../config/database');
const verifyAdmin = require('../middleware/adminAuth');

// ========================
// PUBLIC ROUTES
// ========================

// Get plans for a product (public)
router.get('/product/:productId', (req, res) => {
  db.all(
    'SELECT * FROM product_plans WHERE product_id = ? AND status = ? ORDER BY sort_order ASC, price ASC',
    [req.params.productId, 'active'],
    (err, plans) => {
      if (err) return res.status(500).json({ success: false, message: 'Database error' });
      // Parse features and limits from JSON strings
      const parsed = plans.map(p => ({
        ...p,
        features: p.features ? JSON.parse(p.features) : [],
        limits: p.limits ? JSON.parse(p.limits) : {}
      }));
      res.json({ success: true, plans: parsed });
    }
  );
});

// ========================
// ADMIN ROUTES
// ========================

// Get all plans for a product (admin)
router.get('/admin/product/:productId', verifyAdmin, (req, res) => {
  db.all(
    'SELECT * FROM product_plans WHERE product_id = ? ORDER BY sort_order ASC, price ASC',
    [req.params.productId],
    (err, plans) => {
      if (err) return res.status(500).json({ success: false, message: 'Database error' });
      const parsed = plans.map(p => ({
        ...p,
        features: p.features ? JSON.parse(p.features) : [],
        limits: p.limits ? JSON.parse(p.limits) : {}
      }));
      res.json({ success: true, plans: parsed });
    }
  );
});

// Create a plan
router.post('/', verifyAdmin, (req, res) => {
  const { product_id, name, price, billing_cycle, description, features, limits, is_popular, sort_order, cta_text, cta_url, status } = req.body;

  if (!product_id || !name) {
    return res.status(400).json({ success: false, message: 'product_id and name are required' });
  }

  db.run(
    `INSERT INTO product_plans (product_id, name, price, billing_cycle, description, features, limits, is_popular, sort_order, cta_text, cta_url, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      product_id, name, price || 0, billing_cycle || 'monthly',
      description || '', JSON.stringify(features || []), JSON.stringify(limits || {}),
      is_popular ? 1 : 0, sort_order || 0, cta_text || 'Get Started', cta_url || '', status || 'active'
    ],
    function (err) {
      if (err) return res.status(500).json({ success: false, message: 'Database error' });
      res.json({ success: true, id: this.lastID, message: 'Plan created' });
    }
  );
});

// Update a plan
router.put('/:id', verifyAdmin, (req, res) => {
  const { name, price, billing_cycle, description, features, limits, is_popular, sort_order, cta_text, cta_url, status } = req.body;

  db.run(
    `UPDATE product_plans SET name=?, price=?, billing_cycle=?, description=?, features=?, limits=?, is_popular=?, sort_order=?, cta_text=?, cta_url=?, status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
    [
      name, price || 0, billing_cycle || 'monthly',
      description || '', JSON.stringify(features || []), JSON.stringify(limits || {}),
      is_popular ? 1 : 0, sort_order || 0, cta_text || 'Get Started', cta_url || '', status || 'active',
      req.params.id
    ],
    function (err) {
      if (err) return res.status(500).json({ success: false, message: 'Database error' });
      if (this.changes === 0) return res.status(404).json({ success: false, message: 'Plan not found' });
      res.json({ success: true, message: 'Plan updated' });
    }
  );
});

// Delete a plan
router.delete('/:id', verifyAdmin, (req, res) => {
  db.run('DELETE FROM product_plans WHERE id = ?', [req.params.id], function (err) {
    if (err) return res.status(500).json({ success: false, message: 'Database error' });
    if (this.changes === 0) return res.status(404).json({ success: false, message: 'Plan not found' });
    res.json({ success: true, message: 'Plan deleted' });
  });
});

module.exports = router;
