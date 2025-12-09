const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { translateToScratch, UnsupportedFeatureError } = require('../translator');
const { createSB3File } = require('../translator/sb3Builder');

const app = express();

// Configure multer with file size limit (1MB) and file filter
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 1 * 1024 * 1024, // 1MB limit
  },
  fileFilter: (req, file, cb) => {
    // Only accept .js files
    if (file.mimetype === 'text/javascript' || 
        file.mimetype === 'application/javascript' ||
        file.originalname.endsWith('.js')) {
      cb(null, true);
    } else {
      cb(new Error('Only JavaScript files (.js) are allowed'));
    }
  }
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json({ limit: '1mb' })); // Limit JSON body size

// API endpoint for translation
// NOTE: For production use, consider adding rate limiting middleware (e.g., express-rate-limit)
// to prevent abuse of file system operations
app.post('/api/translate', upload.single('file'), async (req, res) => {
  try {
    let code;

    if (req.file) {
      // File upload - validate content
      if (req.file.size === 0) {
        return res.status(400).json({
          success: false,
          error: 'Empty file provided',
        });
      }
      
      code = req.file.buffer.toString('utf-8');
      
      // Basic content validation - check if it's valid UTF-8 text
      if (!code || code.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: 'File does not contain valid text content',
        });
      }
    } else if (req.body.code) {
      // Direct code submission
      code = req.body.code;
    } else {
      return res.status(400).json({
        success: false,
        error: 'No code provided',
      });
    }

    // Translate to Scratch
    const result = translateToScratch(code);

    // Create temporary .sb3 file with unique identifier
    const uniqueId = crypto.randomUUID();
    const tempFilePath = path.join(__dirname, `../../temp-${uniqueId}.sb3`);
    
    try {
      await createSB3File(result.project, tempFilePath);
      
      // Send the .sb3 file as download
      res.download(tempFilePath, 'project.sb3', (err) => {
        // Clean up temp file after sending (async)
        fs.unlink(tempFilePath, (unlinkErr) => {
          if (unlinkErr) {
            console.error('Error deleting temp file:', unlinkErr);
          }
        });
        
        if (err) {
          console.error('Error sending file:', err);
        }
      });
    } catch (buildError) {
      // Clean up temp file if it exists (async)
      fs.unlink(tempFilePath, (unlinkErr) => {
        // Ignore errors if file doesn't exist
        if (unlinkErr && unlinkErr.code !== 'ENOENT') {
          console.error('Error deleting temp file:', unlinkErr);
        }
      });
      throw buildError;
    }

  } catch (error) {
    if (error instanceof UnsupportedFeatureError) {
      return res.status(400).json({
        success: false,
        error: 'Unsupported feature detected',
        feature: error.feature,
        line: error.line,
        column: error.column,
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Error handling middleware for multer errors
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'File size exceeds 1MB limit',
      });
    }
    return res.status(400).json({
      success: false,
      error: `File upload error: ${error.message}`,
    });
  }
  
  if (error.message === 'Only JavaScript files (.js) are allowed') {
    return res.status(400).json({
      success: false,
      error: error.message,
    });
  }
  
  next(error);
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 js-to-scratch server running on http://localhost:${PORT}`);
  console.log(`📁 Drag and drop JavaScript files to translate them to Scratch 3.0`);
});

module.exports = app;
