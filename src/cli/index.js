#!/usr/bin/env node

const { Command } = require('commander');
const fs = require('fs');
const path = require('path');
const { translateToScratch, UnsupportedFeatureError } = require('../translator');

const program = new Command();

program
  .name('js-to-scratch')
  .description('Translate JavaScript projects to Scratch 3.0')
  .version('1.0.0');

program
  .command('translate')
  .description('Translate a JavaScript file to Scratch 3.0 format')
  .argument('<input>', 'Input JavaScript file')
  .option('-o, --output <file>', 'Output file (defaults to input name with .sb3 extension)')
  .action((input, options) => {
    try {
      // Read input file
      const inputPath = path.resolve(input);
      
      if (!fs.existsSync(inputPath)) {
        console.error(`❌ Error: Input file '${input}' does not exist`);
        process.exit(1);
      }

      const code = fs.readFileSync(inputPath, 'utf-8');
      
      console.log(`📖 Reading JavaScript file: ${input}`);
      console.log(`🔍 Checking for unsupported features...`);

      // Translate to Scratch
      const result = translateToScratch(code);

      // Determine output path
      const outputPath = options.output 
        ? path.resolve(options.output)
        : inputPath.replace(/\.[^.]+$/, '.sb3.json');

      // Write output
      fs.writeFileSync(outputPath, JSON.stringify(result.project, null, 2));
      
      console.log(`✅ Successfully translated to Scratch 3.0`);
      console.log(`📝 Output saved to: ${outputPath}`);
      console.log(`\n💡 Note: Open this file in Scratch 3.0 to import the project`);

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
    }
  });

program.parse();
