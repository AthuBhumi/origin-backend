const express = require('express');
const router = express.Router();
const { verifyAdminToken, checkRole, logAdminActivity } = require('../middleware/adminAuth');

module.exports = (db) => {
  
  // Get all clients (with filtering, pagination, sorting)
  router.get('/', verifyAdminToken, (req, res) => {
    const { status, industry, search, sort = 'created_at', order = 'DESC', page = 1, limit = 50 } = req.query;
    
    let query = 'SELECT * FROM admin_clients WHERE 1=1';
    const params = [];

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    if (industry) {
      query += ' AND industry = ?';
      params.push(industry);
    }

    if (search) {
      query += ' AND (company_name LIKE ? OR contact_person LIKE ? OR email LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    query += ` ORDER BY ${sort} ${order} LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

    db.all(query, params, (err, clients) => {
      if (err) {
        return res.status(500).json({ error: 'Database error.' });
      }

      db.get('SELECT COUNT(*) as total FROM admin_clients', (err, count) => {
        res.json({
          clients,
          pagination: {
            total: count?.total || 0,
            page: parseInt(page),
            limit: parseInt(limit),
            pages: Math.ceil((count?.total || 0) / parseInt(limit))
          }
        });
      });
    });
  });

  // Get single client
  router.get('/:id', verifyAdminToken, (req, res) => {
    db.get(
      'SELECT * FROM admin_clients WHERE client_id = ?',
      [req.params.id],
      (err, client) => {
        if (err) {
          return res.status(500).json({ error: 'Database error.' });
        }

        if (!client) {
          return res.status(404).json({ error: 'Client not found.' });
        }

        res.json(client);
      }
    );
  });

  // Create new client
  router.post('/', verifyAdminToken, checkRole('Super Admin', 'Project Manager'), logAdminActivity('CREATE', 'Client'), (req, res) => {
    const { companyName, contactPerson, email, phone, address, city, country, website, industry, clientType, totalBudget, status } = req.body;

    if (!companyName || !contactPerson || !email) {
      return res.status(400).json({ error: 'Company name, contact person, and email are required.' });
    }

    db.run(
      `INSERT INTO admin_clients (company_name, contact_person, email, phone, address, city, country, website, industry, client_type, total_budget, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [companyName, contactPerson, email, phone, address, city, country, website, industry, clientType, totalBudget || 0, status || 'Active'],
      function(err) {
        if (err) {
          if (err.message.includes('UNIQUE')) {
            return res.status(400).json({ error: 'Email already exists.' });
          }
          return res.status(500).json({ error: 'Error creating client.' });
        }

        res.status(201).json({
          message: 'Client created successfully',
          clientId: this.lastID
        });
      }
    );
  });

  // Update client
  router.put('/:id', verifyAdminToken, checkRole('Super Admin', 'Project Manager'), logAdminActivity('UPDATE', 'Client'), (req, res) => {
    const { companyName, contactPerson, email, phone, address, city, country, website, industry, clientType, totalBudget, status } = req.body;

    const updates = [];
    const values = [];

    if (companyName) { updates.push('company_name = ?'); values.push(companyName); }
    if (contactPerson) { updates.push('contact_person = ?'); values.push(contactPerson); }
    if (email) { updates.push('email = ?'); values.push(email); }
    if (phone !== undefined) { updates.push('phone = ?'); values.push(phone); }
    if (address !== undefined) { updates.push('address = ?'); values.push(address); }
    if (city !== undefined) { updates.push('city = ?'); values.push(city); }
    if (country !== undefined) { updates.push('country = ?'); values.push(country); }
    if (website !== undefined) { updates.push('website = ?'); values.push(website); }
    if (industry !== undefined) { updates.push('industry = ?'); values.push(industry); }
    if (clientType !== undefined) { updates.push('client_type = ?'); values.push(clientType); }
    if (totalBudget !== undefined) { updates.push('total_budget = ?'); values.push(totalBudget); }
    if (status) { updates.push('status = ?'); values.push(status); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update.' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(req.params.id);

    db.run(
      `UPDATE admin_clients SET ${updates.join(', ')} WHERE client_id = ?`,
      values,
      function(err) {
        if (err) {
          return res.status(500).json({ error: 'Error updating client.' });
        }

        if (this.changes === 0) {
          return res.status(404).json({ error: 'Client not found.' });
        }

        res.json({ message: 'Client updated successfully' });
      }
    );
  });

  // Delete client
  router.delete('/:id', verifyAdminToken, checkRole('Super Admin'), logAdminActivity('DELETE', 'Client'), (req, res) => {
    db.run(
      'DELETE FROM admin_clients WHERE client_id = ?',
      [req.params.id],
      function(err) {
        if (err) {
          return res.status(500).json({ error: 'Error deleting client.' });
        }

        if (this.changes === 0) {
          return res.status(404).json({ error: 'Client not found.' });
        }

        res.json({ message: 'Client deleted successfully' });
      }
    );
  });

  // Get client's projects
  router.get('/:id/projects', verifyAdminToken, (req, res) => {
    db.all(
      'SELECT * FROM admin_projects WHERE client_id = ? ORDER BY created_at DESC',
      [req.params.id],
      (err, projects) => {
        if (err) {
          return res.status(500).json({ error: 'Database error.' });
        }

        res.json(projects);
      }
    );
  });

  return router;
};
