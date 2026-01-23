const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const upload = require('../middleware/upload');
const fs = require('fs');
const path = require('path');

// @route   GET /api/products
// @desc    Get all products (public)
// @access  Public
router.get('/', (req, res) => {
  const { category, status, search } = req.query;
  let query = `
    SELECT p.*, GROUP_CONCAT(pi.image_url) as images
    FROM products p
    LEFT JOIN product_images pi ON p.id = pi.product_id
    WHERE 1=1
  `;
  const params = [];

  if (category) {
    query += ' AND p.category = ?';
    params.push(category);
  }

  if (status) {
    query += ' AND p.status = ?';
    params.push(status);
  } else {
    // By default, show only active products for public
    query += ' AND p.status = ?';
    params.push('active');
  }

  if (search) {
    query += ' AND (p.name LIKE ? OR p.description LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }

  query += ' GROUP BY p.id ORDER BY p.created_at DESC';

  db.all(query, params, (err, products) => {
    if (err) {
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to fetch products' 
      });
    }

    // Parse images
    const productsWithImages = products.map(product => ({
      ...product,
      images: product.images ? product.images.split(',') : []
    }));

    res.json({
      success: true,
      count: productsWithImages.length,
      products: productsWithImages
    });
  });
});

// @route   GET /api/products/:id
// @desc    Get single product
// @access  Public
router.get('/:id', (req, res) => {
  const productId = req.params.id;

  db.get(
    'SELECT * FROM products WHERE id = ?',
    [productId],
    (err, product) => {
      if (err) {
        return res.status(500).json({ 
          success: false, 
          message: 'Server error' 
        });
      }

      if (!product) {
        return res.status(404).json({ 
          success: false, 
          message: 'Product not found' 
        });
      }

      // Get product images
      db.all(
        'SELECT * FROM product_images WHERE product_id = ?',
        [productId],
        (err, images) => {
          if (err) {
            return res.status(500).json({ 
              success: false, 
              message: 'Server error' 
            });
          }

          res.json({
            success: true,
            product: {
              ...product,
              images: images.map(img => img.image_url)
            }
          });
        }
      );
    }
  );
});

// @route   POST /api/products
// @desc    Create new product
// @access  Private (Admin only)
router.post('/', upload.array('images', 5), [
  body('name').notEmpty().withMessage('Product name is required'),
  body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  body('category').notEmpty().withMessage('Category is required')
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      success: false, 
      errors: errors.array() 
    });
  }

  const { name, description, price, category, features, status } = req.body;
  const images = req.files || [];

  // Insert product
  db.run(
    `INSERT INTO products (name, description, price, category, features, status) 
     VALUES (?, ?, ?, ?, ?, ?)`,
    [name, description, price, category, features, status || 'active'],
    function(err) {
      if (err) {
        return res.status(500).json({ 
          success: false, 
          message: 'Failed to create product' 
        });
      }

      const productId = this.lastID;

      // Insert images
      if (images.length > 0) {
        const imageInserts = images.map((file, index) => {
          return new Promise((resolve, reject) => {
            const imageUrl = `/uploads/${file.filename}`;
            db.run(
              'INSERT INTO product_images (product_id, image_url, is_primary) VALUES (?, ?, ?)',
              [productId, imageUrl, index === 0 ? 1 : 0],
              (err) => {
                if (err) reject(err);
                else resolve();
              }
            );
          });
        });

        Promise.all(imageInserts)
          .then(() => {
            res.status(201).json({
              success: true,
              message: 'Product created successfully',
              productId
            });
          })
          .catch(err => {
            res.status(500).json({ 
              success: false, 
              message: 'Product created but failed to save images' 
            });
          });
      } else {
        res.status(201).json({
          success: true,
          message: 'Product created successfully',
          productId
        });
      }
    }
  );
});

// @route   PUT /api/products/:id
// @desc    Update product
// @access  Private (Admin only)
router.put('/:id', upload.array('images', 5), (req, res) => {
  const productId = req.params.id;
  const { name, description, price, category, features, status } = req.body;
  const images = req.files || [];

  db.run(
    `UPDATE products 
     SET name = ?, description = ?, price = ?, category = ?, features = ?, status = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [name, description, price, category, features, status, productId],
    function(err) {
      if (err) {
        return res.status(500).json({ 
          success: false, 
          message: 'Failed to update product' 
        });
      }

      if (this.changes === 0) {
        return res.status(404).json({ 
          success: false, 
          message: 'Product not found' 
        });
      }

      // Add new images if provided
      if (images.length > 0) {
        const imageInserts = images.map((file) => {
          return new Promise((resolve, reject) => {
            const imageUrl = `/uploads/${file.filename}`;
            db.run(
              'INSERT INTO product_images (product_id, image_url, is_primary) VALUES (?, ?, ?)',
              [productId, imageUrl, 0],
              (err) => {
                if (err) reject(err);
                else resolve();
              }
            );
          });
        });

        Promise.all(imageInserts)
          .then(() => {
            res.json({
              success: true,
              message: 'Product updated successfully'
            });
          })
          .catch(err => {
            res.json({ 
              success: true, 
              message: 'Product updated but some images failed to upload' 
            });
          });
      } else {
        res.json({
          success: true,
          message: 'Product updated successfully'
        });
      }
    }
  );
});

// @route   DELETE /api/products/:id
// @desc    Delete product
// @access  Private (Admin only)
router.delete('/:id', (req, res) => {
  const productId = req.params.id;

  // Get product images first
  db.all(
    'SELECT image_url FROM product_images WHERE product_id = ?',
    [productId],
    (err, images) => {
      // Delete product (cascade will delete images from DB)
      db.run(
        'DELETE FROM products WHERE id = ?',
        [productId],
        function(err) {
          if (err) {
            return res.status(500).json({ 
              success: false, 
              message: 'Failed to delete product' 
            });
          }

          if (this.changes === 0) {
            return res.status(404).json({ 
              success: false, 
              message: 'Product not found' 
            });
          }

          // Delete image files from disk
          if (images && images.length > 0) {
            images.forEach(img => {
              const filePath = path.join(__dirname, '..', img.image_url);
              fs.unlink(filePath, (err) => {
                if (err) console.error('Failed to delete image file:', err);
              });
            });
          }

          res.json({
            success: true,
            message: 'Product deleted successfully'
          });
        }
      );
    }
  );
});

// @route   DELETE /api/products/:productId/images/:imageId
// @desc    Delete product image
// @access  Private (Admin only)
router.delete('/:productId/images/:imageId', (req, res) => {
  const { imageId } = req.params;

  // Get image URL first
  db.get(
    'SELECT image_url FROM product_images WHERE id = ?',
    [imageId],
    (err, image) => {
      if (err || !image) {
        return res.status(404).json({ 
          success: false, 
          message: 'Image not found' 
        });
      }

      // Delete from database
      db.run(
        'DELETE FROM product_images WHERE id = ?',
        [imageId],
        function(err) {
          if (err) {
            return res.status(500).json({ 
              success: false, 
              message: 'Failed to delete image' 
            });
          }

          // Delete file from disk
          const filePath = path.join(__dirname, '..', image.image_url);
          fs.unlink(filePath, (err) => {
            if (err) console.error('Failed to delete image file:', err);
          });

          res.json({
            success: true,
            message: 'Image deleted successfully'
          });
        }
      );
    }
  );
});

module.exports = router;
