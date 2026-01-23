const express = require('express');
const router = express.Router();
const { verifyAdminToken, checkRole, logAdminActivity } = require('../middleware/adminAuth');

module.exports = (db) => {
  
  // Get all team members
  router.get('/', verifyAdminToken, (req, res) => {
    const { status, position, department, search } = req.query;
    
    let query = 'SELECT * FROM team_members WHERE 1=1';
    const params = [];

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    if (position) {
      query += ' AND position = ?';
      params.push(position);
    }

    if (department) {
      query += ' AND department = ?';
      params.push(department);
    }

    if (search) {
      query += ' AND (first_name LIKE ? OR last_name LIKE ? OR email LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY created_at DESC';

    db.all(query, params, (err, members) => {
      if (err) {
        return res.status(500).json({ error: 'Database error.' });
      }

      res.json(members);
    });
  });

  // Get single team member
  router.get('/:id', verifyAdminToken, (req, res) => {
    db.get(
      'SELECT * FROM team_members WHERE member_id = ?',
      [req.params.id],
      (err, member) => {
        if (err) {
          return res.status(500).json({ error: 'Database error.' });
        }

        if (!member) {
          return res.status(404).json({ error: 'Team member not found.' });
        }

        // Parse skills if JSON
        if (member.skills) {
          try {
            member.skills = JSON.parse(member.skills);
          } catch (e) {
            // Keep as string if not valid JSON
          }
        }

        res.json(member);
      }
    );
  });

  // Create new team member
  router.post('/', verifyAdminToken, checkRole('Super Admin', 'Project Manager'), logAdminActivity('CREATE', 'Team Member'), (req, res) => {
    const { firstName, lastName, email, phone, position, department, skills, hourlyRate, status, reportingTo } = req.body;

    if (!firstName || !lastName || !email || !position) {
      return res.status(400).json({ error: 'First name, last name, email, and position are required.' });
    }

    const skillsJson = Array.isArray(skills) ? JSON.stringify(skills) : skills;

    db.run(
      `INSERT INTO team_members (first_name, last_name, email, phone, position, department, skills, hourly_rate, status, reporting_to, joined_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, DATE('now'))`,
      [firstName, lastName, email, phone, position, department, skillsJson, hourlyRate, status || 'Active', reportingTo],
      function(err) {
        if (err) {
          if (err.message.includes('UNIQUE')) {
            return res.status(400).json({ error: 'Email already exists.' });
          }
          return res.status(500).json({ error: 'Error creating team member.' });
        }

        res.status(201).json({
          message: 'Team member created successfully',
          memberId: this.lastID
        });
      }
    );
  });

  // Update team member
  router.put('/:id', verifyAdminToken, checkRole('Super Admin', 'Project Manager'), logAdminActivity('UPDATE', 'Team Member'), (req, res) => {
    const { firstName, lastName, email, phone, position, department, skills, hourlyRate, status, reportingTo } = req.body;

    const updates = [];
    const values = [];

    if (firstName) { updates.push('first_name = ?'); values.push(firstName); }
    if (lastName) { updates.push('last_name = ?'); values.push(lastName); }
    if (email) { updates.push('email = ?'); values.push(email); }
    if (phone !== undefined) { updates.push('phone = ?'); values.push(phone); }
    if (position) { updates.push('position = ?'); values.push(position); }
    if (department !== undefined) { updates.push('department = ?'); values.push(department); }
    if (skills !== undefined) { 
      updates.push('skills = ?'); 
      values.push(Array.isArray(skills) ? JSON.stringify(skills) : skills); 
    }
    if (hourlyRate !== undefined) { updates.push('hourly_rate = ?'); values.push(hourlyRate); }
    if (status) { updates.push('status = ?'); values.push(status); }
    if (reportingTo !== undefined) { updates.push('reporting_to = ?'); values.push(reportingTo); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update.' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(req.params.id);

    db.run(
      `UPDATE team_members SET ${updates.join(', ')} WHERE member_id = ?`,
      values,
      function(err) {
        if (err) {
          return res.status(500).json({ error: 'Error updating team member.' });
        }

        if (this.changes === 0) {
          return res.status(404).json({ error: 'Team member not found.' });
        }

        res.json({ message: 'Team member updated successfully' });
      }
    );
  });

  // Delete team member
  router.delete('/:id', verifyAdminToken, checkRole('Super Admin'), logAdminActivity('DELETE', 'Team Member'), (req, res) => {
    db.run(
      'DELETE FROM team_members WHERE member_id = ?',
      [req.params.id],
      function(err) {
        if (err) {
          return res.status(500).json({ error: 'Error deleting team member.' });
        }

        if (this.changes === 0) {
          return res.status(404).json({ error: 'Team member not found.' });
        }

        res.json({ message: 'Team member deleted successfully' });
      }
    );
  });

  // Get team member's workload
  router.get('/:id/workload', verifyAdminToken, (req, res) => {
    db.all(
      `SELECT t.*, p.project_name
       FROM admin_tasks t
       JOIN admin_projects p ON t.project_id = p.project_id
       WHERE t.assigned_to = ? AND t.status != 'Completed'
       ORDER BY t.due_date ASC`,
      [req.params.id],
      (err, tasks) => {
        if (err) {
          return res.status(500).json({ error: 'Database error.' });
        }

        res.json({
          memberId: req.params.id,
          activeTasks: tasks.length,
          tasks: tasks
        });
      }
    );
  });

  // Get team member's assigned projects
  router.get('/:id/projects', verifyAdminToken, (req, res) => {
    db.all(
      `SELECT DISTINCT p.*, c.company_name as client_name
       FROM admin_projects p
       JOIN admin_clients c ON p.client_id = c.client_id
       LEFT JOIN admin_project_team apt ON p.project_id = apt.project_id
       WHERE (p.project_lead_id = ? OR apt.member_id = ?) AND apt.is_active = 1
       ORDER BY p.created_at DESC`,
      [req.params.id, req.params.id],
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
