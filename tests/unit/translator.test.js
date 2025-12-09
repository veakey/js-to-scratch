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
});
