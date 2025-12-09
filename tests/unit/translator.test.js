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

  describe('Arrow functions and function calls', () => {
    test('should inline simple arrow function calls', () => {
      const code = `
        const add = (a, b) => a + b;
        const total = add(40, 35);
      `;
      const result = translateToScratch(code);
      
      expect(result.success).toBe(true);
      const sprite = result.project.targets[1];
      const blocks = sprite.blocks;
      
      // Check that add function is not created as a separate block/variable
      const setVariableBlocks = Object.values(blocks).filter(b => b.opcode === 'data_setvariableto');
      const addVariableBlock = setVariableBlocks.find(b => b.fields.VARIABLE[0] === 'add');
      expect(addVariableBlock).toBeUndefined();
      
      // Check that total is set to an operator_add block
      const totalBlock = setVariableBlocks.find(b => b.fields.VARIABLE[0] === 'total');
      expect(totalBlock).toBeDefined();
      
      // The VALUE input should reference an operator_add block
      const addBlockId = totalBlock.inputs.VALUE[1];
      const addBlock = blocks[addBlockId];
      expect(addBlock.opcode).toBe('operator_add');
      
      // Check that the operator_add has correct operands (40 and 35)
      expect(addBlock.inputs.NUM1).toEqual([1, [4, '40']]);
      expect(addBlock.inputs.NUM2).toEqual([1, [4, '35']]);
    });

    test('should handle arrow functions with variable arguments', () => {
      const code = `
        const x = 10;
        const y = 20;
        const add = (a, b) => a + b;
        const result = add(x, y);
      `;
      const result = translateToScratch(code);
      
      expect(result.success).toBe(true);
      const sprite = result.project.targets[1];
      const blocks = sprite.blocks;
      
      // Find the result variable assignment
      const setVariableBlocks = Object.values(blocks).filter(b => b.opcode === 'data_setvariableto');
      const resultBlock = setVariableBlocks.find(b => b.fields.VARIABLE[0] === 'result');
      expect(resultBlock).toBeDefined();
      
      // The VALUE should reference an operator_add block
      const addBlockId = resultBlock.inputs.VALUE[1];
      const addBlock = blocks[addBlockId];
      expect(addBlock.opcode).toBe('operator_add');
    });

    test('should handle arrow functions with different operators', () => {
      const code = `
        const multiply = (a, b) => a * b;
        const product = multiply(5, 6);
      `;
      const result = translateToScratch(code);
      
      expect(result.success).toBe(true);
      const sprite = result.project.targets[1];
      const blocks = sprite.blocks;
      
      // Find multiply operator
      const multiplyBlock = Object.values(blocks).find(b => b.opcode === 'operator_multiply');
      expect(multiplyBlock).toBeDefined();
      expect(multiplyBlock.inputs.NUM1).toEqual([1, [4, '5']]);
      expect(multiplyBlock.inputs.NUM2).toEqual([1, [4, '6']]);
    });

    test('should handle function calls with missing arguments', () => {
      const code = `
        const add = (a, b) => a + b;
        const result = add(10);
      `;
      const result = translateToScratch(code);
      
      expect(result.success).toBe(true);
      const sprite = result.project.targets[1];
      const blocks = sprite.blocks;
      
      // Find the add operator
      const addBlock = Object.values(blocks).find(b => b.opcode === 'operator_add');
      expect(addBlock).toBeDefined();
      // First argument should be 10, second should default to 0
      expect(addBlock.inputs.NUM1).toEqual([1, [4, '10']]);
      expect(addBlock.inputs.NUM2).toEqual([1, [4, '0']]);
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
