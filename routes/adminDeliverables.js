const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { verifyAdminToken, checkRole, logAdminActivity } = require('../middleware/adminAuth');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/deliverables');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) => {
    // Allow all file types for deliverables
    cb(null, true);
  }
});

module.exports = (db) => {
  
  // Get all deliverables
  router.get('/', verifyAdminToken, (req, res) => {
    const { projectId, category, visibility } = req.query;
    
    let query = `SELECT d.*, p.project_name, tm.first_name || ' ' || tm.last_name as uploaded_by_name
                 FROM admin_deliverables d
                 LEFT JOIN admin_projects p ON d.project_id = p.project_id
                 LEFT JOIN team_members tm ON d.uploaded_by = tm.member_id
                 WHERE 1=1`;
    const params = [];

    if (projectId) {
      query += ' AND d.project_id = ?';
      params.push(projectId);
    }

    if (category) {
      query += ' AND d.category = ?';
      params.push(category);
    }

    if (visibility) {
      query += ' AND d.visibility = ?';
      params.push(visibility);
    }

    query += ' ORDER BY d.upload_date DESC';

    db.all(query, params, (err, deliverables) => {
      if (err) {
        return res.status(500).json({ error: 'Database error.' });
      }

      res.json(deliverables);
    });
  });

  // Get single deliverable
  router.get('/:id', verifyAdminToken, (req, res) => {
    db.get(
      `SELECT d.*, p.project_name, tm.first_name || ' ' || tm.last_name as uploaded_by_name
       FROM admin_deliverables d
       LEFT JOIN admin_projects p ON d.project_id = p.project_id
       LEFT JOIN team_members tm ON d.uploaded_by = tm.member_id
       WHERE d.deliverable_id = ?`,
      [req.params.id],
      (err, deliverable) => {
        if (err) {
          return res.status(500).json({ error: 'Database error.' });
        }

        if (!deliverable) {
          return res.status(404).json({ error: 'Deliverable not found.' });
        }

        res.json(deliverable);
      }
    );
  });

  // Upload deliverable
  router.post('/', verifyAdminToken, upload.single('file'), logAdminActivity('CREATE', 'Deliverable'), (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    const { projectId, description, category, visibility, uploadedBy } = req.body;

    if (!projectId) {
      // Delete uploaded file if validation fails
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'Project ID is required.' });
    }

    db.run(
      `INSERT INTO admin_deliverables (project_id, file_name, file_path, file_size, file_type, description, category, uploaded_by, visibility)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        projectId,
        req.file.originalname,
        req.file.filename,
        req.file.size,
        req.file.mimetype,
        description,
        category,
        uploadedBy,
        visibility || 'Public'
      ],
      function(err) {
        if (err) {
          // Delete uploaded file if database insert fails
          fs.unlinkSync(req.file.path);
          return res.status(500).json({ error: 'Error saving deliverable.' });
        }

        res.status(201).json({
          message: 'Deliverable uploaded successfully',
          deliverableId: this.lastID,
          fileName: req.file.originalname,
          fileSize: req.file.size
        });
      }
    );
  });

  // Update deliverable info (not the file itself)
  router.put('/:id', verifyAdminToken, logAdminActivity('UPDATE', 'Deliverable'), (req, res) => {
    const { description, category, visibility } = req.body;

    const updates = [];
    const values = [];

    if (description !== undefined) { updates.push('description = ?'); values.push(description); }
    if (category !== undefined) { updates.push('category = ?'); values.push(category); }
    if (visibility) { updates.push('visibility = ?'); values.push(visibility); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update.' });
    }

    values.push(req.params.id);

    db.run(
      `UPDATE admin_deliverables SET ${updates.join(', ')} WHERE deliverable_id = ?`,
      values,
      function(err) {
        if (err) {
          return res.status(500).json({ error: 'Error updating deliverable.' });
        }

        if (this.changes === 0) {
          return res.status(404).json({ error: 'Deliverable not found.' });
        }

        res.json({ message: 'Deliverable updated successfully' });
      }
    );
  });

  // Download deliverable
  router.get('/:id/download', verifyAdminToken, (req, res) => {
    db.get(
      'SELECT * FROM admin_deliverables WHERE deliverable_id = ?',
      [req.params.id],
      (err, deliverable) => {
        if (err) {
          return res.status(500).json({ error: 'Database error.' });
        }

        if (!deliverable) {
          return res.status(404).json({ error: 'Deliverable not found.' });
        }

        const filePath = path.join(__dirname, '../uploads/deliverables', deliverable.file_path);

        if (!fs.existsSync(filePath)) {
          return res.status(404).json({ error: 'File not found on server.' });
        }

        res.download(filePath, deliverable.file_name);
      }
    );
  });

  // Delete deliverable
  router.delete('/:id', verifyAdminToken, checkRole('Super Admin', 'Project Manager'), logAdminActivity('DELETE', 'Deliverable'), (req, res) => {
    db.get(
      'SELECT * FROM admin_deliverables WHERE deliverable_id = ?',
      [req.params.id],
      (err, deliverable) => {
        if (err) {
          return res.status(500).json({ error: 'Database error.' });
        }

        if (!deliverable) {
          return res.status(404).json({ error: 'Deliverable not found.' });
        }

        // Delete from database first
        db.run(
          'DELETE FROM admin_deliverables WHERE deliverable_id = ?',
          [req.params.id],
          function(err) {
            if (err) {
              return res.status(500).json({ error: 'Error deleting deliverable.' });
            }

            // Delete file from filesystem
            const filePath = path.join(__dirname, '../uploads/deliverables', deliverable.file_path);
            if (fs.existsSync(filePath)) {
              try {
                fs.unlinkSync(filePath);
              } catch (err) {
                console.error('Error deleting file:', err);
              }
            }

            res.json({ message: 'Deliverable deleted successfully' });
          }
        );
      }
    );
  });

  return router;
};
