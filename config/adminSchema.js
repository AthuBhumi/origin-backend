const sqlite3 = require('sqlite3').verbose();

// Admin Panel Database Schema
// This creates all tables needed for the admin panel

function initializeAdminDatabase(db) {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Enable foreign keys
      db.run('PRAGMA foreign_keys = ON');

      // 1. Admin Users Table
      db.run(`
        CREATE TABLE IF NOT EXISTS admin_users (
          admin_id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          first_name TEXT NOT NULL,
          last_name TEXT NOT NULL,
          role TEXT NOT NULL CHECK(role IN ('Super Admin', 'Project Manager', 'Team Lead')),
          department TEXT,
          phone TEXT,
          avatar_url TEXT,
          status TEXT DEFAULT 'Active' CHECK(status IN ('Active', 'Inactive')),
          permissions TEXT, -- JSON array
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          last_login DATETIME
        )
      `);

      // 2. Team Members Table
      db.run(`
        CREATE TABLE IF NOT EXISTS team_members (
          member_id INTEGER PRIMARY KEY AUTOINCREMENT,
          first_name TEXT NOT NULL,
          last_name TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          phone TEXT,
          position TEXT NOT NULL,
          department TEXT,
          skills TEXT, -- JSON array
          hourly_rate REAL,
          status TEXT DEFAULT 'Active' CHECK(status IN ('Active', 'On Leave', 'Inactive')),
          reporting_to INTEGER,
          joined_date DATE,
          avatar_url TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (reporting_to) REFERENCES team_members(member_id) ON DELETE SET NULL
        )
      `);

      // 3. Admin Clients Table
      db.run(`
        CREATE TABLE IF NOT EXISTS admin_clients (
          client_id INTEGER PRIMARY KEY AUTOINCREMENT,
          company_name TEXT NOT NULL,
          contact_person TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          phone TEXT,
          address TEXT,
          city TEXT,
          country TEXT,
          website TEXT,
          industry TEXT,
          client_type TEXT,
          total_budget REAL DEFAULT 0,
          total_spent REAL DEFAULT 0,
          status TEXT DEFAULT 'Active' CHECK(status IN ('Active', 'Inactive', 'On Hold')),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // 4. Admin Projects Table
      db.run(`
        CREATE TABLE IF NOT EXISTS admin_projects (
          project_id INTEGER PRIMARY KEY AUTOINCREMENT,
          client_id INTEGER NOT NULL,
          project_name TEXT NOT NULL,
          description TEXT,
          start_date DATE NOT NULL,
          end_date DATE,
          total_budget REAL DEFAULT 0,
          spent_budget REAL DEFAULT 0,
          status TEXT DEFAULT 'Planning' CHECK(status IN ('Planning', 'In Progress', 'Testing', 'Completed', 'On Hold')),
          progress_percentage INTEGER DEFAULT 0 CHECK(progress_percentage >= 0 AND progress_percentage <= 100),
          project_lead_id INTEGER,
          priority TEXT DEFAULT 'Medium' CHECK(priority IN ('Low', 'Medium', 'High', 'Critical')),
          project_type TEXT, -- Website, Mobile, Software, Design, Other
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (client_id) REFERENCES admin_clients(client_id) ON DELETE CASCADE,
          FOREIGN KEY (project_lead_id) REFERENCES team_members(member_id) ON DELETE SET NULL
        )
      `);

      // 5. Admin Milestones Table
      db.run(`
        CREATE TABLE IF NOT EXISTS admin_milestones (
          milestone_id INTEGER PRIMARY KEY AUTOINCREMENT,
          project_id INTEGER NOT NULL,
          milestone_name TEXT NOT NULL,
          description TEXT,
          target_date DATE NOT NULL,
          actual_date DATE,
          status TEXT DEFAULT 'Not Started' CHECK(status IN ('Not Started', 'In Progress', 'Completed')),
          completion_percentage INTEGER DEFAULT 0 CHECK(completion_percentage >= 0 AND completion_percentage <= 100),
          assigned_to INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (project_id) REFERENCES admin_projects(project_id) ON DELETE CASCADE,
          FOREIGN KEY (assigned_to) REFERENCES team_members(member_id) ON DELETE SET NULL
        )
      `);

      // 6. Admin Tasks Table
      db.run(`
        CREATE TABLE IF NOT EXISTS admin_tasks (
          task_id INTEGER PRIMARY KEY AUTOINCREMENT,
          project_id INTEGER NOT NULL,
          milestone_id INTEGER,
          task_name TEXT NOT NULL,
          description TEXT,
          assigned_to INTEGER,
          status TEXT DEFAULT 'To Do' CHECK(status IN ('To Do', 'In Progress', 'Review', 'Completed')),
          priority TEXT DEFAULT 'Medium' CHECK(priority IN ('Low', 'Medium', 'High')),
          due_date DATE,
          estimated_hours REAL,
          actual_hours REAL,
          completion_percentage INTEGER DEFAULT 0 CHECK(completion_percentage >= 0 AND completion_percentage <= 100),
          created_by INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (project_id) REFERENCES admin_projects(project_id) ON DELETE CASCADE,
          FOREIGN KEY (milestone_id) REFERENCES admin_milestones(milestone_id) ON DELETE SET NULL,
          FOREIGN KEY (assigned_to) REFERENCES team_members(member_id) ON DELETE SET NULL,
          FOREIGN KEY (created_by) REFERENCES admin_users(admin_id) ON DELETE SET NULL
        )
      `);

      // 7. Admin Deliverables Table
      db.run(`
        CREATE TABLE IF NOT EXISTS admin_deliverables (
          deliverable_id INTEGER PRIMARY KEY AUTOINCREMENT,
          project_id INTEGER NOT NULL,
          file_name TEXT NOT NULL,
          file_path TEXT NOT NULL,
          file_size INTEGER,
          file_type TEXT,
          description TEXT,
          category TEXT,
          uploaded_by INTEGER,
          visibility TEXT DEFAULT 'Public' CHECK(visibility IN ('Public', 'Private')),
          upload_date DATE DEFAULT CURRENT_DATE,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (project_id) REFERENCES admin_projects(project_id) ON DELETE CASCADE,
          FOREIGN KEY (uploaded_by) REFERENCES team_members(member_id) ON DELETE SET NULL
        )
      `);

      // 8. Admin Messages Table
      db.run(`
        CREATE TABLE IF NOT EXISTS admin_messages (
          message_id INTEGER PRIMARY KEY AUTOINCREMENT,
          project_id INTEGER,
          sender_id INTEGER NOT NULL,
          sender_type TEXT NOT NULL CHECK(sender_type IN ('admin', 'team')),
          receiver_id INTEGER,
          receiver_type TEXT CHECK(receiver_type IN ('admin', 'team', 'client', 'group')),
          message_content TEXT NOT NULL,
          attachment_url TEXT,
          is_read INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (project_id) REFERENCES admin_projects(project_id) ON DELETE CASCADE
        )
      `);

      // 9. Admin Notifications Table
      db.run(`
        CREATE TABLE IF NOT EXISTS admin_notifications (
          notification_id INTEGER PRIMARY KEY AUTOINCREMENT,
          admin_id INTEGER NOT NULL,
          notification_type TEXT NOT NULL,
          title TEXT NOT NULL,
          message TEXT NOT NULL,
          related_project_id INTEGER,
          related_task_id INTEGER,
          is_read INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (admin_id) REFERENCES admin_users(admin_id) ON DELETE CASCADE,
          FOREIGN KEY (related_project_id) REFERENCES admin_projects(project_id) ON DELETE CASCADE,
          FOREIGN KEY (related_task_id) REFERENCES admin_tasks(task_id) ON DELETE CASCADE
        )
      `);

      // 10. Admin Activity Log Table
      db.run(`
        CREATE TABLE IF NOT EXISTS admin_activity_log (
          log_id INTEGER PRIMARY KEY AUTOINCREMENT,
          admin_id INTEGER,
          action_type TEXT NOT NULL,
          entity_type TEXT NOT NULL,
          entity_id INTEGER,
          description TEXT NOT NULL,
          old_value TEXT,
          new_value TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (admin_id) REFERENCES admin_users(admin_id) ON DELETE SET NULL
        )
      `);

      // 11. Admin Invoices Table
      db.run(`
        CREATE TABLE IF NOT EXISTS admin_invoices (
          invoice_id INTEGER PRIMARY KEY AUTOINCREMENT,
          project_id INTEGER NOT NULL,
          client_id INTEGER NOT NULL,
          invoice_number TEXT UNIQUE,
          invoice_amount REAL NOT NULL,
          invoice_date DATE NOT NULL,
          due_date DATE,
          payment_status TEXT DEFAULT 'Pending' CHECK(payment_status IN ('Pending', 'Paid', 'Overdue', 'Cancelled')),
          payment_date DATE,
          notes TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (project_id) REFERENCES admin_projects(project_id) ON DELETE CASCADE,
          FOREIGN KEY (client_id) REFERENCES admin_clients(client_id) ON DELETE CASCADE
        )
      `);

      // 12. Admin Settings Table
      db.run(`
        CREATE TABLE IF NOT EXISTS admin_settings (
          setting_id INTEGER PRIMARY KEY AUTOINCREMENT,
          setting_key TEXT UNIQUE NOT NULL,
          setting_value TEXT,
          setting_type TEXT,
          description TEXT,
          updated_by INTEGER,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (updated_by) REFERENCES admin_users(admin_id) ON DELETE SET NULL
        )
      `);

      // 13. Project Team Assignment Table (Many-to-Many)
      db.run(`
        CREATE TABLE IF NOT EXISTS admin_project_team (
          assignment_id INTEGER PRIMARY KEY AUTOINCREMENT,
          project_id INTEGER NOT NULL,
          member_id INTEGER NOT NULL,
          role TEXT,
          assigned_date DATE DEFAULT CURRENT_DATE,
          removed_date DATE,
          is_active INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (project_id) REFERENCES admin_projects(project_id) ON DELETE CASCADE,
          FOREIGN KEY (member_id) REFERENCES team_members(member_id) ON DELETE CASCADE,
          UNIQUE(project_id, member_id, is_active)
        )
      `);

      // 14. Password Reset Tokens Table
      db.run(`
        CREATE TABLE IF NOT EXISTS admin_password_reset_tokens (
          token_id INTEGER PRIMARY KEY AUTOINCREMENT,
          admin_id INTEGER NOT NULL,
          reset_token TEXT UNIQUE NOT NULL,
          expires_at DATETIME NOT NULL,
          used INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (admin_id) REFERENCES admin_users(admin_id) ON DELETE CASCADE
        )
      `);

      // 15. Admin Login History Table
      db.run(`
        CREATE TABLE IF NOT EXISTS admin_login_history (
          history_id INTEGER PRIMARY KEY AUTOINCREMENT,
          admin_id INTEGER NOT NULL,
          login_time DATETIME DEFAULT CURRENT_TIMESTAMP,
          ip_address TEXT,
          user_agent TEXT,
          success INTEGER DEFAULT 1,
          FOREIGN KEY (admin_id) REFERENCES admin_users(admin_id) ON DELETE CASCADE
        )
      `, (err) => {
        if (err) {
          console.error('❌ Error creating admin database tables:', err);
          reject(err);
        } else {
          console.log('✅ Admin database tables created successfully');
          resolve();
        }
      });

      // Create indexes for better query performance
      db.run('CREATE INDEX IF NOT EXISTS idx_admin_projects_client ON admin_projects(client_id)');
      db.run('CREATE INDEX IF NOT EXISTS idx_admin_projects_lead ON admin_projects(project_lead_id)');
      db.run('CREATE INDEX IF NOT EXISTS idx_admin_tasks_project ON admin_tasks(project_id)');
      db.run('CREATE INDEX IF NOT EXISTS idx_admin_tasks_assigned ON admin_tasks(assigned_to)');
      db.run('CREATE INDEX IF NOT EXISTS idx_admin_messages_project ON admin_messages(project_id)');
      db.run('CREATE INDEX IF NOT EXISTS idx_admin_notifications_admin ON admin_notifications(admin_id)');
      db.run('CREATE INDEX IF NOT EXISTS idx_admin_activity_admin ON admin_activity_log(admin_id)');
    });
  });
}

module.exports = { initializeAdminDatabase };
