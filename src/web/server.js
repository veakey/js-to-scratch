const express = require('express');
const multer = require('multer');
const path = require('path');
const { translateToScratch, UnsupportedFeatureError } = require('../translator');

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// API endpoint for translation
app.post('/api/translate', upload.single('file'), (req, res) => {
  try {
    let code;

    if (req.file) {
      // File upload
      code = req.file.buffer.toString('utf-8');
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

    res.json({
      success: true,
      project: result.project,
    });

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
