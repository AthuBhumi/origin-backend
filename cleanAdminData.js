const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const path = require('path');

const DB_PATH = path.join(__dirname, 'adminpanel.db');

async function cleanAdminData() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH, async (err) => {
      if (err) {
        console.error('Error opening database:', err);
        reject(err);
        return;
      }

      console.log('\n🧹 Cleaning Admin Panel Database...\n');

      try {
        // Keep only the super admin, delete all dummy data
        const adminPasswordHash = await bcrypt.hash('admin123', 10);

        // Delete all data first
        db.serialize(() => {
          // Delete in correct order (respecting foreign keys)
          db.run('DELETE FROM admin_messages', (err) => {
            if (err) console.error('Error deleting messages:', err);
            else console.log('✅ Deleted all messages');
          });

          db.run('DELETE FROM admin_deliverables', (err) => {
            if (err) console.error('Error deleting deliverables:', err);
            else console.log('✅ Deleted all deliverables');
          });

          db.run('DELETE FROM admin_tasks', (err) => {
            if (err) console.error('Error deleting tasks:', err);
            else console.log('✅ Deleted all tasks');
          });

          db.run('DELETE FROM admin_milestones', (err) => {
            if (err) console.error('Error deleting milestones:', err);
            else console.log('✅ Deleted all milestones');
          });

          db.run('DELETE FROM admin_project_team', (err) => {
            if (err) console.error('Error deleting project team:', err);
            else console.log('✅ Deleted all project team assignments');
          });

          db.run('DELETE FROM admin_projects', (err) => {
            if (err) console.error('Error deleting projects:', err);
            else console.log('✅ Deleted all projects');
          });

          db.run('DELETE FROM admin_clients', (err) => {
            if (err) console.error('Error deleting clients:', err);
            else console.log('✅ Deleted all clients');
          });

          db.run('DELETE FROM team_members', (err) => {
            if (err) console.error('Error deleting team members:', err);
            else console.log('✅ Deleted all team members');
          });

          db.run('DELETE FROM admin_activity_logs', (err) => {
            if (err) console.error('Error deleting activity logs:', err);
            else console.log('✅ Deleted all activity logs');
          });

          // Delete all admin users except we'll recreate the super admin
          db.run('DELETE FROM admin_users', (err) => {
            if (err) console.error('Error deleting admin users:', err);
            else console.log('✅ Deleted all admin users');
          });

          // Create fresh super admin
          setTimeout(() => {
            db.run(
              `INSERT INTO admin_users (email, password_hash, first_name, last_name, role, department, status, permissions)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              ['admin@company.com', adminPasswordHash, 'Admin', 'User', 'Super Admin', 'Management', 'Active', JSON.stringify(['all'])],
              function(err) {
                if (err) {
                  console.error('Error creating admin:', err);
                } else {
                  console.log('\n✅ Created clean Super Admin account');
                }
              }
            );

            setTimeout(() => {
              db.close((err) => {
                if (err) {
                  console.error('Error closing database:', err);
                  reject(err);
                } else {
                  console.log('\n═══════════════════════════════════════');
                  console.log('🎉 ADMIN PANEL CLEANED SUCCESSFULLY');
                  console.log('═══════════════════════════════════════');
                  console.log('All dummy data removed!');
                  console.log('');
                  console.log('Login Credentials:');
                  console.log('Email:    admin@company.com');
                  console.log('Password: admin123');
                  console.log('═══════════════════════════════════════\n');
                  console.log('🌐 Access: http://localhost:3000/admin/login\n');
                  resolve();
                }
              });
            }, 500);
          }, 500);
        });

      } catch (error) {
        console.error('Error during cleaning:', error);
        db.close();
        reject(error);
      }
    });
  });
}

// Run the cleaner
if (require.main === module) {
  cleanAdminData()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Cleaning failed:', err);
      process.exit(1);
    });
}

module.exports = { cleanAdminData };
