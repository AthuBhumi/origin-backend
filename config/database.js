const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, '../database.db');
const db = new sqlite3.Database(dbPath);

// Initialize database with tables
const initDatabase = () => {
  db.serialize(() => {
    // Admin users table
    db.run(`
      CREATE TABLE IF NOT EXISTS admins (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        name TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Products table
    db.run(`
      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        price REAL NOT NULL,
        category TEXT,
        features TEXT,
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Product images table
    db.run(`
      CREATE TABLE IF NOT EXISTS product_images (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        image_url TEXT NOT NULL,
        is_primary INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      )
    `);

    // Enquiries table
    db.run(`
      CREATE TABLE IF NOT EXISTS enquiries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT NOT NULL,
        service_interest TEXT,
        message TEXT NOT NULL,
        status TEXT DEFAULT 'new',
        is_read INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create default admin user
    const defaultAdminEmail = process.env.ADMIN_EMAIL || 'admin@itcompany.com';
    const defaultAdminPassword = process.env.ADMIN_PASSWORD || 'Admin@123';
    
    db.get('SELECT * FROM admins WHERE email = ?', [defaultAdminEmail], (err, row) => {
      if (!row) {
        bcrypt.hash(defaultAdminPassword, 10, (err, hash) => {
          if (err) {
            console.error('Error hashing password:', err);
            return;
          }
          db.run(
            'INSERT INTO admins (email, password, name) VALUES (?, ?, ?)',
            [defaultAdminEmail, hash, 'Admin'],
            (err) => {
              if (err) {
                console.error('Error creating default admin:', err);
              } else {
                console.log('✅ Default admin created successfully');
                console.log('📧 Email:', defaultAdminEmail);
                console.log('🔑 Password:', defaultAdminPassword);
              }
            }
          );
        });
      }
    });

    console.log('✅ Database initialized successfully');
  });
};

initDatabase();

module.exports = db;
