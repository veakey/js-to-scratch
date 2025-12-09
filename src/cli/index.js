#!/usr/bin/env node

const { Command } = require('commander');
const fs = require('fs');
const path = require('path');
const { translateToScratch, UnsupportedFeatureError } = require('../translator');
const { createSB3File } = require('../translator/sb3Builder');
const { extractZipToTemp, cleanupTemp, combineJavaScriptFiles } = require('../utils/zipHandler');

const program = new Command();

program
  .name('js-to-scratch')
  .description('Translate JavaScript projects to Scratch 3.0')
  .version('1.0.0');

program
  .command('translate')
  .description('Translate a JavaScript file or zip archive to Scratch 3.0 format')
  .argument('<input>', 'Input JavaScript file (.js) or zip archive (.zip)')
  .option('-o, --output <file>', 'Output file (defaults to input name with .sb3 extension)')
  .action(async (input, options) => {
    let tempDir = null;
    try {
      // Read input file
      const inputPath = path.resolve(input);
      
      if (!fs.existsSync(inputPath)) {
        console.error(`❌ Error: Input file '${input}' does not exist`);
        process.exit(1);
      }

      let code;
      const isZip = inputPath.endsWith('.zip');

      if (isZip) {
        // Handle zip file
        console.log(`📦 Extracting zip file: ${input}`);
        const { tempDir: extractedDir, files } = await extractZipToTemp(inputPath);
        tempDir = extractedDir;

        if (files.js.length === 0) {
          console.error('❌ Error: No JavaScript files found in the zip archive');
          process.exit(1);
        }

        console.log(`📖 Found ${files.js.length} JavaScript file(s)`);
        if (files.css.length > 0) {
          console.log(`📄 Found ${files.css.length} CSS file(s) (will be ignored)`);
        }
        if (files.html.length > 0) {
          console.log(`📄 Found ${files.html.length} HTML file(s) (will be ignored)`);
        }

        // Combine all JavaScript files
        code = await combineJavaScriptFiles(files.js);
      } else {
        // Handle single JavaScript file
        code = fs.readFileSync(inputPath, 'utf-8');
        console.log(`📖 Reading JavaScript file: ${input}`);
      }
      
      console.log(`🔍 Checking for unsupported features...`);

      // Translate to Scratch
      const result = translateToScratch(code);

      // Determine output path
      const outputPath = options.output 
        ? path.resolve(options.output)
        : inputPath.replace(/\.[^.]+$/, '.sb3');

      // Create .sb3 file
      console.log(`📦 Creating Scratch 3.0 project file...`);
      const finalPath = await createSB3File(result.project, outputPath);
      
      console.log(`✅ Successfully translated to Scratch 3.0`);
      console.log(`📝 Output saved to: ${finalPath}`);
      console.log(`\n💡 You can now upload this .sb3 file to https://scratch.mit.edu/`);

    } catch (error) {
      if (error instanceof UnsupportedFeatureError) {
        console.error('\n❌ UNSUPPORTED FEATURE DETECTED!\n');
        console.error(`Feature: ${error.feature}`);
        console.error(`Location: Line ${error.line}, Column ${error.column}`);
        console.error(`\nReason: The feature '${error.feature}' does not exist in Scratch.`);
        console.error('Please remove or replace this feature and try again.\n');
        process.exit(1);
      }

      console.error(`\n❌ Error: ${error.message}\n`);
      process.exit(1);
    } finally {
      // Clean up temp directory if it was created
      if (tempDir) {
        await cleanupTemp(tempDir);
      }
    }
  });

program.parse();
