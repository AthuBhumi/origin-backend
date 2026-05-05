require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');
const sqlite3 = require('sqlite3').verbose();

// Import database configuration (initializes DB)
require('./config/database');

// Import public routes
const productRoutes = require('./routes/products');
const enquiryRoutes = require('./routes/enquiries');
const portfolioRoutes = require('./routes/portfolio');
const blogRoutes = require('./routes/blogs');
const caseStudyRoutes = require('./routes/caseStudies');

// Import admin routes
const adminAuthRoutes = require('./routes/adminAuth');
const adminProductRoutes = require('./routes/adminProducts');
const adminEnquiryRoutes = require('./routes/adminEnquiries');
const adminBlogRoutes = require('./routes/adminBlogs');
const adminCaseStudyRoutes = require('./routes/adminCaseStudies');
const uploadRoutes = require('./routes/upload');
const trialSignupRoutes = require('./routes/trialSignups');
const productPlanRoutes = require('./routes/productPlans');

const app = express();

// CORS Configuration for Production & Development
const corsOptions = {
  origin: [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:5000',
    'https://originplatforms.co',
    'http://originplatforms.co',
    'https://www.originplatforms.co',
    'http://www.originplatforms.co',
    'https://admin.originplatforms.co',
    'http://admin.originplatforms.co'
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

// Public routes
app.use('/api/products', productRoutes);
app.use('/api/enquiries', enquiryRoutes);
app.use('/api/portfolio', portfolioRoutes);
app.use('/api/blogs', blogRoutes);
app.use('/api/case-studies', caseStudyRoutes);
app.use('/api/trial-signups', trialSignupRoutes);
app.use('/api/product-plans', productPlanRoutes);

// Admin routes
app.use('/api/admin/auth', adminAuthRoutes);
app.use('/api/admin/products', adminProductRoutes);
app.use('/api/admin/enquiries', adminEnquiryRoutes);
app.use('/api/admin/blogs', adminBlogRoutes);
app.use('/api/admin/case-studies', adminCaseStudyRoutes);
app.use('/api/admin/upload', uploadRoutes());
app.use('/api/admin/trial-signups', trialSignupRoutes);
app.use('/api/admin/product-plans', productPlanRoutes);

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
