const express = require('express');
const router = express.Router();
const { verifyAdminToken } = require('../middleware/adminAuth');

module.exports = (db) => {
  
  // Get dashboard stats
  router.get('/stats', verifyAdminToken, (req, res) => {
    const stats = {};

    // Get all stats in parallel
    db.get('SELECT COUNT(*) as total FROM admin_clients WHERE status = "Active"', (err, result) => {
      stats.totalClients = result?.total || 0;

      db.get('SELECT COUNT(*) as total FROM admin_projects WHERE status = "In Progress"', (err, result) => {
        stats.activeProjects = result?.total || 0;

        db.get('SELECT COUNT(*) as total FROM admin_projects WHERE status = "Completed"', (err, result) => {
          stats.completedProjects = result?.total || 0;

          db.get('SELECT COUNT(*) as total FROM team_members WHERE status = "Active"', (err, result) => {
            stats.totalTeamMembers = result?.total || 0;

            db.get('SELECT SUM(total_budget) as total, SUM(spent_budget) as spent FROM admin_projects', (err, result) => {
              stats.totalBudget = result?.total || 0;
              stats.spentBudget = result?.spent || 0;
              stats.remainingBudget = (result?.total || 0) - (result?.spent || 0);

              db.get('SELECT COUNT(*) as total FROM admin_tasks WHERE status != "Completed"', (err, result) => {
                stats.pendingTasks = result?.total || 0;

                db.get('SELECT COUNT(*) as total FROM admin_tasks WHERE status != "Completed" AND due_date < DATE("now")', (err, result) => {
                  stats.overdueTasks = result?.total || 0;

                  res.json(stats);
                });
              });
            });
          });
        });
      });
    });
  });

  // Get recent activity
  router.get('/recent-activity', verifyAdminToken, (req, res) => {
    const limit = req.query.limit || 10;

    db.all(
      `SELECT al.*, au.first_name || ' ' || au.last_name as admin_name
       FROM admin_activity_log al
       LEFT JOIN admin_users au ON al.admin_id = au.admin_id
       ORDER BY al.created_at DESC
       LIMIT ?`,
      [limit],
      (err, activities) => {
        if (err) {
          return res.status(500).json({ error: 'Database error.' });
        }

        res.json(activities);
      }
    );
  });

  // Get upcoming deadlines
  router.get('/upcoming-deadlines', verifyAdminToken, (req, res) => {
    const limit = req.query.limit || 5;

    db.all(
      `SELECT m.milestone_id as id, m.milestone_name as name, m.target_date as deadline, 
              'milestone' as type, p.project_name, p.project_id
       FROM admin_milestones m
       JOIN admin_projects p ON m.project_id = p.project_id
       WHERE m.status != 'Completed' AND m.target_date >= DATE('now')
       UNION ALL
       SELECT t.task_id as id, t.task_name as name, t.due_date as deadline,
              'task' as type, p.project_name, p.project_id
       FROM admin_tasks t
       JOIN admin_projects p ON t.project_id = p.project_id
       WHERE t.status != 'Completed' AND t.due_date >= DATE('now')
       ORDER BY deadline ASC
       LIMIT ?`,
      [limit],
      (err, deadlines) => {
        if (err) {
          return res.status(500).json({ error: 'Database error.' });
        }

        res.json(deadlines);
      }
    );
  });

  // Get project status distribution
  router.get('/project-stats', verifyAdminToken, (req, res) => {
    db.all(
      `SELECT status, COUNT(*) as count
       FROM admin_projects
       GROUP BY status`,
      (err, results) => {
        if (err) {
          return res.status(500).json({ error: 'Database error.' });
        }

        res.json(results);
      }
    );
  });

  // Get task status distribution
  router.get('/task-stats', verifyAdminToken, (req, res) => {
    db.all(
      `SELECT status, COUNT(*) as count
       FROM admin_tasks
       GROUP BY status`,
      (err, results) => {
        if (err) {
          return res.status(500).json({ error: 'Database error.' });
        }

        res.json(results);
      }
    );
  });

  return router;
};
