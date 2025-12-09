const fs = require('fs');
const path = require('path');
const { extractZipToTemp, cleanupTemp, combineJavaScriptFiles } = require('../../src/utils/zipHandler');

describe('ZipHandler', () => {
  const fixturesDir = path.join(__dirname, '../fixtures');

  describe('extractZipToTemp', () => {
    test('should extract zip file and find JavaScript files', async () => {
      const zipPath = path.join(fixturesDir, 'test-project.zip');
      const { tempDir, files } = await extractZipToTemp(zipPath);
      
      expect(tempDir).toBeDefined();
      expect(fs.existsSync(tempDir)).toBe(true);
      expect(files.js.length).toBeGreaterThan(0);
      
      // Clean up
      await cleanupTemp(tempDir);
      expect(fs.existsSync(tempDir)).toBe(false);
    });

    test('should handle zip from buffer', async () => {
      const zipPath = path.join(fixturesDir, 'test-project.zip');
      const buffer = fs.readFileSync(zipPath);
      
      const { tempDir, files } = await extractZipToTemp(buffer);
      
      expect(tempDir).toBeDefined();
      expect(files.js.length).toBeGreaterThan(0);
      
      // Clean up
      await cleanupTemp(tempDir);
    });

    test('should categorize files by extension', async () => {
      const zipPath = path.join(fixturesDir, 'test-project.zip');
      const { tempDir, files } = await extractZipToTemp(zipPath);
      
      expect(files).toHaveProperty('js');
      expect(files).toHaveProperty('css');
      expect(files).toHaveProperty('html');
      expect(Array.isArray(files.js)).toBe(true);
      
      // Clean up
      await cleanupTemp(tempDir);
    });
  });

  describe('combineJavaScriptFiles', () => {
    test('should combine multiple JavaScript files', async () => {
      const file1 = path.join(fixturesDir, 'simple-variable.js');
      const file2 = path.join(fixturesDir, 'while-loop.js');
      
      const combined = await combineJavaScriptFiles([file1, file2]);
      
      expect(combined).toContain('let x = 10');
      expect(combined).toContain('let counter = 0');
      expect(combined).toContain('File: simple-variable.js');
      expect(combined).toContain('File: while-loop.js');
    });

    test('should throw error if no files provided', async () => {
      await expect(combineJavaScriptFiles([])).rejects.toThrow('No JavaScript files found');
    });

    test('should handle single file', async () => {
      const file = path.join(fixturesDir, 'simple-variable.js');
      const combined = await combineJavaScriptFiles([file]);
      
      expect(combined).toContain('let x = 10');
    });
  });

  describe('cleanupTemp', () => {
    test('should remove temporary directory', async () => {
      const tempDir = path.join('/tmp', 'test-cleanup');
      await fs.promises.mkdir(tempDir, { recursive: true });
      
      expect(fs.existsSync(tempDir)).toBe(true);
      
      await cleanupTemp(tempDir);
      
      expect(fs.existsSync(tempDir)).toBe(false);
    });

    test('should not throw error for non-existent directory', async () => {
      await expect(cleanupTemp('/tmp/non-existent-dir')).resolves.not.toThrow();
    });
  });
});
