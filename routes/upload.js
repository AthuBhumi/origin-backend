const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');

module.exports = () => {
  
  // Upload image
  router.post('/image', upload.single('image'), (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Return the file path
    res.json({
      success: true,
      path: `/uploads/${req.file.filename}`,
      filename: req.file.filename
    });
  });

  return router;
};
