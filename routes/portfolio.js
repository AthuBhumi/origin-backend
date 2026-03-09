const express = require('express');
const router = express.Router();
const db = require('../config/database');
  
  // Get all published/showcase projects for public display
  router.get('/projects', (req, res) => {
    const { category, status = 'Completed', limit = 50 } = req.query;
    
    let query = `
      SELECT 
        p.project_id as id,
        p.project_name,
        p.client_name,
        p.description,
        p.project_type,
        p.industry,
        p.technologies,
        p.start_date,
        p.end_date,
        p.status,
        p.total_budget as budget,
        p.website_url,
        p.showcase_image,
        p.features,
        p.is_featured,
        c.company_name,
        c.industry as client_industry,
        c.website as client_website
      FROM admin_projects p
      LEFT JOIN admin_clients c ON p.client_id = c.client_id
      WHERE p.is_showcase = 1
    `;
    
    const params = [];

    if (category) {
      query += ' AND p.project_type = ?';
      params.push(category);
    }

    if (status) {
      query += ' AND p.status = ?';
      params.push(status);
    }

    query += ' ORDER BY p.is_featured DESC, p.end_date DESC LIMIT ?';
    params.push(parseInt(limit));

    db.all(query, params, (err, projects) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Failed to fetch projects' });
      }

      // Parse JSON fields
      const formattedProjects = projects.map(project => ({
        ...project,
        technologies: project.technologies ? JSON.parse(project.technologies) : [],
        features: project.features ? JSON.parse(project.features) : []
      }));

      res.json({ 
        success: true,
        projects: formattedProjects 
      });
    });
  });

  // Get single project details for public view
  router.get('/projects/:id', (req, res) => {
    const { id } = req.params;

    const query = `
      SELECT 
        p.*,
        c.company_name,
        c.industry as client_industry,
        c.website as client_website
      FROM admin_projects p
      LEFT JOIN admin_clients c ON p.client_id = c.client_id
      WHERE p.project_id = ? AND p.is_showcase = 1
    `;

    db.get(query, [id], (err, project) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Failed to fetch project' });
      }

      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      // Parse JSON fields
      project.technologies = project.technologies ? JSON.parse(project.technologies) : [];
      project.features = project.features ? JSON.parse(project.features) : [];

      // Get milestones for this project
      db.all(
        'SELECT * FROM admin_milestones WHERE project_id = ? ORDER BY due_date',
        [id],
        (err, milestones) => {
          if (err) {
            console.error('Milestones error:', err);
          }

          res.json({ 
            success: true,
            project: {
              ...project,
              milestones: milestones || []
            }
          });
        }
      );
    });
  });

  // Get project statistics for homepage
  router.get('/stats', (req, res) => {
    const queries = {
      totalProjects: 'SELECT COUNT(*) as count FROM admin_projects WHERE is_showcase = 1',
      completedProjects: 'SELECT COUNT(*) as count FROM admin_projects WHERE is_showcase = 1 AND status = "completed"',
      happyClients: 'SELECT COUNT(DISTINCT client_id) as count FROM admin_projects WHERE is_showcase = 1'
    };

    const stats = {};

    db.get(queries.totalProjects, (err, result) => {
      stats.totalProjects = result?.count || 0;

      db.get(queries.completedProjects, (err, result) => {
        stats.completedProjects = result?.count || 0;

        db.get(queries.happyClients, (err, result) => {
          stats.happyClients = result?.count || 0;

          res.json({ success: true, stats });
        });
      });
    });
  });

module.exports = router;
