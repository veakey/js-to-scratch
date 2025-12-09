const { translateToScratch, UnsupportedFeatureError, UNSUPPORTED_FEATURES } = require('../../src/translator');

describe('Translator', () => {
  describe('translateToScratch', () => {
    test('should translate simple variable declaration', () => {
      const code = 'let x = 10;';
      const result = translateToScratch(code);
      
      expect(result.success).toBe(true);
      expect(result.project).toBeDefined();
      expect(result.project.targets).toBeDefined();
      expect(result.project.targets.length).toBe(2); // Stage + Sprite1
    });

    test('should translate if statement', () => {
      const code = `
        let x = 10;
        let y = 20;
        if (x < y) {
          x = x + 1;
        }
      `;
      const result = translateToScratch(code);
      
      expect(result.success).toBe(true);
      expect(result.project).toBeDefined();
      
      const sprite = result.project.targets[1];
      expect(sprite.blocks).toBeDefined();
      
      // Check that blocks contain control_if opcode
      const blockOpcodes = Object.values(sprite.blocks).map(b => b.opcode);
      expect(blockOpcodes).toContain('control_if');
    });

    test('should translate while loop', () => {
      const code = `
        let counter = 0;
        while (counter < 5) {
          counter = counter + 1;
        }
      `;
      const result = translateToScratch(code);
      
      expect(result.success).toBe(true);
      
      const sprite = result.project.targets[1];
      const blockOpcodes = Object.values(sprite.blocks).map(b => b.opcode);
      expect(blockOpcodes).toContain('control_repeat_until');
    });

    test('should throw error for unsupported features', () => {
      const code = 'console.log("Hello");';
      
      expect(() => translateToScratch(code)).toThrow(UnsupportedFeatureError);
    });

    test('should detect window.alert', () => {
      const code = 'window.alert("Hello");';
      
      expect(() => translateToScratch(code)).toThrow(UnsupportedFeatureError);
    });

    test('should detect console.log', () => {
      const code = 'console.log("test");';
      
      expect(() => translateToScratch(code)).toThrow(UnsupportedFeatureError);
    });

    test('should detect async functions', () => {
      const code = 'async function test() { return 1; }';
      
      expect(() => translateToScratch(code)).toThrow(UnsupportedFeatureError);
    });

    test('should detect await expressions', () => {
      const code = 'async function test() { await Promise.resolve(); }';
      
      expect(() => translateToScratch(code)).toThrow(UnsupportedFeatureError);
    });
  });

  describe('UnsupportedFeatureError', () => {
    test('should contain feature, line, and column', () => {
      const error = new UnsupportedFeatureError('console.log', 5, 10);
      
      expect(error.feature).toBe('console.log');
      expect(error.line).toBe(5);
      expect(error.column).toBe(10);
      expect(error.name).toBe('UnsupportedFeatureError');
    });
  });

  describe('UNSUPPORTED_FEATURES', () => {
    test('should contain expected unsupported features', () => {
      expect(UNSUPPORTED_FEATURES).toContain('console.log');
      expect(UNSUPPORTED_FEATURES).toContain('window.alert');
      expect(UNSUPPORTED_FEATURES).toContain('fetch');
      expect(UNSUPPORTED_FEATURES).toContain('setTimeout');
      expect(UNSUPPORTED_FEATURES).toContain('Promise');
    });
  });

  describe('Block connection properties', () => {
    test('should only have event block as topLevel', () => {
      const code = `
        let x = 10;
        let y = 20;
        if (x < y) {
          x = x + 1;
        }
      `;
      const result = translateToScratch(code);
      const sprite = result.project.targets[1];
      const blocks = sprite.blocks;
      
      // Count blocks with topLevel: true
      const topLevelBlocks = Object.values(blocks).filter(b => b.topLevel === true);
      
      // Only the event_whenflagclicked block should be topLevel
      expect(topLevelBlocks.length).toBe(1);
      expect(topLevelBlocks[0].opcode).toBe('event_whenflagclicked');
    });

    test('should have proper parent references for all blocks', () => {
      const code = `
        let x = 10;
        if (x < 5) {
          x = x + 1;
        }
      `;
      const result = translateToScratch(code);
      const sprite = result.project.targets[1];
      const blocks = sprite.blocks;
      
      // All blocks except the event block should have a parent
      const blocksWithoutParent = Object.entries(blocks).filter(
        ([id, block]) => block.parent === null && block.opcode !== 'event_whenflagclicked'
      );
      
      expect(blocksWithoutParent.length).toBe(0);
    });

    test('should have proper parent references for operator blocks', () => {
      const code = `
        let x = 10;
        let y = x + 5;
      `;
      const result = translateToScratch(code);
      const sprite = result.project.targets[1];
      const blocks = sprite.blocks;
      
      // Find the operator_add block
      const addBlock = Object.values(blocks).find(b => b.opcode === 'operator_add');
      
      expect(addBlock).toBeDefined();
      expect(addBlock.parent).not.toBeNull();
      expect(addBlock.topLevel).toBe(false);
    });

    test('should have proper parent references for comparison blocks', () => {
      const code = `
        let x = 10;
        if (x < 20) {
          x = 1;
        }
      `;
      const result = translateToScratch(code);
      const sprite = result.project.targets[1];
      const blocks = sprite.blocks;
      
      // Find the operator_lt block
      const ltBlock = Object.values(blocks).find(b => b.opcode === 'operator_lt');
      
      expect(ltBlock).toBeDefined();
      expect(ltBlock.parent).not.toBeNull();
      expect(ltBlock.topLevel).toBe(false);
    });
  });
});
