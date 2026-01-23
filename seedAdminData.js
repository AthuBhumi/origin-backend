const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const path = require('path');

const DB_PATH = path.join(__dirname, 'adminpanel.db');

async function seedAdminData() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH, async (err) => {
      if (err) {
        console.error('Error opening database:', err);
        reject(err);
        return;
      }

      console.log('\n🌱 Seeding Admin Panel Database...\n');

      try {
        // 1. Create admin users
        const adminPasswordHash = await bcrypt.hash('admin123', 10);
        const managerPasswordHash = await bcrypt.hash('manager123', 10);

        db.run(
          `INSERT INTO admin_users (email, password_hash, first_name, last_name, role, department, status, permissions)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          ['admin@company.com', adminPasswordHash, 'John', 'Admin', 'Super Admin', 'Management', 'Active', JSON.stringify(['all'])],
          function(err) {
            if (err && !err.message.includes('UNIQUE')) {
              console.error('Error creating admin:', err);
            } else {
              console.log('✅ Super Admin created');
              console.log('   Email: admin@company.com');
              console.log('   Password: admin123');
            }
          }
        );

        db.run(
          `INSERT INTO admin_users (email, password_hash, first_name, last_name, role, department, status, permissions)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          ['manager@company.com', managerPasswordHash, 'Sarah', 'Manager', 'Project Manager', 'Projects', 'Active', JSON.stringify(['projects', 'tasks', 'team'])],
          function(err) {
            if (err && !err.message.includes('UNIQUE')) {
              console.error('Error creating manager:', err);
            } else {
              console.log('✅ Project Manager created');
              console.log('   Email: manager@company.com');
              console.log('   Password: manager123');
            }
          }
        );

        // 2. Create team members
        db.run(
          `INSERT INTO team_members (first_name, last_name, email, phone, position, department, skills, hourly_rate, status, joined_date)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, DATE('now'))`,
          ['Mike', 'Developer', 'mike@company.com', '+1234567890', 'Senior Developer', 'Engineering', JSON.stringify(['React', 'Node.js', 'Python']), 75, 'Active'],
          function(err) {
            if (err && !err.message.includes('UNIQUE')) console.error(err);
            else console.log('✅ Team Member 1: Mike Developer');
          }
        );

        db.run(
          `INSERT INTO team_members (first_name, last_name, email, phone, position, department, skills, hourly_rate, status, joined_date)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, DATE('now'))`,
          ['Emily', 'Designer', 'emily@company.com', '+1234567891', 'UI/UX Designer', 'Design', JSON.stringify(['Figma', 'Adobe XD', 'Photoshop']), 65, 'Active'],
          function(err) {
            if (err && !err.message.includes('UNIQUE')) console.error(err);
            else console.log('✅ Team Member 2: Emily Designer');
          }
        );

        db.run(
          `INSERT INTO team_members (first_name, last_name, email, phone, position, department, skills, hourly_rate, status, joined_date)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, DATE('now'))`,
          ['Alex', 'Tester', 'alex@company.com', '+1234567892', 'QA Engineer', 'QA', JSON.stringify(['Manual Testing', 'Automation', 'Selenium']), 55, 'Active'],
          function(err) {
            if (err && !err.message.includes('UNIQUE')) console.error(err);
            else console.log('✅ Team Member 3: Alex Tester');
          }
        );

        // Wait a bit for team members to be inserted
        setTimeout(() => {
          // 3. Create clients
          db.run(
            `INSERT INTO admin_clients (company_name, contact_person, email, phone, address, city, country, website, industry, client_type, total_budget, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            ['Tech Startup Inc', 'Robert Johnson', 'robert@techstartup.com', '+1234567893', '123 Tech St', 'San Francisco', 'USA', 'https://techstartup.com', 'Technology', 'Enterprise', 100000, 'Active'],
            function(err) {
              if (err && !err.message.includes('UNIQUE')) {
                console.error('Error creating client 1:', err);
              } else {
                console.log('\n✅ Client 1: Tech Startup Inc');
                
                const client1Id = this.lastID;

                // Create project for client 1
                db.run(
                  `INSERT INTO admin_projects (client_id, project_name, description, start_date, end_date, total_budget, spent_budget, status, progress_percentage, project_lead_id, priority, project_type)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                  [client1Id, 'E-Commerce Platform', 'Full-stack e-commerce platform with React and Node.js', '2026-01-01', '2026-06-30', 50000, 15000, 'In Progress', 35, 1, 'High', 'Website'],
                  function(err) {
                    if (err) {
                      console.error('Error creating project:', err);
                    } else {
                      console.log('   ✅ Project: E-Commerce Platform');
                      
                      const projectId = this.lastID;

                      // Create milestones
                      db.run(
                        `INSERT INTO admin_milestones (project_id, milestone_name, description, target_date, status, completion_percentage, assigned_to)
                         VALUES (?, ?, ?, ?, ?, ?, ?)`,
                        [projectId, 'Backend API Development', 'Complete REST API development', '2026-03-15', 'In Progress', 60, 1]
                      );

                      db.run(
                        `INSERT INTO admin_milestones (project_id, milestone_name, description, target_date, status, completion_percentage, assigned_to)
                         VALUES (?, ?, ?, ?, ?, ?, ?)`,
                        [projectId, 'Frontend Development', 'React frontend implementation', '2026-05-15', 'Not Started', 0, 2]
                      );

                      // Create tasks
                      db.run(
                        `INSERT INTO admin_tasks (project_id, milestone_id, task_name, description, assigned_to, status, priority, due_date, estimated_hours, actual_hours, completion_percentage, created_by)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [projectId, 1, 'Setup Database Schema', 'Design and implement database structure', 1, 'Completed', 'High', '2026-02-01', 16, 14, 100, 1]
                      );

                      db.run(
                        `INSERT INTO admin_tasks (project_id, milestone_id, task_name, description, assigned_to, status, priority, due_date, estimated_hours, completion_percentage, created_by)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [projectId, 1, 'Implement Authentication API', 'JWT-based authentication', 1, 'In Progress', 'High', '2026-02-15', 24, 50, 1]
                      );

                      db.run(
                        `INSERT INTO admin_tasks (project_id, milestone_id, task_name, description, assigned_to, status, priority, due_date, estimated_hours, completion_percentage, created_by)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [projectId, 2, 'Design UI Mockups', 'Create Figma designs for all pages', 2, 'To Do', 'Medium', '2026-03-01', 40, 0, 1]
                      );

                      console.log('   ✅ Milestones & Tasks created');

                      // Create deliverable
                      db.run(
                        `INSERT INTO admin_deliverables (project_id, file_name, file_path, file_size, file_type, description, category, uploaded_by, visibility)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [projectId, 'Database_Schema.pdf', 'db-schema-123.pdf', 256000, 'application/pdf', 'Database design document', 'Documentation', 1, 'Public'],
                        function(err) {
                          if (!err) console.log('   ✅ Deliverable uploaded');
                        }
                      );

                      // Add team to project
                      db.run(
                        `INSERT INTO admin_project_team (project_id, member_id, role)
                         VALUES (?, ?, ?)`,
                        [projectId, 1, 'Lead Developer']
                      );

                      db.run(
                        `INSERT INTO admin_project_team (project_id, member_id, role)
                         VALUES (?, ?, ?)`,
                        [projectId, 2, 'UI Designer']
                      );
                    }
                  }
                );
              }
            }
          );

          db.run(
            `INSERT INTO admin_clients (company_name, contact_person, email, phone, address, city, country, website, industry, client_type, total_budget, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            ['Global Corp', 'Lisa Chen', 'lisa@globalcorp.com', '+1234567894', '456 Business Ave', 'New York', 'USA', 'https://globalcorp.com', 'Finance', 'Enterprise', 150000, 'Active'],
            function(err) {
              if (err && !err.message.includes('UNIQUE')) {
                console.error('Error creating client 2:', err);
              } else {
                console.log('\n✅ Client 2: Global Corp');
                
                const client2Id = this.lastID;

                // Create project for client 2
                db.run(
                  `INSERT INTO admin_projects (client_id, project_name, description, start_date, end_date, total_budget, spent_budget, status, progress_percentage, project_lead_id, priority, project_type)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                  [client2Id, 'Mobile Banking App', 'iOS and Android banking application', '2026-02-01', '2026-08-31', 80000, 5000, 'Planning', 10, 1, 'Critical', 'Mobile'],
                  function(err) {
                    if (!err) {
                      console.log('   ✅ Project: Mobile Banking App');
                    }
                  }
                );
              }
            }
          );

          // Create messages
          setTimeout(() => {
            db.run(
              `INSERT INTO admin_messages (project_id, sender_id, sender_type, receiver_id, receiver_type, message_content)
               VALUES (?, ?, ?, ?, ?, ?)`,
              [1, 1, 'admin', 1, 'team', 'Great progress on the authentication API! Keep it up.']
            );

            db.run(
              `INSERT INTO admin_messages (project_id, sender_id, sender_type, receiver_id, receiver_type, message_content)
               VALUES (?, ?, ?, ?, ?, ?)`,
              [1, 1, 'admin', null, 'client', 'Project is progressing well. Backend API is 60% complete.']
            );

            console.log('\n✅ Messages created');
          }, 500);

        }, 500);

        setTimeout(() => {
          db.close((err) => {
            if (err) {
              console.error('Error closing database:', err);
              reject(err);
            } else {
              console.log('\n═══════════════════════════════════════');
              console.log('📧 ADMIN LOGIN CREDENTIALS');
              console.log('═══════════════════════════════════════');
              console.log('Super Admin:');
              console.log('Email:    admin@company.com');
              console.log('Password: admin123');
              console.log('');
              console.log('Project Manager:');
              console.log('Email:    manager@company.com');
              console.log('Password: manager123');
              console.log('═══════════════════════════════════════\n');
              console.log('🌐 Access the admin panel at:');
              console.log('http://localhost:3000/admin/login\n');
              console.log('✅ Database closed successfully\n');
              resolve();
            }
          });
        }, 2000);

      } catch (error) {
        console.error('Error during seeding:', error);
        db.close();
        reject(error);
      }
    });
  });
}

// Run the seeder
if (require.main === module) {
  seedAdminData()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Seeding failed:', err);
      process.exit(1);
    });
}

module.exports = { seedAdminData };
