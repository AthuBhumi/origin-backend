const express = require('express');
const router = express.Router();
const { verifyAdminToken } = require('../middleware/adminAuth');

module.exports = (db) => {
  
  // Project Status Report
  router.get('/project-status', verifyAdminToken, (req, res) => {
    const report = {};

    // Project count by status
    db.all(
      'SELECT status, COUNT(*) as count FROM admin_projects GROUP BY status',
      (err, statusCounts) => {
        report.statusDistribution = statusCounts || [];

        // Total projects
        db.get(
          'SELECT COUNT(*) as total FROM admin_projects',
          (err, result) => {
            report.totalProjects = result?.total || 0;

            // On-time vs delayed
            db.get(
              `SELECT 
                SUM(CASE WHEN end_date >= DATE('now') OR status = 'Completed' THEN 1 ELSE 0 END) as onTime,
                SUM(CASE WHEN end_date < DATE('now') AND status != 'Completed' THEN 1 ELSE 0 END) as delayed
               FROM admin_projects`,
              (err, result) => {
                report.onTimeProjects = result?.onTime || 0;
                report.delayedProjects = result?.delayed || 0;

                // Completion rate
                db.get(
                  `SELECT 
                    (SELECT COUNT(*) FROM admin_projects WHERE status = 'Completed') * 100.0 / 
                    (SELECT COUNT(*) FROM admin_projects) as completionRate`,
                  (err, result) => {
                    report.completionRate = result?.completionRate || 0;

                    res.json(report);
                  }
                );
              }
            );
          }
        );
      }
    );
  });

  // Financial Report
  router.get('/financial', verifyAdminToken, (req, res) => {
    const report = {};

    // Total budget and spending
    db.get(
      'SELECT SUM(total_budget) as totalBudget, SUM(spent_budget) as totalSpent FROM admin_projects',
      (err, result) => {
        report.totalBudget = result?.totalBudget || 0;
        report.totalSpent = result?.totalSpent || 0;
        report.remainingBudget = (result?.totalBudget || 0) - (result?.totalSpent || 0);
        report.utilizationRate = result?.totalBudget ? ((result?.totalSpent / result?.totalBudget) * 100) : 0;

        // Budget by project
        db.all(
          `SELECT p.project_name, p.total_budget, p.spent_budget, 
                  (p.spent_budget * 100.0 / p.total_budget) as utilization,
                  c.company_name as client_name
           FROM admin_projects p
           JOIN admin_clients c ON p.client_id = c.client_id
           ORDER BY p.spent_budget DESC
           LIMIT 10`,
          (err, projects) => {
            report.topSpendingProjects = projects || [];

            // Revenue by client
            db.all(
              `SELECT c.company_name, c.total_budget, c.total_spent,
                      COUNT(p.project_id) as project_count
               FROM admin_clients c
               LEFT JOIN admin_projects p ON c.client_id = p.client_id
               GROUP BY c.client_id
               ORDER BY c.total_spent DESC
               LIMIT 10`,
              (err, clients) => {
                report.topClients = clients || [];

                res.json(report);
              }
            );
          }
        );
      }
    );
  });

  // Team Performance Report
  router.get('/team-performance', verifyAdminToken, (req, res) => {
    const report = {};

    // Total team members
    db.get(
      'SELECT COUNT(*) as total FROM team_members WHERE status = "Active"',
      (err, result) => {
        report.activeTeamMembers = result?.total || 0;

        // Tasks by team member
        db.all(
          `SELECT tm.member_id, tm.first_name || ' ' || tm.last_name as name,
                  COUNT(t.task_id) as totalTasks,
                  SUM(CASE WHEN t.status = 'Completed' THEN 1 ELSE 0 END) as completedTasks,
                  SUM(CASE WHEN t.status = 'Completed' THEN 1 ELSE 0 END) * 100.0 / COUNT(t.task_id) as completionRate
           FROM team_members tm
           LEFT JOIN admin_tasks t ON tm.member_id = t.assigned_to
           WHERE tm.status = 'Active'
           GROUP BY tm.member_id
           ORDER BY completedTasks DESC`,
          (err, members) => {
            report.teamPerformance = members || [];

            // Workload distribution
            db.all(
              `SELECT tm.first_name || ' ' || tm.last_name as name,
                      COUNT(t.task_id) as activeTasks
               FROM team_members tm
               LEFT JOIN admin_tasks t ON tm.member_id = t.assigned_to
               WHERE tm.status = 'Active' AND t.status != 'Completed'
               GROUP BY tm.member_id
               ORDER BY activeTasks DESC`,
              (err, workload) => {
                report.workloadDistribution = workload || [];

                res.json(report);
              }
            );
          }
        );
      }
    );
  });

  // Client Satisfaction Report
  router.get('/client-satisfaction', verifyAdminToken, (req, res) => {
    const report = {};

    // Active clients
    db.get(
      'SELECT COUNT(*) as total FROM admin_clients WHERE status = "Active"',
      (err, result) => {
        report.activeClients = result?.total || 0;

        // Projects per client
        db.all(
          `SELECT c.company_name, c.email,
                  COUNT(p.project_id) as totalProjects,
                  SUM(CASE WHEN p.status = 'Completed' THEN 1 ELSE 0 END) as completedProjects,
                  SUM(p.total_budget) as totalBudget,
                  SUM(p.spent_budget) as totalSpent
           FROM admin_clients c
           LEFT JOIN admin_projects p ON c.client_id = p.client_id
           GROUP BY c.client_id
           ORDER BY totalProjects DESC`,
          (err, clients) => {
            report.clientProjects = clients || [];

            // Client retention (clients with multiple projects)
            db.get(
              `SELECT COUNT(*) as retainedClients
               FROM (
                 SELECT client_id, COUNT(*) as project_count
                 FROM admin_projects
                 GROUP BY client_id
                 HAVING project_count > 1
               )`,
              (err, result) => {
                report.retainedClients = result?.retainedClients || 0;
                report.retentionRate = report.activeClients ? 
                  ((result?.retainedClients / report.activeClients) * 100) : 0;

                res.json(report);
              }
            );
          }
        );
      }
    );
  });

  // Export report (placeholder - would integrate with PDF/Excel library)
  router.post('/export', verifyAdminToken, (req, res) => {
    const { reportType, format } = req.body;

    if (!reportType || !format) {
      return res.status(400).json({ error: 'Report type and format are required.' });
    }

    // In production, this would generate PDF/Excel using libraries like:
    // - pdfkit, puppeteer (PDF)
    // - exceljs, xlsx (Excel)
    
    res.json({
      message: 'Export functionality - to be implemented',
      reportType,
      format,
      note: 'Integrate with PDF/Excel generation library'
    });
  });

  return router;
};
