const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');

const router = express.Router();

// Admin login
router.post('/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  db.get('SELECT * FROM admins WHERE email = ?', [email], async (err, admin) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!admin) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, admin.password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      { id: admin.id, email: admin.email },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    res.json({ success: true, token, admin: { id: admin.id, name: admin.name, email: admin.email } });
  });
});

// Get current admin
router.get('/me', require('../middleware/adminAuth'), (req, res) => {
  db.get('SELECT id, name, email FROM admins WHERE id = ?', [req.user.id], (err, admin) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json({ success: true, admin });
  });
});

module.exports = router;