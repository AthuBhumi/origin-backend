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
        image TEXT,
        status TEXT DEFAULT 'active',
        product_type TEXT DEFAULT 'product',
        trial_days INTEGER DEFAULT 0,
        trial_url TEXT,
        demo_url TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Add trial columns to existing products table (migration)
    db.run(`ALTER TABLE products ADD COLUMN product_type TEXT DEFAULT 'product'`, () => {});
    db.run(`ALTER TABLE products ADD COLUMN trial_days INTEGER DEFAULT 0`, () => {});
    db.run(`ALTER TABLE products ADD COLUMN trial_url TEXT`, () => {});
    db.run(`ALTER TABLE products ADD COLUMN demo_url TEXT`, () => {});
    db.run(`ALTER TABLE products ADD COLUMN card_template TEXT DEFAULT 'classic'`, () => {});

    // Trial signups table
    db.run(`
      CREATE TABLE IF NOT EXISTS trial_signups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT,
        company TEXT,
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      )
    `);

    // Product plans table (Free Trial / Pro / Enterprise pricing tiers)
    db.run(`
      CREATE TABLE IF NOT EXISTS product_plans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        price REAL DEFAULT 0,
        billing_cycle TEXT DEFAULT 'monthly',
        description TEXT,
        features TEXT,
        limits TEXT,
        is_popular INTEGER DEFAULT 0,
        sort_order INTEGER DEFAULT 0,
        cta_text TEXT DEFAULT 'Get Started',
        cta_url TEXT,
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
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

    // Blogs table
    db.run(`
      CREATE TABLE IF NOT EXISTS blogs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        content TEXT NOT NULL,
        excerpt TEXT,
        cover_image TEXT,
        category TEXT,
        tags TEXT,
        author TEXT DEFAULT 'Admin',
        status TEXT DEFAULT 'draft',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Case Studies table
    db.run(`
      CREATE TABLE IF NOT EXISTS case_studies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        client_name TEXT,
        industry TEXT,
        challenge TEXT,
        solution TEXT,
        results TEXT,
        cover_image TEXT,
        technologies TEXT,
        testimonial TEXT,
        status TEXT DEFAULT 'draft',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create default admin
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@originplatforms.co';
    const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123';

    db.get('SELECT * FROM admins WHERE email = ?', [adminEmail], (err, row) => {
      if (!row) {
        bcrypt.hash(adminPassword, 10, (err, hash) => {
          if (err) return;
          db.run('INSERT INTO admins (email, password, name) VALUES (?, ?, ?)',
            [adminEmail, hash, 'Admin']);
        });
      }
    });

    console.log('✅ Database initialized successfully');
  });
};

initDatabase();

module.exports = db;
