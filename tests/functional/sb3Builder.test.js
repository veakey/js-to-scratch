const fs = require('fs');
const path = require('path');
const { createSB3File } = require('../../src/translator/sb3Builder');
const { translateToScratch } = require('../../src/translator');
const AdmZip = require('adm-zip');

describe('SB3 Builder - Functional Tests', () => {
  const fixturesDir = path.join(__dirname, '../fixtures');
  const outputDir = path.join(__dirname, '../output');

  beforeAll(() => {
    // Create output directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
  });

  afterAll(() => {
    // Clean up output directory
    if (fs.existsSync(outputDir)) {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
  });

  test('should create valid .sb3 file from simple variable', async () => {
    const jsFile = path.join(fixturesDir, 'simple-variable.js');
    const code = fs.readFileSync(jsFile, 'utf-8');
    const result = translateToScratch(code);
    
    const outputPath = path.join(outputDir, 'simple-variable.sb3');
    const finalPath = await createSB3File(result.project, outputPath);
    
    expect(fs.existsSync(finalPath)).toBe(true);
    expect(finalPath).toMatch(/\.sb3$/);
    
    // Verify the .sb3 file is a valid zip
    const zip = new AdmZip(finalPath);
    const zipEntries = zip.getEntries();
    
    // Should contain project.json and asset files
    const entryNames = zipEntries.map(e => e.entryName);
    expect(entryNames).toContain('project.json');
    
    // Verify project.json is valid JSON
    const projectJson = zip.readAsText('project.json');
    const project = JSON.parse(projectJson);
    expect(project.targets).toBeDefined();
    expect(project.meta).toBeDefined();
    expect(project.meta.semver).toBe('3.0.0');
  });

  test('should create valid .sb3 file from if statement', async () => {
    const jsFile = path.join(fixturesDir, 'if-statement.js');
    const code = fs.readFileSync(jsFile, 'utf-8');
    const result = translateToScratch(code);
    
    const outputPath = path.join(outputDir, 'if-statement.sb3');
    const finalPath = await createSB3File(result.project, outputPath);
    
    expect(fs.existsSync(finalPath)).toBe(true);
    
    // Verify the .sb3 file contains control_if block
    const zip = new AdmZip(finalPath);
    const projectJson = zip.readAsText('project.json');
    const project = JSON.parse(projectJson);
    
    const sprite = project.targets[1];
    const blockOpcodes = Object.values(sprite.blocks).map(b => b.opcode);
    expect(blockOpcodes).toContain('control_if');
  });

  test('should create valid .sb3 file from while loop', async () => {
    const jsFile = path.join(fixturesDir, 'while-loop.js');
    const code = fs.readFileSync(jsFile, 'utf-8');
    const result = translateToScratch(code);
    
    const outputPath = path.join(outputDir, 'while-loop.sb3');
    const finalPath = await createSB3File(result.project, outputPath);
    
    expect(fs.existsSync(finalPath)).toBe(true);
    
    // Verify the .sb3 file contains control_repeat_until block
    const zip = new AdmZip(finalPath);
    const projectJson = zip.readAsText('project.json');
    const project = JSON.parse(projectJson);
    
    const sprite = project.targets[1];
    const blockOpcodes = Object.values(sprite.blocks).map(b => b.opcode);
    expect(blockOpcodes).toContain('control_repeat_until');
  });

  test('should add .sb3 extension if not present', async () => {
    const code = 'let x = 10;';
    const result = translateToScratch(code);
    
    const outputPath = path.join(outputDir, 'no-extension');
    const finalPath = await createSB3File(result.project, outputPath);
    
    expect(finalPath).toMatch(/\.sb3$/);
    expect(fs.existsSync(finalPath)).toBe(true);
  });

  test('should replace wrong extension with .sb3', async () => {
    const code = 'let x = 10;';
    const result = translateToScratch(code);
    
    const outputPath = path.join(outputDir, 'wrong-extension.txt');
    const finalPath = await createSB3File(result.project, outputPath);
    
    expect(finalPath).toMatch(/\.sb3$/);
    expect(finalPath).not.toMatch(/\.txt$/);
    expect(fs.existsSync(finalPath)).toBe(true);
  });
});
