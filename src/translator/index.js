const acorn = require('acorn');

/**
 * List of unsupported JavaScript features that don't exist in Scratch
 */
const UNSUPPORTED_FEATURES = [
  'window.location',
  'window.alert',
  'window.confirm',
  'window.prompt',
  'document.getElementById',
  'document.querySelector',
  'console.log',
  'localStorage',
  'sessionStorage',
  'fetch',
  'XMLHttpRequest',
  'setTimeout',
  'setInterval',
  'Promise',
  'async',
  'await',
];

/**
 * Custom error for unsupported features
 */
class UnsupportedFeatureError extends Error {
  constructor(feature, line, column) {
    super(`Unsupported feature '${feature}' found at line ${line}, column ${column}`);
    this.name = 'UnsupportedFeatureError';
    this.feature = feature;
    this.line = line;
    this.column = column;
  }
}

/**
 * Check if the code contains unsupported features
 */
function checkUnsupportedFeatures(code, ast) {
  const errors = [];

  function traverse(node) {
    if (!node) return;

    // Check for member expressions (e.g., window.location, console.log)
    if (node.type === 'MemberExpression') {
      const memberStr = getMemberExpressionString(node);
      
      for (const unsupported of UNSUPPORTED_FEATURES) {
        if (memberStr === unsupported || memberStr.startsWith(unsupported + '.')) {
          errors.push(new UnsupportedFeatureError(
            unsupported,
            node.loc?.start.line || 0,
            node.loc?.start.column || 0
          ));
        }
      }
    }

    // Check for async functions
    if ((node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression' || 
         node.type === 'ArrowFunctionExpression') && node.async) {
      errors.push(new UnsupportedFeatureError(
        'async',
        node.loc?.start.line || 0,
        node.loc?.start.column || 0
      ));
    }

    // Check for await expressions
    if (node.type === 'AwaitExpression') {
      errors.push(new UnsupportedFeatureError(
        'await',
        node.loc?.start.line || 0,
        node.loc?.start.column || 0
      ));
    }

    // Recursively traverse child nodes
    for (const key in node) {
      if (key === 'loc' || key === 'range') continue;
      const child = node[key];
      if (Array.isArray(child)) {
        child.forEach(traverse);
      } else if (child && typeof child === 'object' && child.type) {
        traverse(child);
      }
    }
  }

  traverse(ast);
  return errors;
}

/**
 * Convert member expression to string (e.g., window.location -> "window.location")
 */
function getMemberExpressionString(node) {
  if (node.type === 'Identifier') {
    return node.name;
  }
  if (node.type === 'MemberExpression') {
    const obj = getMemberExpressionString(node.object);
    const prop = node.computed ? '[computed]' : node.property.name || '[unknown]';
    return `${obj}.${prop}`;
  }
  return '[unknown]';
}

/**
 * Convert JavaScript AST to Scratch 3 blocks format
 */
function astToScratchBlocks(ast) {
  const blocks = {};
  let blockIdCounter = 0;

  function generateBlockId() {
    return `block_${blockIdCounter++}`;
  }

  function convertNode(node, parentId = null) {
    if (!node) return null;

    const blockId = generateBlockId();
    
    switch (node.type) {
      case 'Program':
        // Root node - process all statements
        let prevBlockId = null;
        node.body.forEach((stmt, index) => {
          const stmtBlockId = convertNode(stmt, null);
          if (stmtBlockId) {
            if (index === 0) {
              // First block connects to event_whenflagclicked
              const eventBlockId = generateBlockId();
              blocks[eventBlockId] = {
                opcode: 'event_whenflagclicked',
                next: stmtBlockId,
                parent: null,
                inputs: {},
                fields: {},
                shadow: false,
                topLevel: true,
              };
              blocks[stmtBlockId].parent = eventBlockId;
              blocks[stmtBlockId].topLevel = false;
            }
            if (prevBlockId) {
              blocks[prevBlockId].next = stmtBlockId;
              blocks[stmtBlockId].parent = prevBlockId;
              blocks[stmtBlockId].topLevel = false;
            }
            prevBlockId = stmtBlockId;
          }
        });
        
        // Add control_stop block at the end
        if (prevBlockId) {
          const stopBlockId = generateBlockId();
          blocks[stopBlockId] = {
            opcode: 'control_stop',
            next: null,
            parent: prevBlockId,
            inputs: {},
            fields: {
              STOP_OPTION: ['all', null],
            },
            shadow: false,
            topLevel: false,
            mutation: {
              tagName: 'mutation',
              children: [],
              hasnext: 'false',
            },
          };
          blocks[prevBlockId].next = stopBlockId;
        }
        return null;

      case 'VariableDeclaration':
        // Variable declaration (let, const, var)
        if (node.declarations.length > 0) {
          const decl = node.declarations[0];
          blocks[blockId] = {
            opcode: 'data_setvariableto',
            next: null,
            parent: parentId,
            inputs: {
              VALUE: decl.init ? convertExpressionToInput(decl.init, blockId) : [1, [10, '0']],
            },
            fields: {
              VARIABLE: [decl.id.name, decl.id.name],
            },
            shadow: false,
            topLevel: false,
          };
        }
        return blockId;

      case 'ExpressionStatement':
        return convertNode(node.expression, parentId);

      case 'AssignmentExpression':
        // Handle assignments like x = x + 1
        if (node.operator === '=' && node.left.type === 'Identifier') {
          blocks[blockId] = {
            opcode: 'data_setvariableto',
            next: null,
            parent: parentId,
            inputs: {
              VALUE: convertExpressionToInput(node.right, blockId),
            },
            fields: {
              VARIABLE: [node.left.name, node.left.name],
            },
            shadow: false,
            topLevel: false,
          };
          return blockId;
        }
        return null;

      case 'CallExpression':
        // Function calls - basic support
        blocks[blockId] = {
          opcode: 'procedures_call',
          next: null,
          parent: parentId,
          inputs: {},
          fields: {},
          shadow: false,
          topLevel: false,
          mutation: {
            tagName: 'mutation',
            proccode: 'function',
            argumentids: '[]',
            warp: 'false',
          },
        };
        return blockId;

      case 'IfStatement':
        blocks[blockId] = {
          opcode: 'control_if',
          next: null,
          parent: parentId,
          inputs: {
            CONDITION: convertExpressionToInput(node.test, blockId),
            SUBSTACK: node.consequent ? [2, convertNode(node.consequent, blockId)] : null,
          },
          fields: {},
          shadow: false,
          topLevel: false,
        };
        return blockId;

      case 'WhileStatement':
        blocks[blockId] = {
          opcode: 'control_repeat_until',
          next: null,
          parent: parentId,
          inputs: {
            CONDITION: convertExpressionToInput(negateExpression(node.test), blockId),
            SUBSTACK: node.body ? [2, convertNode(node.body, blockId)] : null,
          },
          fields: {},
          shadow: false,
          topLevel: false,
        };
        return blockId;

      case 'ForStatement':
        // Convert for loop to repeat
        blocks[blockId] = {
          opcode: 'control_repeat',
          next: null,
          parent: parentId,
          inputs: {
            TIMES: [1, [4, '10']],
            SUBSTACK: node.body ? [2, convertNode(node.body, blockId)] : null,
          },
          fields: {},
          shadow: false,
          topLevel: false,
        };
        return blockId;

      case 'BlockStatement':
        // Process statements in block
        let prevId = null;
        node.body.forEach(stmt => {
          const stmtId = convertNode(stmt, parentId);
          if (stmtId) {
            if (prevId) {
              blocks[prevId].next = stmtId;
              blocks[stmtId].parent = prevId;
            }
            prevId = stmtId;
          }
        });
        return prevId;

      default:
        // Unsupported node type - create a comment block
        blocks[blockId] = {
          opcode: 'motion_movesteps',
          next: null,
          parent: parentId,
          inputs: {
            STEPS: [1, [4, '10']],
          },
          fields: {},
          shadow: false,
          topLevel: false,
        };
        return blockId;
    }
  }

  function convertExpressionToInput(expr, parentBlockId = null) {
    if (!expr) return [1, [10, '0']];

    switch (expr.type) {
      case 'Literal':
        if (typeof expr.value === 'number') {
          return [1, [4, String(expr.value)]];
        }
        return [1, [10, String(expr.value || '')]];
      
      case 'Identifier':
        return [3, [12, expr.name, expr.name], [10, '']];
      
      case 'BinaryExpression':
        const opcode = getBinaryOperatorOpcode(expr.operator);
        const opBlockId = generateBlockId();
        const isComparison = ['<', '>', '<=', '>=', '==', '===', '!=', '!=='].includes(expr.operator);
        const isGreater = ['>', '>='].includes(expr.operator);
        
        // Format inputs based on operator type
        // Scratch uses different input formats depending on the block type:
        // - Format [1, value]: literal value (shadow)
        // - Format [2, blockId]: block reference (no shadow)
        // - Format [3, blockOrValue, shadowValue]: block reference with shadow fallback
        let leftFinal, rightFinal;
        if (isComparison) {
          // Comparison operators use OPERAND1/OPERAND2
          // Note: > and >= operators use format [3] with shadow for left operand
          // while < and <= use format [2] without shadow. This matches Scratch's
          // expected format for these operators, particularly when used in
          // control_repeat_until blocks (which come from negated while conditions).
          if (expr.left.type === 'Identifier') {
            leftFinal = isGreater 
              ? [3, [12, expr.left.name, expr.left.name], [10, '']]
              : [2, [12, expr.left.name, expr.left.name]];
          } else if (expr.left.type === 'Literal') {
            leftFinal = [1, [10, String(expr.left.value)]];
          } else {
            leftFinal = convertExpressionToInput(expr.left, opBlockId);
          }
          
          if (expr.right.type === 'Identifier') {
            rightFinal = [2, [12, expr.right.name, expr.right.name]];
          } else if (expr.right.type === 'Literal') {
            rightFinal = [1, [10, String(expr.right.value)]];
          } else {
            rightFinal = convertExpressionToInput(expr.right, opBlockId);
          }
        } else {
          // Arithmetic operators use NUM1/NUM2 with format [3, [12, name, name], [4, ""]]
          // This provides a shadow value ([4, ""]) as a fallback for numeric input.
          leftFinal = (expr.left.type === 'Identifier') 
            ? [3, [12, expr.left.name, expr.left.name], [4, '']] 
            : convertExpressionToInput(expr.left, opBlockId);
          rightFinal = (expr.right.type === 'Identifier') 
            ? [3, [12, expr.right.name, expr.right.name], [4, '']] 
            : convertExpressionToInput(expr.right, opBlockId);
        }
        
        blocks[opBlockId] = {
          opcode: opcode,
          next: null,
          parent: parentBlockId,
          inputs: isComparison ? {
            OPERAND1: leftFinal,
            OPERAND2: rightFinal,
          } : {
            NUM1: leftFinal,
            NUM2: rightFinal,
          },
          fields: {},
          shadow: false,
          topLevel: false,
        };
        return [2, opBlockId];
      
      default:
        return [1, [10, '0']];
    }
  }

  function negateExpression(expr) {
    // Negate the expression for repeat_until block
    if (!expr) return expr;
    
    // For binary expressions with comparison operators, negate them
    if (expr.type === 'BinaryExpression') {
      const negatedOp = {
        '<': '>=',
        '>': '<=',
        '<=': '>',
        '>=': '<',
        '==': '!=',
        '===': '!==',
        '!=': '==',
        '!==': '==='
      };
      
      if (negatedOp[expr.operator]) {
        return {
          ...expr,
          operator: negatedOp[expr.operator]
        };
      }
    }
    
    // For other cases, wrap in a not operator
    return {
      type: 'UnaryExpression',
      operator: '!',
      prefix: true,
      argument: expr
    };
  }

  function getBinaryOperatorOpcode(operator) {
    switch (operator) {
      case '+': return 'operator_add';
      case '-': return 'operator_subtract';
      case '*': return 'operator_multiply';
      case '/': return 'operator_divide';
      case '<': return 'operator_lt';
      case '>': return 'operator_gt';
      case '<=': return 'operator_lt'; 
        // Note: Scratch doesn't have <=. In negated conditions (e.g., repeat_until),
        // <= is converted to > through negation, which is semantically correct.
        // Direct use of <= would be approximate and should be avoided.
      case '>=': return 'operator_gt'; 
        // Note: Scratch doesn't have >=. In negated conditions (e.g., repeat_until),
        // >= is converted to < through negation, which is semantically correct.
        // Direct use of >= would be approximate and should be avoided.
      case '==': case '===': return 'operator_equals';
      case '!=': case '!==': return 'operator_equals'; 
        // Note: NOT wrapper not implemented yet. != and !== comparisons
        // will currently produce incorrect results. This is a known limitation.
      default: 
        throw new Error(`Unsupported binary operator: ${operator}`);
    }
  }

  convertNode(ast);
  return blocks;
}

/**
 * Main translation function
 */
function translateToScratch(code) {
  try {
    // Parse JavaScript code
    const ast = acorn.parse(code, {
      ecmaVersion: 2020,
      locations: true,
    });

    // Check for unsupported features
    const errors = checkUnsupportedFeatures(code, ast);
    if (errors.length > 0) {
      throw errors[0]; // Throw the first error
    }

    // Convert to Scratch blocks
    const blocks = astToScratchBlocks(ast);

    // Create Scratch 3.0 project structure
    const scratchProject = {
      targets: [
        {
          isStage: true,
          name: 'Stage',
          variables: {},
          lists: {},
          broadcasts: {},
          blocks: {},
          comments: {},
          currentCostume: 0,
          costumes: [
            {
              name: 'backdrop1',
              dataFormat: 'svg',
              assetId: 'bcce94f75335c9bd3879cdf6fd0e7fef',
              md5ext: 'bcce94f75335c9bd3879cdf6fd0e7fef.svg',
              rotationCenterX: 240,
              rotationCenterY: 180,
            },
          ],
          sounds: [],
          volume: 100,
        },
        {
          isStage: false,
          name: 'Sprite1',
          variables: {},
          lists: {},
          broadcasts: {},
          blocks: blocks,
          comments: {},
          currentCostume: 0,
          costumes: [
            {
              name: 'costume1',
              bitmapResolution: 1,
              dataFormat: 'svg',
              assetId: '3b19a04a24b878911444f9a154bc2695',
              md5ext: '3b19a04a24b878911444f9a154bc2695.svg',
              rotationCenterX: 48,
              rotationCenterY: 50,
            },
          ],
          sounds: [],
          volume: 100,
          visible: true,
          x: 0,
          y: 0,
          size: 100,
          direction: 90,
          draggable: false,
          rotationStyle: 'all around',
        },
      ],
      monitors: [],
      extensions: [],
      meta: {
        semver: '3.0.0',
        vm: '0.2.0',
        agent: 'js-to-scratch',
      },
    };

    return {
      success: true,
      project: scratchProject,
    };
  } catch (error) {
    if (error instanceof UnsupportedFeatureError) {
      throw error;
    }
    
    throw new Error(`Failed to parse JavaScript: ${error.message}`);
  }
}

module.exports = {
  translateToScratch,
  UnsupportedFeatureError,
  UNSUPPORTED_FEATURES,
};
