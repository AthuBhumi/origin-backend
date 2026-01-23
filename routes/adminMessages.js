const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { verifyAdminToken } = require('../middleware/adminAuth');

// Configure multer for message attachments
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/messages');
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
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

module.exports = (db) => {
  
  // Get all messages/conversations
  router.get('/', verifyAdminToken, (req, res) => {
    const { projectId, receiverType } = req.query;
    
    let query = `SELECT m.*,
                 CASE
                   WHEN m.sender_type = 'admin' THEN (SELECT first_name || ' ' || last_name FROM admin_users WHERE admin_id = m.sender_id)
                   WHEN m.sender_type = 'team' THEN (SELECT first_name || ' ' || last_name FROM team_members WHERE member_id = m.sender_id)
                 END as sender_name
                 FROM admin_messages m
                 WHERE 1=1`;
    const params = [];

    if (projectId) {
      query += ' AND m.project_id = ?';
      params.push(projectId);
    }

    if (receiverType) {
      query += ' AND m.receiver_type = ?';
      params.push(receiverType);
    }

    query += ' ORDER BY m.created_at DESC';

    db.all(query, params, (err, messages) => {
      if (err) {
        return res.status(500).json({ error: 'Database error.' });
      }

      res.json(messages);
    });
  });

  // Get single message
  router.get('/:id', verifyAdminToken, (req, res) => {
    db.get(
      `SELECT m.*,
       CASE
         WHEN m.sender_type = 'admin' THEN (SELECT first_name || ' ' || last_name FROM admin_users WHERE admin_id = m.sender_id)
         WHEN m.sender_type = 'team' THEN (SELECT first_name || ' ' || last_name FROM team_members WHERE member_id = m.sender_id)
       END as sender_name
       FROM admin_messages m
       WHERE m.message_id = ?`,
      [req.params.id],
      (err, message) => {
        if (err) {
          return res.status(500).json({ error: 'Database error.' });
        }

        if (!message) {
          return res.status(404).json({ error: 'Message not found.' });
        }

        res.json(message);
      }
    );
  });

  // Send message
  router.post('/', verifyAdminToken, upload.single('attachment'), (req, res) => {
    const { projectId, receiverId, receiverType, messageContent } = req.body;

    if (!messageContent) {
      return res.status(400).json({ error: 'Message content is required.' });
    }

    const attachmentUrl = req.file ? req.file.filename : null;

    db.run(
      `INSERT INTO admin_messages (project_id, sender_id, sender_type, receiver_id, receiver_type, message_content, attachment_url)
       VALUES (?, ?, 'admin', ?, ?, ?, ?)`,
      [projectId, req.admin.adminId, receiverId, receiverType, messageContent, attachmentUrl],
      function(err) {
        if (err) {
          // Delete uploaded file if database insert fails
          if (req.file) {
            fs.unlinkSync(req.file.path);
          }
          return res.status(500).json({ error: 'Error sending message.' });
        }

        res.status(201).json({
          message: 'Message sent successfully',
          messageId: this.lastID
        });
      }
    );
  });

  // Mark message as read
  router.put('/:id/mark-read', verifyAdminToken, (req, res) => {
    db.run(
      'UPDATE admin_messages SET is_read = 1 WHERE message_id = ?',
      [req.params.id],
      function(err) {
        if (err) {
          return res.status(500).json({ error: 'Error updating message.' });
        }

        if (this.changes === 0) {
          return res.status(404).json({ error: 'Message not found.' });
        }

        res.json({ message: 'Message marked as read' });
      }
    );
  });

  // Get unread message count
  router.get('/unread/count', verifyAdminToken, (req, res) => {
    db.get(
      'SELECT COUNT(*) as count FROM admin_messages WHERE receiver_id = ? AND receiver_type = "admin" AND is_read = 0',
      [req.admin.adminId],
      (err, result) => {
        if (err) {
          return res.status(500).json({ error: 'Database error.' });
        }

        res.json({ unreadCount: result?.count || 0 });
      }
    );
  });

  // Delete message
  router.delete('/:id', verifyAdminToken, (req, res) => {
    db.get(
      'SELECT * FROM admin_messages WHERE message_id = ?',
      [req.params.id],
      (err, message) => {
        if (err) {
          return res.status(500).json({ error: 'Database error.' });
        }

        if (!message) {
          return res.status(404).json({ error: 'Message not found.' });
        }

        db.run(
          'DELETE FROM admin_messages WHERE message_id = ?',
          [req.params.id],
          function(err) {
            if (err) {
              return res.status(500).json({ error: 'Error deleting message.' });
            }

            // Delete attachment if exists
            if (message.attachment_url) {
              const filePath = path.join(__dirname, '../uploads/messages', message.attachment_url);
              if (fs.existsSync(filePath)) {
                try {
                  fs.unlinkSync(filePath);
                } catch (err) {
                  console.error('Error deleting attachment:', err);
                }
              }
            }

            res.json({ message: 'Message deleted successfully' });
          }
        );
      }
    );
  });

  return router;
};
