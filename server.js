require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');
const sqlite3 = require('sqlite3').verbose();

// Import database configuration (initializes DB)
require('./config/database');

// Import and initialize admin panel database
const { initializeAdminDatabase } = require('./config/adminSchema');

// Import public routes
const productRoutes = require('./routes/products');
const enquiryRoutes = require('./routes/enquiries');

// Import admin panel routes
const adminAuthRoutes = require('./routes/adminAuth');
const adminClientsRoutes = require('./routes/adminClients');
const adminProjectsRoutes = require('./routes/adminProjects');
const adminMilestonesTasksRoutes = require('./routes/adminMilestonesTasks');
const adminDeliverablesRoutes = require('./routes/adminDeliverables');
const adminTeamRoutes = require('./routes/adminTeam');
const adminMessagesRoutes = require('./routes/adminMessages');
const adminReportsRoutes = require('./routes/adminReports');
const adminDashboardRoutes = require('./routes/adminDashboard');

const app = express();

// CORS Configuration for Production
const corsOptions = {
  origin: [
    'https://originplatforms.co',
    'http://originplatforms.co',
    'https://www.originplatforms.co',
    'http://www.originplatforms.co'
  ],
  credentials: true,
  optionsSuccessStatus: 200
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});

// Apply rate limiting to all routes
app.use('/api/', limiter);

// Initialize admin panel database
const ADMIN_DB_PATH = path.join(__dirname, 'adminpanel.db');
let adminDb = new sqlite3.Database(ADMIN_DB_PATH, (err) => {
  if (err) {
    console.error('❌ Error connecting to admin database:', err);
  } else {
    console.log('✅ Connected to admin database');
    initializeAdminDatabase(adminDb)
      .then(() => {
        console.log('✅ Admin Panel database initialized successfully');
        // Store admin db in app locals for access in routes
        app.locals.adminDb = adminDb;
      })
      .catch(err => {
        console.error('❌ Error initializing admin panel database:', err);
      });
  }
});

// Public routes
app.use('/api/products', productRoutes);
app.use('/api/enquiries', enquiryRoutes);

// Admin panel routes
app.use('/api/admin/auth', (req, res, next) => {
  adminAuthRoutes(adminDb)(req, res, next);
});

app.use('/api/admin/clients', (req, res, next) => {
  adminClientsRoutes(adminDb)(req, res, next);
});

app.use('/api/admin/projects', (req, res, next) => {
  adminProjectsRoutes(adminDb)(req, res, next);
});

app.use('/api/admin/milestones-tasks', (req, res, next) => {
  adminMilestonesTasksRoutes(adminDb)(req, res, next);
});

app.use('/api/admin/deliverables', (req, res, next) => {
  adminDeliverablesRoutes(adminDb)(req, res, next);
});

app.use('/api/admin/team', (req, res, next) => {
  adminTeamRoutes(adminDb)(req, res, next);
});

app.use('/api/admin/messages', (req, res, next) => {
  adminMessagesRoutes(adminDb)(req, res, next);
});

app.use('/api/admin/reports', (req, res, next) => {
  adminReportsRoutes(adminDb)(req, res, next);
});

app.use('/api/admin/dashboard', (req, res, next) => {
  adminDashboardRoutes(adminDb)(req, res, next);
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'IT Company API is running',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    success: false, 
    message: 'API endpoint not found' 
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error'
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log('');
  console.log('🚀 ========================================');
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`🌐 API URL: http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log('🚀 ========================================');
  console.log('');
});
