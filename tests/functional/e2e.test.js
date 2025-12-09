const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const AdmZip = require('adm-zip');

const execAsync = promisify(exec);

describe('End-to-End Tests', () => {
  const fixturesDir = path.join(__dirname, '../fixtures');
  const outputDir = path.join(__dirname, '../output-e2e');

  beforeAll(() => {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
  });

  afterAll(() => {
    if (fs.existsSync(outputDir)) {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
  });

  describe('CLI E2E Tests', () => {
    test('should translate single JS file via CLI', async () => {
      const inputFile = path.join(fixturesDir, 'simple-variable.js');
      const outputFile = path.join(outputDir, 'cli-simple.sb3');

      const { stdout } = await execAsync(
        `node src/cli/index.js translate ${inputFile} -o ${outputFile}`,
        { cwd: path.join(__dirname, '../..') }
      );

      expect(stdout).toContain('Successfully translated');
      expect(fs.existsSync(outputFile)).toBe(true);

      // Verify it's a valid zip
      const zip = new AdmZip(outputFile);
      const entries = zip.getEntries();
      expect(entries.some(e => e.entryName === 'project.json')).toBe(true);
    }, 10000);

    test('should translate zip file via CLI', async () => {
      const inputFile = path.join(fixturesDir, 'test-project.zip');
      const outputFile = path.join(outputDir, 'cli-zip.sb3');

      const { stdout } = await execAsync(
        `node src/cli/index.js translate ${inputFile} -o ${outputFile}`,
        { cwd: path.join(__dirname, '../..') }
      );

      expect(stdout).toContain('Extracting zip file');
      expect(stdout).toContain('Found 2 JavaScript file(s)');
      expect(stdout).toContain('Successfully translated');
      expect(fs.existsSync(outputFile)).toBe(true);

      // Verify it's a valid zip
      const zip = new AdmZip(outputFile);
      const entries = zip.getEntries();
      expect(entries.some(e => e.entryName === 'project.json')).toBe(true);
    }, 10000);

    test('should detect unsupported features via CLI', async () => {
      const inputFile = path.join(fixturesDir, '../..', 'examples/unsupported.js');
      const outputFile = path.join(outputDir, 'cli-unsupported.sb3');

      try {
        await execAsync(
          `node src/cli/index.js translate ${inputFile} -o ${outputFile}`,
          { cwd: path.join(__dirname, '../..') }
        );
        fail('Should have thrown an error');
      } catch (error) {
        expect(error.stderr || error.stdout).toContain('UNSUPPORTED FEATURE');
      }
    }, 10000);
  });

  describe('Integration Tests', () => {
    test('should handle multiple JS files in zip', async () => {
      const zipPath = path.join(fixturesDir, 'test-project.zip');
      const zip = new AdmZip(zipPath);
      const entries = zip.getEntries();

      const jsFiles = entries.filter(e => e.entryName.endsWith('.js'));
      const cssFiles = entries.filter(e => e.entryName.endsWith('.css'));
      const htmlFiles = entries.filter(e => e.entryName.endsWith('.html'));

      expect(jsFiles.length).toBeGreaterThan(0);
      expect(cssFiles.length).toBeGreaterThan(0);
      expect(htmlFiles.length).toBeGreaterThan(0);
    });

    test('should generate valid Scratch 3.0 project structure', async () => {
      const inputFile = path.join(fixturesDir, 'if-statement.js');
      const outputFile = path.join(outputDir, 'structure-test.sb3');

      await execAsync(
        `node src/cli/index.js translate ${inputFile} -o ${outputFile}`,
        { cwd: path.join(__dirname, '../..') }
      );

      const zip = new AdmZip(outputFile);
      const projectJson = zip.readAsText('project.json');
      const project = JSON.parse(projectJson);

      // Verify Scratch 3.0 structure
      expect(project.meta).toBeDefined();
      expect(project.meta.semver).toBe('3.0.0');
      expect(project.targets).toBeDefined();
      expect(project.targets.length).toBe(2); // Stage + Sprite
      expect(project.targets[0].isStage).toBe(true);
      expect(project.targets[1].isStage).toBe(false);
    }, 10000);
  });
});
