const express = require('express');
const router = express.Router();
const { verifyAdminToken, checkRole, logAdminActivity } = require('../middleware/adminAuth');

module.exports = (db) => {
  
  // MILESTONES ROUTES

  // Get all milestones
  router.get('/milestones', verifyAdminToken, (req, res) => {
    const { projectId, status } = req.query;
    
    let query = `SELECT m.*, p.project_name, tm.first_name || ' ' || tm.last_name as assigned_to_name
                 FROM admin_milestones m
                 LEFT JOIN admin_projects p ON m.project_id = p.project_id
                 LEFT JOIN team_members tm ON m.assigned_to = tm.member_id
                 WHERE 1=1`;
    const params = [];

    if (projectId) {
      query += ' AND m.project_id = ?';
      params.push(projectId);
    }

    if (status) {
      query += ' AND m.status = ?';
      params.push(status);
    }

    query += ' ORDER BY m.target_date ASC';

    db.all(query, params, (err, milestones) => {
      if (err) {
        return res.status(500).json({ error: 'Database error.' });
      }

      res.json(milestones);
    });
  });

  // Get single milestone
  router.get('/milestones/:id', verifyAdminToken, (req, res) => {
    db.get(
      `SELECT m.*, p.project_name, tm.first_name || ' ' || tm.last_name as assigned_to_name
       FROM admin_milestones m
       LEFT JOIN admin_projects p ON m.project_id = p.project_id
       LEFT JOIN team_members tm ON m.assigned_to = tm.member_id
       WHERE m.milestone_id = ?`,
      [req.params.id],
      (err, milestone) => {
        if (err) {
          return res.status(500).json({ error: 'Database error.' });
        }

        if (!milestone) {
          return res.status(404).json({ error: 'Milestone not found.' });
        }

        res.json(milestone);
      }
    );
  });

  // Create milestone
  router.post('/milestones', verifyAdminToken, checkRole('Super Admin', 'Project Manager'), logAdminActivity('CREATE', 'Milestone'), (req, res) => {
    const { projectId, milestoneName, description, targetDate, assignedTo, status } = req.body;

    if (!projectId || !milestoneName || !targetDate) {
      return res.status(400).json({ error: 'Project ID, milestone name, and target date are required.' });
    }

    db.run(
      `INSERT INTO admin_milestones (project_id, milestone_name, description, target_date, assigned_to, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [projectId, milestoneName, description, targetDate, assignedTo, status || 'Not Started'],
      function(err) {
        if (err) {
          return res.status(500).json({ error: 'Error creating milestone.' });
        }

        res.status(201).json({
          message: 'Milestone created successfully',
          milestoneId: this.lastID
        });
      }
    );
  });

  // Update milestone
  router.put('/milestones/:id', verifyAdminToken, checkRole('Super Admin', 'Project Manager', 'Team Lead'), logAdminActivity('UPDATE', 'Milestone'), (req, res) => {
    const { milestoneName, description, targetDate, actualDate, status, completionPercentage, assignedTo } = req.body;

    const updates = [];
    const values = [];

    if (milestoneName) { updates.push('milestone_name = ?'); values.push(milestoneName); }
    if (description !== undefined) { updates.push('description = ?'); values.push(description); }
    if (targetDate) { updates.push('target_date = ?'); values.push(targetDate); }
    if (actualDate !== undefined) { updates.push('actual_date = ?'); values.push(actualDate); }
    if (status) { updates.push('status = ?'); values.push(status); }
    if (completionPercentage !== undefined) { updates.push('completion_percentage = ?'); values.push(completionPercentage); }
    if (assignedTo !== undefined) { updates.push('assigned_to = ?'); values.push(assignedTo); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update.' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(req.params.id);

    db.run(
      `UPDATE admin_milestones SET ${updates.join(', ')} WHERE milestone_id = ?`,
      values,
      function(err) {
        if (err) {
          return res.status(500).json({ error: 'Error updating milestone.' });
        }

        if (this.changes === 0) {
          return res.status(404).json({ error: 'Milestone not found.' });
        }

        res.json({ message: 'Milestone updated successfully' });
      }
    );
  });

  // Delete milestone
  router.delete('/milestones/:id', verifyAdminToken, checkRole('Super Admin', 'Project Manager'), logAdminActivity('DELETE', 'Milestone'), (req, res) => {
    db.run(
      'DELETE FROM admin_milestones WHERE milestone_id = ?',
      [req.params.id],
      function(err) {
        if (err) {
          return res.status(500).json({ error: 'Error deleting milestone.' });
        }

        if (this.changes === 0) {
          return res.status(404).json({ error: 'Milestone not found.' });
        }

        res.json({ message: 'Milestone deleted successfully' });
      }
    );
  });

  // TASKS ROUTES

  // Get all tasks
  router.get('/tasks', verifyAdminToken, (req, res) => {
    const { projectId, milestoneId, assignedTo, status, priority } = req.query;
    
    let query = `SELECT t.*, p.project_name, m.milestone_name, tm.first_name || ' ' || tm.last_name as assigned_to_name
                 FROM admin_tasks t
                 LEFT JOIN admin_projects p ON t.project_id = p.project_id
                 LEFT JOIN admin_milestones m ON t.milestone_id = m.milestone_id
                 LEFT JOIN team_members tm ON t.assigned_to = tm.member_id
                 WHERE 1=1`;
    const params = [];

    if (projectId) {
      query += ' AND t.project_id = ?';
      params.push(projectId);
    }

    if (milestoneId) {
      query += ' AND t.milestone_id = ?';
      params.push(milestoneId);
    }

    if (assignedTo) {
      query += ' AND t.assigned_to = ?';
      params.push(assignedTo);
    }

    if (status) {
      query += ' AND t.status = ?';
      params.push(status);
    }

    if (priority) {
      query += ' AND t.priority = ?';
      params.push(priority);
    }

    query += ' ORDER BY t.due_date ASC';

    db.all(query, params, (err, tasks) => {
      if (err) {
        return res.status(500).json({ error: 'Database error.' });
      }

      res.json(tasks);
    });
  });

  // Get single task
  router.get('/tasks/:id', verifyAdminToken, (req, res) => {
    db.get(
      `SELECT t.*, p.project_name, m.milestone_name, tm.first_name || ' ' || tm.last_name as assigned_to_name
       FROM admin_tasks t
       LEFT JOIN admin_projects p ON t.project_id = p.project_id
       LEFT JOIN admin_milestones m ON t.milestone_id = m.milestone_id
       LEFT JOIN team_members tm ON t.assigned_to = tm.member_id
       WHERE t.task_id = ?`,
      [req.params.id],
      (err, task) => {
        if (err) {
          return res.status(500).json({ error: 'Database error.' });
        }

        if (!task) {
          return res.status(404).json({ error: 'Task not found.' });
        }

        res.json(task);
      }
    );
  });

  // Create task
  router.post('/tasks', verifyAdminToken, checkRole('Super Admin', 'Project Manager', 'Team Lead'), logAdminActivity('CREATE', 'Task'), (req, res) => {
    const { projectId, milestoneId, taskName, description, assignedTo, status, priority, dueDate, estimatedHours } = req.body;

    if (!projectId || !taskName) {
      return res.status(400).json({ error: 'Project ID and task name are required.' });
    }

    db.run(
      `INSERT INTO admin_tasks (project_id, milestone_id, task_name, description, assigned_to, status, priority, due_date, estimated_hours, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [projectId, milestoneId, taskName, description, assignedTo, status || 'To Do', priority || 'Medium', dueDate, estimatedHours, req.admin.adminId],
      function(err) {
        if (err) {
          return res.status(500).json({ error: 'Error creating task.' });
        }

        res.status(201).json({
          message: 'Task created successfully',
          taskId: this.lastID
        });
      }
    );
  });

  // Update task
  router.put('/tasks/:id', verifyAdminToken, logAdminActivity('UPDATE', 'Task'), (req, res) => {
    const { taskName, description, assignedTo, status, priority, dueDate, estimatedHours, actualHours, completionPercentage } = req.body;

    const updates = [];
    const values = [];

    if (taskName) { updates.push('task_name = ?'); values.push(taskName); }
    if (description !== undefined) { updates.push('description = ?'); values.push(description); }
    if (assignedTo !== undefined) { updates.push('assigned_to = ?'); values.push(assignedTo); }
    if (status) { updates.push('status = ?'); values.push(status); }
    if (priority) { updates.push('priority = ?'); values.push(priority); }
    if (dueDate !== undefined) { updates.push('due_date = ?'); values.push(dueDate); }
    if (estimatedHours !== undefined) { updates.push('estimated_hours = ?'); values.push(estimatedHours); }
    if (actualHours !== undefined) { updates.push('actual_hours = ?'); values.push(actualHours); }
    if (completionPercentage !== undefined) { updates.push('completion_percentage = ?'); values.push(completionPercentage); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update.' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(req.params.id);

    db.run(
      `UPDATE admin_tasks SET ${updates.join(', ')} WHERE task_id = ?`,
      values,
      function(err) {
        if (err) {
          return res.status(500).json({ error: 'Error updating task.' });
        }

        if (this.changes === 0) {
          return res.status(404).json({ error: 'Task not found.' });
        }

        res.json({ message: 'Task updated successfully' });
      }
    );
  });

  // Delete task
  router.delete('/tasks/:id', verifyAdminToken, checkRole('Super Admin', 'Project Manager'), logAdminActivity('DELETE', 'Task'), (req, res) => {
    db.run(
      'DELETE FROM admin_tasks WHERE task_id = ?',
      [req.params.id],
      function(err) {
        if (err) {
          return res.status(500).json({ error: 'Error deleting task.' });
        }

        if (this.changes === 0) {
          return res.status(404).json({ error: 'Task not found.' });
        }

        res.json({ message: 'Task deleted successfully' });
      }
    );
  });

  return router;
};
