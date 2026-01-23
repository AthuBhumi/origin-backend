const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const db = require('../config/database');

// @route   GET /api/enquiries
// @desc    Get all enquiries (Admin only)
// @access  Private
router.get('/', (req, res) => {
  const { status, search } = req.query;
  let query = 'SELECT * FROM enquiries WHERE 1=1';
  const params = [];

  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }

  if (search) {
    query += ' AND (name LIKE ? OR email LIKE ? OR phone LIKE ? OR message LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }

  query += ' ORDER BY created_at DESC';

  db.all(query, params, (err, enquiries) => {
    if (err) {
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to fetch enquiries' 
      });
    }

    res.json({
      success: true,
      count: enquiries.length,
      enquiries
    });
  });
});

// @route   GET /api/enquiries/stats
// @desc    Get enquiry statistics
// @access  Private
router.get('/stats', (req, res) => {
  const queries = {
    total: 'SELECT COUNT(*) as count FROM enquiries',
    new: "SELECT COUNT(*) as count FROM enquiries WHERE status = 'new'",
    inProgress: "SELECT COUNT(*) as count FROM enquiries WHERE status = 'in-progress'",
    resolved: "SELECT COUNT(*) as count FROM enquiries WHERE status = 'resolved'"
  };

  const stats = {};

  db.get(queries.total, [], (err, row) => {
    stats.total = row ? row.count : 0;
    
    db.get(queries.new, [], (err, row) => {
      stats.new = row ? row.count : 0;
      
      db.get(queries.inProgress, [], (err, row) => {
        stats.inProgress = row ? row.count : 0;
        
        db.get(queries.resolved, [], (err, row) => {
          stats.resolved = row ? row.count : 0;
          
          res.json({
            success: true,
            stats
          });
        });
      });
    });
  });
});

// @route   GET /api/enquiries/:id
// @desc    Get single enquiry
// @access  Private
router.get('/:id', (req, res) => {
  const enquiryId = req.params.id;

  db.get(
    'SELECT * FROM enquiries WHERE id = ?',
    [enquiryId],
    (err, enquiry) => {
      if (err) {
        return res.status(500).json({ 
          success: false, 
          message: 'Server error' 
        });
      }

      if (!enquiry) {
        return res.status(404).json({ 
          success: false, 
          message: 'Enquiry not found' 
        });
      }

      // Mark as read
      db.run(
        'UPDATE enquiries SET is_read = 1 WHERE id = ?',
        [enquiryId],
        (err) => {
          if (err) console.error('Failed to mark as read:', err);
        }
      );

      res.json({
        success: true,
        enquiry
      });
    }
  );
});

// @route   POST /api/enquiries
// @desc    Create new enquiry (Public)
// @access  Public
router.post('/', [
  body('name').notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Please enter a valid email'),
  body('phone').notEmpty().withMessage('Phone number is required'),
  body('message').notEmpty().withMessage('Message is required')
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      success: false, 
      errors: errors.array() 
    });
  }

  const { name, email, phone, service_interest, message } = req.body;

  db.run(
    `INSERT INTO enquiries (name, email, phone, service_interest, message) 
     VALUES (?, ?, ?, ?, ?)`,
    [name, email, phone, service_interest || '', message],
    function(err) {
      if (err) {
        return res.status(500).json({ 
          success: false, 
          message: 'Failed to submit enquiry' 
        });
      }

      res.status(201).json({
        success: true,
        message: 'Enquiry submitted successfully. We will contact you soon!',
        enquiryId: this.lastID
      });
    }
  );
});

// @route   PUT /api/enquiries/:id
// @desc    Update enquiry status
// @access  Private
router.put('/:id', (req, res) => {
  const enquiryId = req.params.id;
  const { status, is_read } = req.body;

  let query = 'UPDATE enquiries SET updated_at = CURRENT_TIMESTAMP';
  const params = [];

  if (status) {
    query += ', status = ?';
    params.push(status);
  }

  if (is_read !== undefined) {
    query += ', is_read = ?';
    params.push(is_read ? 1 : 0);
  }

  query += ' WHERE id = ?';
  params.push(enquiryId);

  db.run(query, params, function(err) {
    if (err) {
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to update enquiry' 
      });
    }

    if (this.changes === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Enquiry not found' 
      });
    }

    res.json({
      success: true,
      message: 'Enquiry updated successfully'
    });
  });
});

// @route   DELETE /api/enquiries/:id
// @desc    Delete enquiry
// @access  Private
router.delete('/:id', (req, res) => {
  const enquiryId = req.params.id;

  db.run(
    'DELETE FROM enquiries WHERE id = ?',
    [enquiryId],
    function(err) {
      if (err) {
        return res.status(500).json({ 
          success: false, 
          message: 'Failed to delete enquiry' 
        });
      }

      if (this.changes === 0) {
        return res.status(404).json({ 
          success: false, 
          message: 'Enquiry not found' 
        });
      }

      res.json({
        success: true,
        message: 'Enquiry deleted successfully'
      });
    }
  );
});

module.exports = router;
