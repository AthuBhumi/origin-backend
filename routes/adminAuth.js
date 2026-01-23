const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { generateAdminToken, generateRefreshToken, verifyAdminToken, JWT_SECRET } = require('../middleware/adminAuth');
const jwt = require('jsonwebtoken');

module.exports = (db) => {
  
  // Admin Login
  router.post('/login', async (req, res) => {
    try {
      const { email, password, rememberMe } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required.' });
      }

      // Find admin by email
      db.get(
        'SELECT * FROM admin_users WHERE email = ?',
        [email],
        async (err, admin) => {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Database error.' });
          }

          if (!admin) {
            return res.status(401).json({ error: 'Invalid email or password.' });
          }

          // Check if account is active
          if (admin.status && admin.status.toLowerCase() !== 'active') {
            return res.status(403).json({ error: 'Account is not active.' });
          }

          // Verify password
          const validPassword = await bcrypt.compare(password, admin.password_hash);
          if (!validPassword) {
            return res.status(401).json({ error: 'Invalid email or password.' });
          }

          // Generate tokens
          const token = generateAdminToken(admin, rememberMe);
          const refreshToken = generateRefreshToken(admin);

          // Update last login
          db.run(
            'UPDATE admin_users SET last_login = CURRENT_TIMESTAMP WHERE admin_id = ?',
            [admin.admin_id]
          );

          // Log login history
          db.run(
            `INSERT INTO admin_login_history (admin_id, ip_address, user_agent, success) 
             VALUES (?, ?, ?, 1)`,
            [admin.admin_id, req.ip, req.headers['user-agent']]
          );

          res.json({
            message: 'Login successful',
            token,
            refreshToken,
            admin: {
              adminId: admin.admin_id,
              email: admin.email,
              firstName: admin.first_name,
              lastName: admin.last_name,
              role: admin.role,
              department: admin.department,
              avatarUrl: admin.avatar_url,
              permissions: admin.permissions ? JSON.parse(admin.permissions) : []
            }
          });
        }
      );
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Server error during login.' });
    }
  });

  // Admin Logout
  router.post('/logout', verifyAdminToken, (req, res) => {
    // In a production app, you might want to blacklist the token
    // For now, just send success response (frontend will remove token)
    res.json({ message: 'Logout successful' });
  });

  // Forgot Password
  router.post('/forgot-password', async (req, res) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ error: 'Email is required.' });
      }

      db.get(
        'SELECT * FROM admin_users WHERE email = ?',
        [email],
        (err, admin) => {
          if (err) {
            return res.status(500).json({ error: 'Database error.' });
          }

          if (!admin) {
            // Don't reveal if email exists
            return res.json({ 
              message: 'If that email exists, a password reset link has been sent.' 
            });
          }

          // Generate reset token
          const resetToken = crypto.randomBytes(32).toString('hex');
          const expiresAt = new Date(Date.now() + 3600000); // 1 hour

          db.run(
            `INSERT INTO admin_password_reset_tokens (admin_id, reset_token, expires_at) 
             VALUES (?, ?, ?)`,
            [admin.admin_id, resetToken, expiresAt.toISOString()],
            (err) => {
              if (err) {
                return res.status(500).json({ error: 'Error creating reset token.' });
              }

              // In production, send email with reset link
              // For now, return the token (remove this in production)
              res.json({
                message: 'If that email exists, a password reset link has been sent.',
                resetToken: resetToken // REMOVE IN PRODUCTION
              });
            }
          );
        }
      );
    } catch (error) {
      console.error('Forgot password error:', error);
      res.status(500).json({ error: 'Server error.' });
    }
  });

  // Reset Password
  router.post('/reset-password', async (req, res) => {
    try {
      const { resetToken, newPassword } = req.body;

      if (!resetToken || !newPassword) {
        return res.status(400).json({ error: 'Reset token and new password are required.' });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters.' });
      }

      // Find valid reset token
      db.get(
        `SELECT * FROM admin_password_reset_tokens 
         WHERE reset_token = ? AND used = 0 AND expires_at > datetime('now')`,
        [resetToken],
        async (err, tokenRecord) => {
          if (err) {
            return res.status(500).json({ error: 'Database error.' });
          }

          if (!tokenRecord) {
            return res.status(400).json({ error: 'Invalid or expired reset token.' });
          }

          // Hash new password
          const passwordHash = await bcrypt.hash(newPassword, 10);

          // Update password
          db.run(
            'UPDATE admin_users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE admin_id = ?',
            [passwordHash, tokenRecord.admin_id],
            (err) => {
              if (err) {
                return res.status(500).json({ error: 'Error updating password.' });
              }

              // Mark token as used
              db.run(
                'UPDATE admin_password_reset_tokens SET used = 1 WHERE token_id = ?',
                [tokenRecord.token_id]
              );

              res.json({ message: 'Password reset successful. Please login with your new password.' });
            }
          );
        }
      );
    } catch (error) {
      console.error('Reset password error:', error);
      res.status(500).json({ error: 'Server error.' });
    }
  });

  // Change Password (Authenticated)
  router.post('/change-password', verifyAdminToken, async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Current and new password are required.' });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({ error: 'New password must be at least 8 characters.' });
      }

      // Get admin
      db.get(
        'SELECT * FROM admin_users WHERE admin_id = ?',
        [req.admin.adminId],
        async (err, admin) => {
          if (err || !admin) {
            return res.status(500).json({ error: 'Error fetching admin data.' });
          }

          // Verify current password
          const validPassword = await bcrypt.compare(currentPassword, admin.password_hash);
          if (!validPassword) {
            return res.status(401).json({ error: 'Current password is incorrect.' });
          }

          // Hash new password
          const passwordHash = await bcrypt.hash(newPassword, 10);

          // Update password
          db.run(
            'UPDATE admin_users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE admin_id = ?',
            [passwordHash, admin.admin_id],
            (err) => {
              if (err) {
                return res.status(500).json({ error: 'Error updating password.' });
              }

              res.json({ message: 'Password changed successfully.' });
            }
          );
        }
      );
    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({ error: 'Server error.' });
    }
  });

  // Refresh Token
  router.post('/refresh-token', (req, res) => {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({ error: 'Refresh token is required.' });
      }

      const decoded = jwt.verify(refreshToken, JWT_SECRET);

      if (decoded.userType !== 'admin') {
        return res.status(403).json({ error: 'Invalid refresh token.' });
      }

      // Get admin data
      db.get(
        'SELECT * FROM admin_users WHERE admin_id = ? AND status = ?',
        [decoded.adminId, 'Active'],
        (err, admin) => {
          if (err || !admin) {
            return res.status(401).json({ error: 'Invalid refresh token.' });
          }

          const newToken = generateAdminToken(admin);
          const newRefreshToken = generateRefreshToken(admin);

          res.json({
            token: newToken,
            refreshToken: newRefreshToken
          });
        }
      );
    } catch (error) {
      res.status(401).json({ error: 'Invalid or expired refresh token.' });
    }
  });

  // Get Admin Profile
  router.get('/profile', verifyAdminToken, (req, res) => {
    db.get(
      'SELECT admin_id, email, first_name, last_name, role, department, phone, avatar_url, status, permissions, created_at, last_login FROM admin_users WHERE admin_id = ?',
      [req.admin.adminId],
      (err, admin) => {
        if (err) {
          return res.status(500).json({ error: 'Database error.' });
        }

        if (!admin) {
          return res.status(404).json({ error: 'Admin not found.' });
        }

        res.json({
          ...admin,
          permissions: admin.permissions ? JSON.parse(admin.permissions) : []
        });
      }
    );
  });

  // Update Admin Profile
  router.put('/profile', verifyAdminToken, (req, res) => {
    const { firstName, lastName, phone, avatarUrl } = req.body;

    const updates = [];
    const values = [];

    if (firstName) {
      updates.push('first_name = ?');
      values.push(firstName);
    }
    if (lastName) {
      updates.push('last_name = ?');
      values.push(lastName);
    }
    if (phone !== undefined) {
      updates.push('phone = ?');
      values.push(phone);
    }
    if (avatarUrl !== undefined) {
      updates.push('avatar_url = ?');
      values.push(avatarUrl);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update.' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(req.admin.adminId);

    db.run(
      `UPDATE admin_users SET ${updates.join(', ')} WHERE admin_id = ?`,
      values,
      function(err) {
        if (err) {
          return res.status(500).json({ error: 'Error updating profile.' });
        }

        if (this.changes === 0) {
          return res.status(404).json({ error: 'Admin not found.' });
        }

        res.json({ message: 'Profile updated successfully.' });
      }
    );
  });

  return router;
};
