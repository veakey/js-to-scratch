const acorn = require('acorn');

/**
 * Transform canvas API calls into Scratch-compatible operations
 * This is a preprocessing step that converts canvas code to simplified operations
 * @param {string} code - JavaScript code with canvas API calls
 * @returns {string} - Transformed code compatible with Scratch
 */
function transformCanvasToScratch(code) {
  try {
    const ast = acorn.parse(code, {
      ecmaVersion: 2020,
      locations: true,
    });

    // Track canvas context variables (e.g., ctx)
    const canvasContextVars = new Set();
    const canvasVars = new Set();
    const transformedStatements = [];

    // First pass: identify canvas-related variables
    function identifyCanvasVars(node) {
      if (!node) return;

      if (node.type === 'VariableDeclaration') {
        for (const decl of node.declarations) {
          if (decl.init && 
              decl.init.type === 'CallExpression' &&
              decl.init.callee.type === 'MemberExpression' &&
              decl.init.callee.object.name === 'document' &&
              decl.init.callee.property.name === 'getElementById') {
            canvasVars.add(decl.id.name);
          }
          
          if (decl.init && 
              decl.init.type === 'CallExpression' &&
              decl.init.callee.type === 'MemberExpression' &&
              (canvasVars.has(decl.init.callee.object.name) || 
               decl.init.callee.object.name === 'canvas') &&
              decl.init.callee.property.name === 'getContext') {
            canvasContextVars.add(decl.id.name);
          }
        }
      }

      // Recursively scan all nodes
      for (const key in node) {
        if (key === 'loc' || key === 'range') continue;
        const child = node[key];
        if (Array.isArray(child)) {
          child.forEach(identifyCanvasVars);
        } else if (child && typeof child === 'object' && child.type) {
          identifyCanvasVars(child);
        }
      }
    }

    // Scan AST to identify canvas variables
    identifyCanvasVars(ast);

    function processNode(node) {
      if (!node) return null;

      // Skip canvas element retrieval: const canvas = document.getElementById('myCanvas')
      if (node.type === 'VariableDeclaration') {
        for (const decl of node.declarations) {
          if (decl.init && 
              decl.init.type === 'CallExpression' &&
              decl.init.callee.type === 'MemberExpression' &&
              decl.init.callee.object.name === 'document' &&
              decl.init.callee.property.name === 'getElementById') {
            // Skip this statement
            return null;
          }
          
          // Skip canvas context: const ctx = canvas.getContext('2d')
          if (decl.init && 
              decl.init.type === 'CallExpression' &&
              decl.init.callee.type === 'MemberExpression' &&
              (canvasVars.has(decl.init.callee.object.name) ||
               decl.init.callee.object.name === 'canvas') &&
              decl.init.callee.property.name === 'getContext') {
            // Skip this statement
            return null;
          }
        }
      }

      // Process expression statements
      if (node.type === 'ExpressionStatement' && node.expression.type === 'AssignmentExpression') {
        const left = node.expression.left;
        const right = node.expression.right;

        // Check if this is setting a canvas context property
        if (left.type === 'MemberExpression' && 
            canvasContextVars.has(left.object.name)) {
          const property = left.property.name;
          
          // Handle different canvas properties
          switch (property) {
            case 'fillStyle':
              // Transform: ctx.fillStyle = 'black' -> scratch_pen_color = 'black'
              return {
                type: 'ExpressionStatement',
                expression: {
                  type: 'AssignmentExpression',
                  operator: '=',
                  left: { type: 'Identifier', name: 'scratch_pen_color' },
                  right: right
                }
              };
            
            case 'font':
              // Transform: ctx.font = '30px Arial' -> scratch_text_size = 30
              if (right.type === 'Literal' && typeof right.value === 'string') {
                const sizeMatch = right.value.match(/(\d+)px/);
                if (sizeMatch) {
                  return {
                    type: 'ExpressionStatement',
                    expression: {
                      type: 'AssignmentExpression',
                      operator: '=',
                      left: { type: 'Identifier', name: 'scratch_text_size' },
                      right: { type: 'Literal', value: parseInt(sizeMatch[1]) }
                    }
                  };
                }
              }
              return null;
            
            case 'textAlign':
            case 'textBaseline':
              // These don't have direct Scratch equivalents, skip them
              return null;
            
            default:
              return null;
          }
        }
      }

      // Process canvas method calls
      if (node.type === 'ExpressionStatement' && 
          node.expression.type === 'CallExpression') {
        const callee = node.expression.callee;
        
        if (callee.type === 'MemberExpression' && 
            canvasContextVars.has(callee.object.name)) {
          const method = callee.property.name;
          const args = node.expression.arguments;

          switch (method) {
            case 'fillText':
              // Transform: ctx.fillText('Hello world', x, y)
              // -> scratch_say(text, x, y)
              if (args.length >= 1) {
                return {
                  type: 'ExpressionStatement',
                  expression: {
                    type: 'CallExpression',
                    callee: { type: 'Identifier', name: 'scratch_say' },
                    arguments: args
                  }
                };
              }
              return null;
            
            case 'strokeText':
              // Similar to fillText
              if (args.length >= 1) {
                return {
                  type: 'ExpressionStatement',
                  expression: {
                    type: 'CallExpression',
                    callee: { type: 'Identifier', name: 'scratch_say' },
                    arguments: args
                  }
                };
              }
              return null;
            
            case 'fillRect':
              // Transform: ctx.fillRect(x, y, w, h)
              // Could be represented as pen operations
              return null;
            
            default:
              return null;
          }
        }
      }

      return node;
    }

    // Check if code has any canvas operations
    if (canvasContextVars.size === 0 && canvasVars.size === 0) {
      // No canvas code found, return original
      return code;
    }

    // Process all statements in the program
    for (const stmt of ast.body) {
      const transformed = processNode(stmt);
      if (transformed) {
        // Add transformed statement
        transformedStatements.push(transformed);
      } else if (transformed === null) {
        // Explicitly skip (canvas-related statement that should be removed)
        continue;
      }
      // If transformed is undefined or false, also skip it
    }

    // Generate transformed code
    const transformed = generateCode(transformedStatements);
    
    // If all canvas statements were removed (only initialization code), return empty string
    // This is expected when HTML only contains canvas setup with no actual drawing operations
    if (transformedStatements.length === 0) {
      return '';
    }
    
    return transformed;
  } catch (error) {
    // If parsing fails, return original code unchanged
    // This ensures we don't break valid code that just doesn't contain canvas
    return code;
  }
}

/**
 * Check if code contains canvas-related operations
 * @param {string} code - JavaScript code
 * @returns {boolean}
 */
function hasCanvasCode(code) {
  return code.includes('canvas') || 
         code.includes('getContext') || 
         code.includes('.fillText') ||
         code.includes('.strokeText') ||
         code.includes('.fillStyle') ||
         code.includes('.font');
}



/**
 * Generate JavaScript code from AST nodes
 * @param {Array} statements - Array of AST statement nodes
 * @returns {string}
 */
function generateCode(statements) {
  const lines = [];

  for (const stmt of statements) {
    if (stmt.type === 'ExpressionStatement') {
      const expr = stmt.expression;
      
      if (expr.type === 'AssignmentExpression') {
        const left = generateExpression(expr.left);
        const right = generateExpression(expr.right);
        lines.push(`${left} = ${right};`);
      } else if (expr.type === 'CallExpression') {
        const callee = generateExpression(expr.callee);
        const args = expr.arguments.map(generateExpression).join(', ');
        lines.push(`${callee}(${args});`);
      }
    }
  }

  return lines.join('\n');
}

/**
 * Generate JavaScript expression from AST node
 * @param {Object} node - AST node
 * @returns {string}
 */
function generateExpression(node) {
  if (!node) return '';

  switch (node.type) {
    case 'Identifier':
      return node.name;
    
    case 'Literal':
      if (typeof node.value === 'string') {
        return `'${node.value}'`;
      }
      return String(node.value);
    
    case 'BinaryExpression':
      const left = generateExpression(node.left);
      const right = generateExpression(node.right);
      return `${left} ${node.operator} ${right}`;
    
    case 'MemberExpression':
      const obj = generateExpression(node.object);
      const prop = node.computed 
        ? `[${generateExpression(node.property)}]`
        : `.${node.property.name}`;
      return `${obj}${prop}`;
    
    default:
      return '';
  }
}

module.exports = {
  transformCanvasToScratch,
  hasCanvasCode,
};
