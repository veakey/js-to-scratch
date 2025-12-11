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

    test('should use procedures for functions with return', () => {
      const code = `
        function minus(b, c) {
          return b - c;
        }
        const multi = (a, b) => a * b;
        let result = minus(4, multi(1, 3));
      `;
      const result = translateToScratch(code);
      
      expect(result.success).toBe(true);
      const sprite = result.project.targets[1];
      const blocks = sprite.blocks;
      
      // minus has return, so it should be a procedure
      const procDefBlocks = Object.values(blocks).filter(b => b.opcode === 'procedures_definition');
      const minusProc = procDefBlocks.find(b => b.mutation.proccode === 'minus');
      expect(minusProc).toBeDefined();
      
      // multi is an arrow function without block body, so it should be inlined
      const procCallBlocks = Object.values(blocks).filter(b => b.opcode === 'procedures_call');
      const minusCall = procCallBlocks.find(b => b.mutation.proccode === 'minus');
      expect(minusCall).toBeDefined();
      
      // result should reference minus_result variable
      const setVariableBlocks = Object.values(blocks).filter(b => b.opcode === 'data_setvariableto');
      const resultBlock = setVariableBlocks.find(b => b.fields.VARIABLE[0] === 'result');
      expect(resultBlock).toBeDefined();
      
      // Should have minus_result variable
      expect(sprite.variables['minus_result']).toBeDefined();
    });
  });

  describe('Function declarations and expressions', () => {
    test('should inline function declarations', () => {
      const code = `
        function add(a, b) {
          return a + b;
        }
        const sum = add(10, 20);
      `;
      const result = translateToScratch(code);
      
      expect(result.success).toBe(true);
      const sprite = result.project.targets[1];
      const blocks = sprite.blocks;
      
      // Function declaration with return should create a procedure
      const procDefBlocks = Object.values(blocks).filter(b => b.opcode === 'procedures_definition');
      const addProc = procDefBlocks.find(b => b.mutation.proccode === 'add');
      expect(addProc).toBeDefined();
      
      // Should have add_result variable
      expect(sprite.variables['add_result']).toBeDefined();
    });

    test('should inline function expressions', () => {
      const code = `
        const multiply = function(a, b) {
          return a * b;
        };
        const product = multiply(4, 5);
      `;
      const result = translateToScratch(code);
      
      expect(result.success).toBe(true);
      const sprite = result.project.targets[1];
      const blocks = sprite.blocks;
      
      // Function expression with return should create a procedure
      const procDefBlocks = Object.values(blocks).filter(b => b.opcode === 'procedures_definition');
      const multiplyProc = procDefBlocks.find(b => b.mutation.proccode === 'multiply');
      expect(multiplyProc).toBeDefined();
      
      // Should have multiply_result variable
      expect(sprite.variables['multiply_result']).toBeDefined();
    });

    test('should handle nested function calls', () => {
      const code = `
        const square = (x) => x * x;
        
        function calculate(b, c) {
          return square(c) + b - c;
        }
        
        const result = calculate(5, 3);
      `;
      const result = translateToScratch(code);
      
      expect(result.success).toBe(true);
      const sprite = result.project.targets[1];
      const blocks = sprite.blocks;
      
      // calculate has return, so it should be a procedure
      const procDefBlocks = Object.values(blocks).filter(b => b.opcode === 'procedures_definition');
      const calcProc = procDefBlocks.find(b => b.mutation.proccode === 'calculate');
      expect(calcProc).toBeDefined();
      
      // Should have calculate_result variable
      expect(sprite.variables['calculate_result']).toBeDefined();
    });

    test('should handle function declarations with variable arguments', () => {
      const code = `
        function add(a, b) {
          return a + b;
        }
        
        const x = 10;
        const y = 20;
        const sum = add(x, y);
      `;
      const result = translateToScratch(code);
      
      expect(result.success).toBe(true);
      const sprite = result.project.targets[1];
      const blocks = sprite.blocks;
      
      // Should have procedures_definition for add
      const procDefBlocks = Object.values(blocks).filter(b => b.opcode === 'procedures_definition');
      const addProc = procDefBlocks.find(b => b.mutation.proccode === 'add');
      expect(addProc).toBeDefined();
      
      // Should have add_result variable
      expect(sprite.variables['add_result']).toBeDefined();
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

  describe('Comparison operators', () => {
    test('should translate != operator with not wrapper', () => {
      const code = `
        let x = 10;
        if (x != 5) {
          x = 1;
        }
      `;
      const result = translateToScratch(code);
      const sprite = result.project.targets[1];
      const blocks = sprite.blocks;
      
      // Should have operator_not wrapping operator_equals
      const notBlock = Object.values(blocks).find(b => b.opcode === 'operator_not');
      expect(notBlock).toBeDefined();
      
      // The not block should wrap an equals block
      const equalsBlockId = notBlock.inputs.OPERAND[1];
      const equalsBlock = blocks[equalsBlockId];
      expect(equalsBlock.opcode).toBe('operator_equals');
    });

    test('should translate !== operator with not wrapper', () => {
      const code = `
        let x = 10;
        if (x !== 5) {
          x = 1;
        }
      `;
      const result = translateToScratch(code);
      const sprite = result.project.targets[1];
      const blocks = sprite.blocks;
      
      const notBlock = Object.values(blocks).find(b => b.opcode === 'operator_not');
      expect(notBlock).toBeDefined();
      
      const equalsBlockId = notBlock.inputs.OPERAND[1];
      const equalsBlock = blocks[equalsBlockId];
      expect(equalsBlock.opcode).toBe('operator_equals');
    });

    test('should translate <= operator with not wrapper', () => {
      const code = `
        let x = 10;
        if (x <= 20) {
          x = 1;
        }
      `;
      const result = translateToScratch(code);
      const sprite = result.project.targets[1];
      const blocks = sprite.blocks;
      
      // <= becomes not (>)
      const notBlock = Object.values(blocks).find(b => b.opcode === 'operator_not');
      expect(notBlock).toBeDefined();
      
      const gtBlockId = notBlock.inputs.OPERAND[1];
      const gtBlock = blocks[gtBlockId];
      expect(gtBlock.opcode).toBe('operator_gt');
    });

    test('should translate >= operator with not wrapper', () => {
      const code = `
        let x = 10;
        if (x >= 5) {
          x = 1;
        }
      `;
      const result = translateToScratch(code);
      const sprite = result.project.targets[1];
      const blocks = sprite.blocks;
      
      // >= becomes not (<)
      const notBlock = Object.values(blocks).find(b => b.opcode === 'operator_not');
      expect(notBlock).toBeDefined();
      
      const ltBlockId = notBlock.inputs.OPERAND[1];
      const ltBlock = blocks[ltBlockId];
      expect(ltBlock.opcode).toBe('operator_lt');
    });

    test('should translate unary not operator', () => {
      const code = `
        let x = 10;
        if (!(x < 5)) {
          x = 1;
        }
      `;
      const result = translateToScratch(code);
      const sprite = result.project.targets[1];
      const blocks = sprite.blocks;
      
      // Should have operator_not
      const notBlock = Object.values(blocks).find(b => b.opcode === 'operator_not');
      expect(notBlock).toBeDefined();
      
      // The not block should wrap the lt block
      const ltBlockId = notBlock.inputs.OPERAND[1];
      const ltBlock = blocks[ltBlockId];
      expect(ltBlock.opcode).toBe('operator_lt');
    });

    test('should handle <= in while loop conditions', () => {
      const code = `
        let counter = 0;
        while (counter <= 5) {
          counter = counter + 1;
        }
      `;
      const result = translateToScratch(code);
      const sprite = result.project.targets[1];
      const blocks = sprite.blocks;
      
      // Should have control_repeat_until with not(>) condition
      const repeatBlock = Object.values(blocks).find(b => b.opcode === 'control_repeat_until');
      expect(repeatBlock).toBeDefined();
      
      // The condition should be negated (not >)
      const conditionId = repeatBlock.inputs.CONDITION[1];
      const conditionBlock = blocks[conditionId];
      // In while loops, the condition is negated, so <= becomes > directly
      // But we still need to check the structure
      expect(conditionBlock).toBeDefined();
    });

    test('should handle != in if conditions', () => {
      const code = `
        let x = 10;
        let y = 20;
        if (x != y) {
          x = x + 1;
        }
      `;
      const result = translateToScratch(code);
      const sprite = result.project.targets[1];
      const blocks = sprite.blocks;
      
      // Should have control_if
      const ifBlock = Object.values(blocks).find(b => b.opcode === 'control_if');
      expect(ifBlock).toBeDefined();
      
      // Condition should be not(equals)
      const conditionId = ifBlock.inputs.CONDITION[1];
      const conditionBlock = blocks[conditionId];
      expect(conditionBlock.opcode).toBe('operator_not');
      
      const equalsBlockId = conditionBlock.inputs.OPERAND[1];
      const equalsBlock = blocks[equalsBlockId];
      expect(equalsBlock.opcode).toBe('operator_equals');
    });
  });

  describe('Variable management', () => {
    test('should declare variables in sprite variables object', () => {
      const code = `
        let x = 10;
        let y = 20;
        let z = x + y;
      `;
      const result = translateToScratch(code);
      const sprite = result.project.targets[1];
      
      // Check that variables are declared
      expect(sprite.variables).toBeDefined();
      expect(sprite.variables.x).toBeDefined();
      expect(sprite.variables.y).toBeDefined();
      expect(sprite.variables.z).toBeDefined();
      
      // Check format: [name, initialValue]
      expect(sprite.variables.x).toEqual(['x', 0]);
      expect(sprite.variables.y).toEqual(['y', 0]);
      expect(sprite.variables.z).toEqual(['z', 0]);
    });

    test('should include variables from assignments', () => {
      const code = `
        let x = 10;
        x = 20;
        let y = x + 5;
      `;
      const result = translateToScratch(code);
      const sprite = result.project.targets[1];
      
      expect(sprite.variables.x).toBeDefined();
      expect(sprite.variables.y).toBeDefined();
    });

    test('should not include arrow function names as variables', () => {
      const code = `
        const add = (a, b) => a + b;
        let x = 10;
      `;
      const result = translateToScratch(code);
      const sprite = result.project.targets[1];
      
      // add should not be in variables (it's a function, not a variable)
      expect(sprite.variables.add).toBeUndefined();
      // x should be in variables
      expect(sprite.variables.x).toBeDefined();
    });
  });

  describe('For loops', () => {
    test('should translate simple for loop with literals', () => {
      const code = `
        for (let i = 0; i < 5; i++) {
          let x = i;
        }
      `;
      const result = translateToScratch(code);
      
      expect(result.success).toBe(true);
      const sprite = result.project.targets[1];
      const blocks = sprite.blocks;
      
      // Should have control_repeat block
      const repeatBlock = Object.values(blocks).find(b => b.opcode === 'control_repeat');
      expect(repeatBlock).toBeDefined();
      
      // Should have variable i initialized
      expect(sprite.variables.i).toBeDefined();
    });

    test('should translate simple for loop with variables', () => {
      const code = `
        let n = 10;
        for (let i = 0; i < n; i++) {
          let x = i;
        }
      `;
      const result = translateToScratch(code);
      
      expect(result.success).toBe(true);
      const sprite = result.project.targets[1];
      const blocks = sprite.blocks;
      
      // Should have control_repeat block
      const repeatBlock = Object.values(blocks).find(b => b.opcode === 'control_repeat');
      expect(repeatBlock).toBeDefined();
    });

    test('should translate for loop with <= condition', () => {
      const code = `
        for (let i = 0; i <= 5; i++) {
          let x = i;
        }
      `;
      const result = translateToScratch(code);
      
      expect(result.success).toBe(true);
      const sprite = result.project.targets[1];
      const blocks = sprite.blocks;
      
      // Should have control_repeat block
      const repeatBlock = Object.values(blocks).find(b => b.opcode === 'control_repeat');
      expect(repeatBlock).toBeDefined();
    });

    test('should translate complex for loop to repeat_until', () => {
      const code = `
        let x = 0;
        for (let i = 0; x < 10; i++) {
          x = x + 1;
        }
      `;
      const result = translateToScratch(code);
      
      expect(result.success).toBe(true);
      const sprite = result.project.targets[1];
      const blocks = sprite.blocks;
      
      // Complex loops should use control_repeat_until
      const repeatUntilBlock = Object.values(blocks).find(b => b.opcode === 'control_repeat_until');
      expect(repeatUntilBlock).toBeDefined();
    });

    test('should translate for loop with custom start and end', () => {
      const code = `
        for (let i = 5; i < 10; i++) {
          let x = i;
        }
      `;
      const result = translateToScratch(code);
      
      expect(result.success).toBe(true);
      const sprite = result.project.targets[1];
      const blocks = sprite.blocks;
      
      // Should have control_repeat block
      const repeatBlock = Object.values(blocks).find(b => b.opcode === 'control_repeat');
      expect(repeatBlock).toBeDefined();
      
      // Should initialize i to 5
      const setVariableBlocks = Object.values(blocks).filter(b => b.opcode === 'data_setvariableto');
      const initBlock = setVariableBlocks.find(b => b.fields.VARIABLE[0] === 'i');
      expect(initBlock).toBeDefined();
    });

    test('should handle nested for loops', () => {
      const code = `
        for (let i = 0; i < 3; i++) {
          for (let j = 0; j < 2; j++) {
            let x = i + j;
          }
        }
      `;
      const result = translateToScratch(code);
      
      expect(result.success).toBe(true);
      const sprite = result.project.targets[1];
      const blocks = sprite.blocks;
      
      // Should have multiple repeat blocks
      const repeatBlocks = Object.values(blocks).filter(b => b.opcode === 'control_repeat');
      expect(repeatBlocks.length).toBeGreaterThanOrEqual(2);
      
      // Should have both i and j variables
      expect(sprite.variables.i).toBeDefined();
      expect(sprite.variables.j).toBeDefined();
    });
  });

  describe('Arrays and lists', () => {
    test('should create list from array declaration', () => {
      const code = `
        let arr = [1, 2, 3];
      `;
      const result = translateToScratch(code);
      
      expect(result.success).toBe(true);
      const sprite = result.project.targets[1];
      
      // Should have list 'arr' with initial values
      expect(sprite.lists).toBeDefined();
      expect(sprite.lists.arr).toBeDefined();
      expect(sprite.lists.arr[0]).toBe('arr');
      expect(sprite.lists.arr[1]).toEqual(['1', '2', '3']);
    });

    test('should translate array access arr[i]', () => {
      const code = `
        let arr = [1, 2, 3];
        let x = arr[0];
      `;
      const result = translateToScratch(code);
      
      expect(result.success).toBe(true);
      const sprite = result.project.targets[1];
      const blocks = sprite.blocks;
      
      // Should have data_itemoflist block
      const itemBlock = Object.values(blocks).find(b => b.opcode === 'data_itemoflist');
      expect(itemBlock).toBeDefined();
      expect(itemBlock.fields.LIST[0]).toBe('arr');
    });

    test('should translate arr.length', () => {
      const code = `
        let arr = [1, 2, 3];
        let len = arr.length;
      `;
      const result = translateToScratch(code);
      
      expect(result.success).toBe(true);
      const sprite = result.project.targets[1];
      const blocks = sprite.blocks;
      
      // Should have data_lengthoflist block
      const lengthBlock = Object.values(blocks).find(b => b.opcode === 'data_lengthoflist');
      expect(lengthBlock).toBeDefined();
      expect(lengthBlock.fields.LIST[0]).toBe('arr');
    });

    test('should translate arr.push(x)', () => {
      const code = `
        let arr = [1, 2];
        arr.push(3);
      `;
      const result = translateToScratch(code);
      
      expect(result.success).toBe(true);
      const sprite = result.project.targets[1];
      const blocks = sprite.blocks;
      
      // Should have data_addtolist block
      const addBlock = Object.values(blocks).find(b => b.opcode === 'data_addtolist');
      expect(addBlock).toBeDefined();
      expect(addBlock.fields.LIST[0]).toBe('arr');
    });

    test('should translate arr.pop()', () => {
      const code = `
        let arr = [1, 2, 3];
        arr.pop();
      `;
      const result = translateToScratch(code);
      
      expect(result.success).toBe(true);
      const sprite = result.project.targets[1];
      const blocks = sprite.blocks;
      
      // Should have data_deleteoflist block
      const deleteBlock = Object.values(blocks).find(b => b.opcode === 'data_deleteoflist');
      expect(deleteBlock).toBeDefined();
      expect(deleteBlock.fields.LIST[0]).toBe('arr');
    });

    test('should translate arr[i] = value', () => {
      const code = `
        let arr = [1, 2, 3];
        arr[0] = 10;
      `;
      const result = translateToScratch(code);
      
      expect(result.success).toBe(true);
      const sprite = result.project.targets[1];
      const blocks = sprite.blocks;
      
      // Should have data_replaceitemoflist block
      const replaceBlock = Object.values(blocks).find(b => b.opcode === 'data_replaceitemoflist');
      expect(replaceBlock).toBeDefined();
      expect(replaceBlock.fields.LIST[0]).toBe('arr');
    });
  });

  describe('Objects', () => {
    test('should create flattened variables from object declaration', () => {
      const code = `
        let obj = {a: 1, b: 2};
      `;
      const result = translateToScratch(code);
      
      expect(result.success).toBe(true);
      const sprite = result.project.targets[1];
      
      // Should have flattened variables obj_a and obj_b
      expect(sprite.variables['obj_a']).toBeDefined();
      expect(sprite.variables['obj_b']).toBeDefined();
      expect(sprite.variables['obj_a']).toEqual(['obj_a', 1]);
      expect(sprite.variables['obj_b']).toEqual(['obj_b', 2]);
    });

    test('should translate obj.prop access', () => {
      const code = `
        let obj = {a: 1, b: 2};
        let x = obj.a;
      `;
      const result = translateToScratch(code);
      
      expect(result.success).toBe(true);
      const sprite = result.project.targets[1];
      const blocks = sprite.blocks;
      
      // Should reference obj_a variable
      const setVariableBlocks = Object.values(blocks).filter(b => b.opcode === 'data_setvariableto');
      const xBlock = setVariableBlocks.find(b => b.fields.VARIABLE[0] === 'x');
      expect(xBlock).toBeDefined();
    });

    test('should translate obj["prop"] access', () => {
      const code = `
        let obj = {a: 1, b: 2};
        let x = obj['a'];
      `;
      const result = translateToScratch(code);
      
      expect(result.success).toBe(true);
      const sprite = result.project.targets[1];
      
      // Should have obj_a variable
      expect(sprite.variables['obj_a']).toBeDefined();
    });

    test('should translate obj.prop = value assignment', () => {
      const code = `
        let obj = {a: 1, b: 2};
        obj.a = 10;
      `;
      const result = translateToScratch(code);
      
      expect(result.success).toBe(true);
      const sprite = result.project.targets[1];
      const blocks = sprite.blocks;
      
      // Should have data_setvariableto for obj_a
      const setVariableBlocks = Object.values(blocks).filter(b => b.opcode === 'data_setvariableto');
      const objABlock = setVariableBlocks.find(b => b.fields.VARIABLE[0] === 'obj_a');
      expect(objABlock).toBeDefined();
    });
  });

  describe('Recursive functions', () => {
    test('should detect and create procedure for recursive function', () => {
      const code = `
        function factorial(n) {
          if (n <= 1) {
            return 1;
          }
          return n * factorial(n - 1);
        }
      `;
      const result = translateToScratch(code);
      
      expect(result.success).toBe(true);
      const sprite = result.project.targets[1];
      const blocks = sprite.blocks;
      
      // Should have procedures_definition block
      const procDefBlock = Object.values(blocks).find(b => b.opcode === 'procedures_definition');
      expect(procDefBlock).toBeDefined();
      expect(procDefBlock.mutation.proccode).toBe('factorial');
    });

    test('should create procedures_call for recursive function calls', () => {
      const code = `
        function factorial(n) {
          if (n <= 1) {
            return 1;
          }
          return n * factorial(n - 1);
        }
        let result = factorial(5);
      `;
      const result = translateToScratch(code);
      
      expect(result.success).toBe(true);
      const sprite = result.project.targets[1];
      const blocks = sprite.blocks;
      
      // Should have procedures_call block
      const procCallBlock = Object.values(blocks).find(b => b.opcode === 'procedures_call');
      expect(procCallBlock).toBeDefined();
      expect(procCallBlock.mutation.proccode).toBe('factorial');
    });

    test('should handle fibonacci recursive function', () => {
      const code = `
        function fib(n) {
          if (n <= 1) {
            return n;
          }
          return fib(n - 1) + fib(n - 2);
        }
      `;
      const result = translateToScratch(code);
      
      expect(result.success).toBe(true);
      const sprite = result.project.targets[1];
      const blocks = sprite.blocks;
      
      // Should have procedures_definition block
      const procDefBlock = Object.values(blocks).find(b => b.opcode === 'procedures_definition');
      expect(procDefBlock).toBeDefined();
      expect(procDefBlock.mutation.proccode).toBe('fib');
    });

    test('should create procedure for functions with return', () => {
      const code = `
        function add(a, b) {
          return a + b;
        }
        let result = add(3, 4);
      `;
      const result = translateToScratch(code);
      
      expect(result.success).toBe(true);
      const sprite = result.project.targets[1];
      const blocks = sprite.blocks;
      
      // Should have procedures_definition (functions with return need procedures)
      const procDefBlocks = Object.values(blocks).filter(b => b.opcode === 'procedures_definition');
      expect(procDefBlocks.length).toBe(1);
      
      // Should have procedures_call
      const procCallBlocks = Object.values(blocks).filter(b => b.opcode === 'procedures_call');
      expect(procCallBlocks.length).toBe(1);
      
      // Should have add_result variable
      expect(sprite.variables['add_result']).toBeDefined();
    });
  });

  describe('Functions with return using result variables', () => {
    test('should handle example with add and debile functions', () => {
      const code = `
        const a = 2;
        let b = 'sdfa';
        
        const add = (a, b) => a + b;
        
        function debile(a, b, c) {
          return a + b * add(b, c) - c;
        }
        
        const d = debile(1, 2, 3);
      `;
      const result = translateToScratch(code);
      
      expect(result.success).toBe(true);
      const sprite = result.project.targets[1];
      const blocks = sprite.blocks;
      
      // add is an arrow function without block body, so it should be inlined
      // debile has return in block body, so it should be a procedure
      const procDefBlocks = Object.values(blocks).filter(b => b.opcode === 'procedures_definition');
      const debileProc = procDefBlocks.find(b => b.mutation.proccode === 'debile');
      expect(debileProc).toBeDefined();
      
      // Should have debile_result variable
      expect(sprite.variables['debile_result']).toBeDefined();
      
      // Should have procedures_call for debile
      const procCallBlocks = Object.values(blocks).filter(b => b.opcode === 'procedures_call');
      const debileCall = procCallBlocks.find(b => b.mutation.proccode === 'debile');
      expect(debileCall).toBeDefined();
    });
  });
});
