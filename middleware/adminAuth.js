const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-admin-secret-key-change-this-in-production';
const JWT_EXPIRES_IN = '24h';
const REFRESH_TOKEN_EXPIRES_IN = '7d';

// Verify admin JWT token
function verifyAdminToken(req, res, next) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ 
        error: 'Access denied. No token provided.' 
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Check if this is an admin token
    if (decoded.userType !== 'admin') {
      return res.status(403).json({ 
        error: 'Access denied. Admin privileges required.' 
      });
    }

    req.admin = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'Token expired. Please login again.' 
      });
    }
    
    return res.status(401).json({ 
      error: 'Invalid token.' 
    });
  }
}

// Role-based access control middleware
function checkRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.admin) {
      return res.status(401).json({ 
        error: 'Authentication required.' 
      });
    }

    if (!allowedRoles.includes(req.admin.role)) {
      return res.status(403).json({ 
        error: `Access denied. Required role: ${allowedRoles.join(' or ')}. Your role: ${req.admin.role}` 
      });
    }

    next();
  };
}

// Permission-based access control
function checkPermission(requiredPermission) {
  return (req, res, next) => {
    if (!req.admin) {
      return res.status(401).json({ 
        error: 'Authentication required.' 
      });
    }

    // Super Admin has all permissions
    if (req.admin.role === 'Super Admin') {
      return next();
    }

    // Check if admin has the required permission
    const adminPermissions = req.admin.permissions || [];
    
    if (!adminPermissions.includes(requiredPermission)) {
      return res.status(403).json({ 
        error: `Access denied. Required permission: ${requiredPermission}` 
      });
    }

    next();
  };
}

// Verify admin owns or has access to a project
function verifyProjectAccess(req, res, next) {
  const projectId = req.params.projectId || req.params.id || req.body.project_id;
  
  if (!projectId) {
    return res.status(400).json({ 
      error: 'Project ID is required.' 
    });
  }

  const db = req.app.locals.adminDb;
  
  // Super Admin can access all projects
  if (req.admin.role === 'Super Admin') {
    return next();
  }

  // Check if admin is assigned to this project (as team lead or team member)
  db.get(
    `SELECT p.project_id, p.project_lead_id, apt.member_id
     FROM admin_projects p
     LEFT JOIN admin_project_team apt ON p.project_id = apt.project_id AND apt.is_active = 1
     LEFT JOIN team_members tm ON apt.member_id = tm.member_id
     WHERE p.project_id = ? AND (
       p.project_lead_id = (SELECT member_id FROM team_members WHERE email = ?) OR
       tm.email = ?
     )`,
    [projectId, req.admin.email, req.admin.email],
    (err, project) => {
      if (err) {
        return res.status(500).json({ 
          error: 'Database error while checking project access.' 
        });
      }

      if (!project) {
        return res.status(403).json({ 
          error: 'Access denied. You do not have access to this project.' 
        });
      }

      next();
    }
  );
}

// Generate admin JWT token
function generateAdminToken(admin, rememberMe = false) {
  const expiresIn = rememberMe ? REFRESH_TOKEN_EXPIRES_IN : JWT_EXPIRES_IN;
  
  return jwt.sign(
    {
      adminId: admin.admin_id,
      email: admin.email,
      role: admin.role,
      permissions: admin.permissions ? JSON.parse(admin.permissions) : [],
      firstName: admin.first_name,
      lastName: admin.last_name,
      userType: 'admin'
    },
    JWT_SECRET,
    { expiresIn }
  );
}

// Generate refresh token
function generateRefreshToken(admin) {
  return jwt.sign(
    {
      adminId: admin.admin_id,
      email: admin.email,
      userType: 'admin'
    },
    JWT_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRES_IN }
  );
}

// Log admin activity
function logActivity(db, adminId, actionType, entityType, entityId, description, oldValue = null, newValue = null) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO admin_activity_log 
       (admin_id, action_type, entity_type, entity_id, description, old_value, new_value) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [adminId, actionType, entityType, entityId, description, oldValue, newValue],
      (err) => {
        if (err) {
          console.error('Error logging activity:', err);
          reject(err);
        } else {
          resolve();
        }
      }
    );
  });
}

// Activity logging middleware
function logAdminActivity(actionType, entityType) {
  return async (req, res, next) => {
    const originalJson = res.json.bind(res);
    
    res.json = function(data) {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const entityId = req.params.id || req.body.id || data.id || null;
        const description = `${actionType} ${entityType}`;
        
        const db = req.app.locals.adminDb;
        
        logActivity(
          db,
          req.admin?.adminId,
          actionType,
          entityType,
          entityId,
          description
        ).catch(err => console.error('Failed to log activity:', err));
      }
      
      return originalJson(data);
    };
    
    next();
  };
}

module.exports = {
  verifyAdminToken,
  checkRole,
  checkPermission,
  verifyProjectAccess,
  generateAdminToken,
  generateRefreshToken,
  logActivity,
  logAdminActivity,
  JWT_SECRET
};
