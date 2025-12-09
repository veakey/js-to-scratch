const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const archiver = require('archiver');
const { promisify } = require('util');

const mkdirAsync = promisify(fs.mkdir);
const writeFileAsync = promisify(fs.writeFile);
const copyFileAsync = promisify(fs.copyFile);
const rmdirAsync = promisify(fs.rm);

/**
 * Creates a Scratch 3.0 (.sb3) file from a project object
 * @param {Object} scratchProject - The Scratch project JSON
 * @param {string} outputPath - Path where the .sb3 file should be created
 * @returns {Promise<string>} - Path to the created .sb3 file
 */
async function createSB3File(scratchProject, outputPath) {
  const uniqueId = crypto.randomUUID();
  const tempDir = path.join(path.dirname(outputPath), `.scratch-temp-${uniqueId}`);
  
  try {
    // Create temporary directory
    await mkdirAsync(tempDir, { recursive: true });

    // Write project.json
    const projectJsonPath = path.join(tempDir, 'project.json');
    await writeFileAsync(projectJsonPath, JSON.stringify(scratchProject, null, 2));

    // Copy asset files
    const assetsDir = path.join(__dirname, '../assets');
    const assetFiles = [
      'bcce94f75335c9bd3879cdf6fd0e7fef.svg', // backdrop
      '3b19a04a24b878911444f9a154bc2695.svg', // sprite costume
    ];

    for (const assetFile of assetFiles) {
      const sourcePath = path.join(assetsDir, assetFile);
      const destPath = path.join(tempDir, assetFile);
      
      if (fs.existsSync(sourcePath)) {
        await copyFileAsync(sourcePath, destPath);
      }
    }

    // Ensure output path has .sb3 extension
    let finalOutputPath = outputPath;
    if (!finalOutputPath.endsWith('.sb3')) {
      // If there's an extension, replace it; otherwise, append .sb3
      if (finalOutputPath.match(/\.[^.]+$/)) {
        finalOutputPath = finalOutputPath.replace(/\.[^.]*$/, '.sb3');
      } else {
        finalOutputPath = finalOutputPath + '.sb3';
      }
    }

    // Create ZIP archive and rename to .sb3
    await createZipArchive(tempDir, finalOutputPath);

    // Clean up temporary directory
    await rmdirAsync(tempDir, { recursive: true, force: true });

    return finalOutputPath;
  } catch (error) {
    // Clean up temporary directory on error
    try {
      if (fs.existsSync(tempDir)) {
        await rmdirAsync(tempDir, { recursive: true, force: true });
      }
    } catch (cleanupError) {
      // Ignore cleanup errors
    }
    throw error;
  }
}

/**
 * Creates a ZIP archive from a directory
 * @param {string} sourceDir - Directory to zip
 * @param {string} outputPath - Path for the output ZIP file
 * @returns {Promise<void>}
 */
function createZipArchive(sourceDir, outputPath) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputPath);
    const archive = archiver('zip', {
      zlib: { level: 9 } // Maximum compression
    });

    output.on('close', () => {
      resolve();
    });

    output.on('error', (err) => {
      reject(err);
    });

    archive.on('error', (err) => {
      reject(err);
    });

    archive.pipe(output);

    // Add all files from the directory to the root of the archive
    archive.directory(sourceDir, false);

    archive.finalize();
  });
}

module.exports = {
  createSB3File,
};
