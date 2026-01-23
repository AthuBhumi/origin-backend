const express = require('express');
const router = express.Router();
const { verifyAdminToken, checkRole, logAdminActivity } = require('../middleware/adminAuth');

module.exports = (db) => {
  
  // Get all projects (with filtering, pagination)
  router.get('/', verifyAdminToken, (req, res) => {
    const { status, clientId, projectLeadId, priority, search, sort = 'created_at', order = 'DESC', page = 1, limit = 50 } = req.query;
    
    let query = `SELECT p.*, c.company_name as client_name, tm.first_name || ' ' || tm.last_name as lead_name
                 FROM admin_projects p
                 LEFT JOIN admin_clients c ON p.client_id = c.client_id
                 LEFT JOIN team_members tm ON p.project_lead_id = tm.member_id
                 WHERE 1=1`;
    const params = [];

    if (status) {
      query += ' AND p.status = ?';
      params.push(status);
    }

    if (clientId) {
      query += ' AND p.client_id = ?';
      params.push(clientId);
    }

    if (projectLeadId) {
      query += ' AND p.project_lead_id = ?';
      params.push(projectLeadId);
    }

    if (priority) {
      query += ' AND p.priority = ?';
      params.push(priority);
    }

    if (search) {
      query += ' AND (p.project_name LIKE ? OR p.description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ` ORDER BY p.${sort} ${order} LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

    db.all(query, params, (err, projects) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error.' });
      }

      db.get('SELECT COUNT(*) as total FROM admin_projects', (err, count) => {
        res.json({
          projects,
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

  // Get single project
  router.get('/:id', verifyAdminToken, (req, res) => {
    db.get(
      `SELECT p.*, c.company_name as client_name, c.email as client_email,
              tm.first_name || ' ' || tm.last_name as lead_name
       FROM admin_projects p
       LEFT JOIN admin_clients c ON p.client_id = c.client_id
       LEFT JOIN team_members tm ON p.project_lead_id = tm.member_id
       WHERE p.project_id = ?`,
      [req.params.id],
      (err, project) => {
        if (err) {
          return res.status(500).json({ error: 'Database error.' });
        }

        if (!project) {
          return res.status(404).json({ error: 'Project not found.' });
        }

        res.json(project);
      }
    );
  });

  // Create new project
  router.post('/', verifyAdminToken, checkRole('Super Admin', 'Project Manager'), logAdminActivity('CREATE', 'Project'), (req, res) => {
    const { clientId, projectName, description, startDate, endDate, totalBudget, projectLeadId, priority, projectType, status } = req.body;

    if (!clientId || !projectName || !startDate) {
      return res.status(400).json({ error: 'Client ID, project name, and start date are required.' });
    }

    db.run(
      `INSERT INTO admin_projects (client_id, project_name, description, start_date, end_date, total_budget, project_lead_id, priority, project_type, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [clientId, projectName, description, startDate, endDate, totalBudget || 0, projectLeadId, priority || 'Medium', projectType, status || 'Planning'],
      function(err) {
        if (err) {
          console.error('Error creating project:', err);
          return res.status(500).json({ error: 'Error creating project.' });
        }

        res.status(201).json({
          message: 'Project created successfully',
          projectId: this.lastID
        });
      }
    );
  });

  // Update project
  router.put('/:id', verifyAdminToken, checkRole('Super Admin', 'Project Manager'), logAdminActivity('UPDATE', 'Project'), (req, res) => {
    const { projectName, description, startDate, endDate, totalBudget, spentBudget, status, progressPercentage, projectLeadId, priority, projectType } = req.body;

    const updates = [];
    const values = [];

    if (projectName) { updates.push('project_name = ?'); values.push(projectName); }
    if (description !== undefined) { updates.push('description = ?'); values.push(description); }
    if (startDate) { updates.push('start_date = ?'); values.push(startDate); }
    if (endDate !== undefined) { updates.push('end_date = ?'); values.push(endDate); }
    if (totalBudget !== undefined) { updates.push('total_budget = ?'); values.push(totalBudget); }
    if (spentBudget !== undefined) { updates.push('spent_budget = ?'); values.push(spentBudget); }
    if (status) { updates.push('status = ?'); values.push(status); }
    if (progressPercentage !== undefined) { updates.push('progress_percentage = ?'); values.push(progressPercentage); }
    if (projectLeadId !== undefined) { updates.push('project_lead_id = ?'); values.push(projectLeadId); }
    if (priority) { updates.push('priority = ?'); values.push(priority); }
    if (projectType !== undefined) { updates.push('project_type = ?'); values.push(projectType); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update.' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(req.params.id);

    db.run(
      `UPDATE admin_projects SET ${updates.join(', ')} WHERE project_id = ?`,
      values,
      function(err) {
        if (err) {
          return res.status(500).json({ error: 'Error updating project.' });
        }

        if (this.changes === 0) {
          return res.status(404).json({ error: 'Project not found.' });
        }

        res.json({ message: 'Project updated successfully' });
      }
    );
  });

  // Delete project
  router.delete('/:id', verifyAdminToken, checkRole('Super Admin'), logAdminActivity('DELETE', 'Project'), (req, res) => {
    db.run(
      'DELETE FROM admin_projects WHERE project_id = ?',
      [req.params.id],
      function(err) {
        if (err) {
          return res.status(500).json({ error: 'Error deleting project.' });
        }

        if (this.changes === 0) {
          return res.status(404).json({ error: 'Project not found.' });
        }

        res.json({ message: 'Project deleted successfully' });
      }
    );
  });

  // Get project milestones
  router.get('/:id/milestones', verifyAdminToken, (req, res) => {
    db.all(
      `SELECT m.*, tm.first_name || ' ' || tm.last_name as assigned_to_name
       FROM admin_milestones m
       LEFT JOIN team_members tm ON m.assigned_to = tm.member_id
       WHERE m.project_id = ?
       ORDER BY m.target_date ASC`,
      [req.params.id],
      (err, milestones) => {
        if (err) {
          return res.status(500).json({ error: 'Database error.' });
        }

        res.json(milestones);
      }
    );
  });

  // Get project tasks
  router.get('/:id/tasks', verifyAdminToken, (req, res) => {
    db.all(
      `SELECT t.*, tm.first_name || ' ' || tm.last_name as assigned_to_name, m.milestone_name
       FROM admin_tasks t
       LEFT JOIN team_members tm ON t.assigned_to = tm.member_id
       LEFT JOIN admin_milestones m ON t.milestone_id = m.milestone_id
       WHERE t.project_id = ?
       ORDER BY t.due_date ASC`,
      [req.params.id],
      (err, tasks) => {
        if (err) {
          return res.status(500).json({ error: 'Database error.' });
        }

        res.json(tasks);
      }
    );
  });

  // Get project deliverables
  router.get('/:id/deliverables', verifyAdminToken, (req, res) => {
    db.all(
      `SELECT d.*, tm.first_name || ' ' || tm.last_name as uploaded_by_name
       FROM admin_deliverables d
       LEFT JOIN team_members tm ON d.uploaded_by = tm.member_id
       WHERE d.project_id = ?
       ORDER BY d.upload_date DESC`,
      [req.params.id],
      (err, deliverables) => {
        if (err) {
          return res.status(500).json({ error: 'Database error.' });
        }

        res.json(deliverables);
      }
    );
  });

  // Get project team
  router.get('/:id/team', verifyAdminToken, (req, res) => {
    db.all(
      `SELECT apt.*, tm.first_name, tm.last_name, tm.email, tm.position, tm.avatar_url
       FROM admin_project_team apt
       JOIN team_members tm ON apt.member_id = tm.member_id
       WHERE apt.project_id = ? AND apt.is_active = 1
       ORDER BY apt.assigned_date DESC`,
      [req.params.id],
      (err, team) => {
        if (err) {
          return res.status(500).json({ error: 'Database error.' });
        }

        res.json(team);
      }
    );
  });

  // Add team member to project
  router.post('/:id/team', verifyAdminToken, checkRole('Super Admin', 'Project Manager'), (req, res) => {
    const { memberId, role } = req.body;

    if (!memberId) {
      return res.status(400).json({ error: 'Member ID is required.' });
    }

    db.run(
      `INSERT INTO admin_project_team (project_id, member_id, role)
       VALUES (?, ?, ?)`,
      [req.params.id, memberId, role],
      function(err) {
        if (err) {
          if (err.message.includes('UNIQUE')) {
            return res.status(400).json({ error: 'Team member already assigned to this project.' });
          }
          return res.status(500).json({ error: 'Error adding team member.' });
        }

        res.status(201).json({ message: 'Team member added successfully' });
      }
    );
  });

  return router;
};
