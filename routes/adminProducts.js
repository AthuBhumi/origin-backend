const express = require('express');
const db = require('../config/database');
const verifyAdmin = require('../middleware/adminAuth');
const upload = require('../middleware/upload');

const router = express.Router();

// Get all products
router.get('/', verifyAdmin, (req, res) => {
  db.all(`SELECT p.*, GROUP_CONCAT(pi.image_url) as images 
    FROM products p LEFT JOIN product_images pi ON p.id = pi.product_id 
    GROUP BY p.id ORDER BY p.created_at DESC`, (err, products) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json({ success: true, products });
  });
});

// Get single product
router.get('/:id', verifyAdmin, (req, res) => {
  db.get('SELECT * FROM products WHERE id = ?', [req.params.id], (err, product) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!product) return res.status(404).json({ error: 'Product not found' });

    db.all('SELECT * FROM product_images WHERE product_id = ?', [req.params.id], (err, images) => {
      res.json({ success: true, product: { ...product, images: images || [] } });
    });
  });
});

// Create product
router.post('/', verifyAdmin, upload.single('image'), (req, res) => {
  const { name, description, price, category, features, status } = req.body;
  const image = req.file ? `/uploads/${req.file.filename}` : null;

  db.run(
    'INSERT INTO products (name, description, price, category, features, image, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [name, description, price, category, features, image, status || 'active'],
    function(err) {
      if (err) return res.status(500).json({ error: 'Database error' });

      if (image) {
        db.run('INSERT INTO product_images (product_id, image_url, is_primary) VALUES (?, ?, 1)',
          [this.lastID, image]);
      }

      res.json({ success: true, id: this.lastID, message: 'Product created' });
    }
  );
});

// Update product
router.put('/:id', verifyAdmin, upload.single('image'), (req, res) => {
  const { name, description, price, category, features, status } = req.body;
  const image = req.file ? `/uploads/${req.file.filename}` : null;

  let query = 'UPDATE products SET name=?, description=?, price=?, category=?, features=?, status=?, updated_at=CURRENT_TIMESTAMP';
  let params = [name, description, price, category, features, status || 'active'];

  if (image) {
    query += ', image=?';
    params.push(image);
  }

  query += ' WHERE id=?';
  params.push(req.params.id);

  db.run(query, params, function(err) {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (this.changes === 0) return res.status(404).json({ error: 'Product not found' });
    res.json({ success: true, message: 'Product updated' });
  });
});

// Delete product
router.delete('/:id', verifyAdmin, (req, res) => {
  db.run('DELETE FROM product_images WHERE product_id = ?', [req.params.id]);
  db.run('DELETE FROM products WHERE id = ?', [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (this.changes === 0) return res.status(404).json({ error: 'Product not found' });
    res.json({ success: true, message: 'Product deleted' });
  });
});

module.exports = router;