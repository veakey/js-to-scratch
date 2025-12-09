const AdmZip = require('adm-zip');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Extract a zip file to a temporary directory
 * @param {string|Buffer} zipSource - Path to zip file or Buffer containing zip data
 * @returns {Promise<{tempDir: string, files: {js: string[], css: string[], html: string[]}}>}
 */
async function extractZipToTemp(zipSource) {
  const uniqueId = crypto.randomUUID();
  const tempDir = path.join('/tmp', `js-to-scratch-${uniqueId}`);
  
  try {
    // Create temporary directory
    await fs.promises.mkdir(tempDir, { recursive: true });
    
    // Extract zip
    const zip = new AdmZip(zipSource);
    zip.extractAllTo(tempDir, true);
    
    // Find all js, css, and html files in the root
    const allFiles = await fs.promises.readdir(tempDir);
    
    const files = {
      js: [],
      css: [],
      html: []
    };
    
    for (const file of allFiles) {
      const filePath = path.join(tempDir, file);
      const stat = await fs.promises.stat(filePath);
      
      // Only process files in the root (not directories)
      if (stat.isFile()) {
        if (file.endsWith('.js')) {
          files.js.push(filePath);
        } else if (file.endsWith('.css')) {
          files.css.push(filePath);
        } else if (file.endsWith('.html')) {
          files.html.push(filePath);
        }
      }
    }
    
    return { tempDir, files };
  } catch (error) {
    // Clean up on error
    try {
      if (fs.existsSync(tempDir)) {
        await fs.promises.rm(tempDir, { recursive: true, force: true });
      }
    } catch (cleanupError) {
      // Ignore cleanup errors
    }
    throw new Error(`Failed to extract zip file: ${error.message}`);
  }
}

/**
 * Clean up temporary directory
 * @param {string} tempDir - Path to temporary directory
 */
async function cleanupTemp(tempDir) {
  try {
    if (fs.existsSync(tempDir)) {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    }
  } catch (error) {
    console.error(`Failed to cleanup temp directory ${tempDir}:`, error);
  }
}

/**
 * Combine all JavaScript files into a single code string
 * @param {string[]} jsPaths - Array of paths to JavaScript files
 * @returns {Promise<string>}
 */
async function combineJavaScriptFiles(jsPaths) {
  if (jsPaths.length === 0) {
    throw new Error('No JavaScript files found in zip');
  }
  
  const codeBlocks = [];
  
  for (const jsPath of jsPaths) {
    const code = await fs.promises.readFile(jsPath, 'utf-8');
    codeBlocks.push(`// File: ${path.basename(jsPath)}\n${code}`);
  }
  
  return codeBlocks.join('\n\n');
}

module.exports = {
  extractZipToTemp,
  cleanupTemp,
  combineJavaScriptFiles,
};
