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
  const functionDefinitions = new Map(); // Store arrow function definitions
  const variables = new Set(); // Store all variable names

  function generateBlockId() {
    return `block_${blockIdCounter++}`;
  }

<<<<<<< HEAD
  // First pass: collect function definitions (arrow functions, function expressions, and function declarations)
  function collectFunctions(node) {
=======
  // First pass: collect function definitions (both arrow and regular) and variables
  function collectFunctionsAndVariables(node) {
>>>>>>> 19f29ad (feat: support comparison operators and function declarations with return)
    if (!node) return;

    // Collect arrow functions and function expressions from variable declarations
    if (node.type === 'VariableDeclaration') {
      node.declarations.forEach(decl => {
        if (decl.init && (decl.init.type === 'ArrowFunctionExpression' || decl.init.type === 'FunctionExpression')) {
          functionDefinitions.set(decl.id.name, {
            params: decl.init.params,
            body: decl.init.body
          });
        } else {
          // Collect variable name
          variables.add(decl.id.name);
        }
      });
    }

<<<<<<< HEAD
    // Collect named function declarations
    if (node.type === 'FunctionDeclaration' && node.id) {
=======
    // Collect function declarations (function name() { ... })
    if (node.type === 'FunctionDeclaration') {
>>>>>>> 19f29ad (feat: support comparison operators and function declarations with return)
      functionDefinitions.set(node.id.name, {
        params: node.params,
        body: node.body
      });
    }

    // Traverse children
    for (const key in node) {
      if (key === 'loc' || key === 'range') continue;
      const child = node[key];
      if (Array.isArray(child)) {
        child.forEach(collectFunctionsAndVariables);
      } else if (child && typeof child === 'object' && child.type) {
        collectFunctionsAndVariables(child);
      }
    }
  }

  // Collect all function definitions and variables first
  collectFunctionsAndVariables(ast);
  
  // Second pass: collect all variable references from assignments and expressions
  function collectVariableReferences(node) {
    if (!node) return;

    if (node.type === 'AssignmentExpression' && node.left.type === 'Identifier') {
      variables.add(node.left.name);
    }

    // Traverse children
    for (const key in node) {
      if (key === 'loc' || key === 'range') continue;
      const child = node[key];
      if (Array.isArray(child)) {
        child.forEach(collectVariableReferences);
      } else if (child && typeof child === 'object' && child.type) {
        collectVariableReferences(child);
      }
    }
  }

  collectVariableReferences(ast);
  
  // Third pass: remove function names and function parameter names from variables
  functionDefinitions.forEach((funcDef, funcName) => {
    // Remove function name (it's not a variable)
    variables.delete(funcName);
    // Remove function parameter names (they're not real variables)
    funcDef.params.forEach(param => {
      // Handle both Identifier objects and string names
      const paramName = param.name || (param.type === 'Identifier' ? param.name : param);
      variables.delete(paramName);
    });
  });

  function convertNode(node, parentId = null) {
    if (!node) return null;

    const blockId = generateBlockId();
    
    switch (node.type) {
      case 'Program':
        // Root node - process all statements
        let prevBlockId = null;
        let firstBlockId = null;
        node.body.forEach((stmt) => {
          const stmtBlockId = convertNode(stmt, null);
          if (stmtBlockId) {
            if (firstBlockId === null) {
              // Track the first non-null block
              firstBlockId = stmtBlockId;
            }
            if (prevBlockId) {
              blocks[prevBlockId].next = stmtBlockId;
              blocks[stmtBlockId].parent = prevBlockId;
              blocks[stmtBlockId].topLevel = false;
            }
            prevBlockId = stmtBlockId;
          }
        });
        
        // Create event block and link to first actual block
        if (firstBlockId) {
          const eventBlockId = generateBlockId();
          blocks[eventBlockId] = {
            opcode: 'event_whenflagclicked',
            next: firstBlockId,
            parent: null,
            inputs: {},
            fields: {},
            shadow: false,
            topLevel: true,
          };
          blocks[firstBlockId].parent = eventBlockId;
          blocks[firstBlockId].topLevel = false;
        }
        
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
          // Skip function declarations (arrow functions and function expressions) - they will be inlined when called
          if (decl.init && (decl.init.type === 'ArrowFunctionExpression' || decl.init.type === 'FunctionExpression')) {
            return null;
          }
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

      case 'FunctionDeclaration':
        // Skip function declarations - they will be inlined when called
        return null;

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
        // Handle special scratch functions
        if (node.callee.type === 'Identifier') {
          if (node.callee.name === 'scratch_say' && node.arguments.length > 0) {
            // Create a "say" block
            blocks[blockId] = {
              opcode: 'looks_say',
              next: null,
              parent: parentId,
              inputs: {
                MESSAGE: convertExpressionToInput(node.arguments[0], blockId),
              },
              fields: {},
              shadow: false,
              topLevel: false,
            };
            return blockId;
          }
        }
        
        // Function calls are handled in convertExpressionToInput for inlining
        // If we reach here, it means the function call is not in an expression context
        // This shouldn't happen in normal code, but we'll handle it gracefully
        return null;

      case 'FunctionDeclaration':
        // Function declarations are collected in the first pass and skipped here
        // They will be inlined when called
        return null;

      case 'ReturnStatement':
        // Return statements are handled when inlining functions
        // If we see one at top level, it's an error, but we'll ignore it
        return null;

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
        // Unsupported node type - return null to skip it
        return null;
    }
  }

  function substituteParameters(expr, paramMap) {
    if (!expr) return expr;

    // Create a deep copy and substitute parameters
    function substitute(node) {
      if (!node) return node;

      if (node.type === 'Identifier' && paramMap.has(node.name)) {
        // Replace parameter with argument
        return paramMap.get(node.name);
      }

      // For all other node types, recursively substitute in children
      const newNode = { ...node };
      for (const key in newNode) {
        if (key === 'loc' || key === 'range') continue;
        const child = newNode[key];
        if (Array.isArray(child)) {
          newNode[key] = child.map(substitute);
        } else if (child && typeof child === 'object' && child.type) {
          newNode[key] = substitute(child);
        }
      }
      return newNode;
    }

    return substitute(expr);
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
      
      case 'CallExpression':
<<<<<<< HEAD
        // Handle function calls by inlining functions
=======
        // Handle function calls by inlining functions (both arrow and regular)
>>>>>>> 19f29ad (feat: support comparison operators and function declarations with return)
        if (expr.callee.type === 'Identifier') {
          const funcName = expr.callee.name;
          const funcDef = functionDefinitions.get(funcName);
          
          if (funcDef) {
            // Create a parameter substitution map
            const paramMap = new Map();
            funcDef.params.forEach((param, index) => {
              // Handle both Identifier objects and string names
              const paramName = param.name || (param.type === 'Identifier' ? param.name : param);
              if (index < expr.arguments.length) {
                paramMap.set(paramName, expr.arguments[index]);
              } else {
                // Default missing parameters to 0 (Scratch default for numbers)
                paramMap.set(paramName, { type: 'Literal', value: 0 });
              }
            });
            
<<<<<<< HEAD
            // Extract the expression to inline
            let bodyExpression = funcDef.body;
            
            // If the body is a BlockStatement, find the return statement
            // Note: This only handles simple functions with a single return statement.
            // Functions with multiple return paths or conditional returns are not fully supported.
            if (funcDef.body.type === 'BlockStatement') {
              const returnStmt = funcDef.body.body.find(stmt => stmt.type === 'ReturnStatement');
              if (returnStmt && returnStmt.argument) {
                bodyExpression = returnStmt.argument;
              } else {
                // No return statement found, default to 0
                return [1, [10, '0']];
=======
            // Handle function body - extract return value if it's a block statement
            let bodyExpr = funcDef.body;
            if (bodyExpr.type === 'BlockStatement') {
              // Find the return statement in the block
              const returnStmt = bodyExpr.body.find(stmt => stmt.type === 'ReturnStatement');
              if (returnStmt && returnStmt.argument) {
                bodyExpr = returnStmt.argument;
              } else {
                // No return statement, default to 0
                return [1, [4, '0']];
>>>>>>> 19f29ad (feat: support comparison operators and function declarations with return)
              }
            }
            
            // Inline the function body with substituted parameters
<<<<<<< HEAD
            const inlinedBody = substituteParameters(bodyExpression, paramMap);
=======
            const inlinedBody = substituteParameters(bodyExpr, paramMap);
>>>>>>> 19f29ad (feat: support comparison operators and function declarations with return)
            return convertExpressionToInput(inlinedBody, parentBlockId);
          }
        }
        // If not a known function, return default
        return [1, [10, '0']];
      
      case 'UnaryExpression':
        // Handle unary operators like ! (not)
        if (expr.operator === '!') {
          const notBlockId = generateBlockId();
          const operandInput = convertExpressionToInput(expr.argument, notBlockId);
          
          blocks[notBlockId] = {
            opcode: 'operator_not',
            next: null,
            parent: parentBlockId,
            inputs: {
              OPERAND: operandInput,
            },
            fields: {},
            shadow: false,
            topLevel: false,
          };
          return [2, notBlockId];
        }
        // For other unary operators, return default
        return [1, [10, '0']];
      
      case 'BinaryExpression':
        const needsNot = ['!=', '!==', '<=', '>='].includes(expr.operator);
        let actualOperator = expr.operator;
        let shouldNegate = false;
        
        // Transform operators that need negation
        if (expr.operator === '!=' || expr.operator === '!==') {
          // != and !== become == wrapped in not
          actualOperator = '==';
          shouldNegate = true;
        } else if (expr.operator === '<=') {
          // <= becomes > wrapped in not (not (a > b) = a <= b)
          actualOperator = '>';
          shouldNegate = true;
        } else if (expr.operator === '>=') {
          // >= becomes < wrapped in not (not (a < b) = a >= b)
          actualOperator = '<';
          shouldNegate = true;
        }
        
        const opcode = getBinaryOperatorOpcode(actualOperator);
        const opBlockId = generateBlockId();
        const isComparison = ['<', '>', '==', '==='].includes(actualOperator);
        const isGreater = actualOperator === '>';
        
        // Format inputs based on operator type
        // Scratch uses different input formats depending on the block type:
        // - Format [1, value]: literal value (shadow)
        // - Format [2, blockId]: block reference (no shadow)
        // - Format [3, blockOrValue, shadowValue]: block reference with shadow fallback
        let leftFinal, rightFinal;
        if (isComparison) {
          // Comparison operators use OPERAND1/OPERAND2
          // Note: > operators use format [3] with shadow for left operand
          // while < use format [2] without shadow. This matches Scratch's
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
        
        // Wrap in not operator if needed
        if (shouldNegate) {
          const notBlockId = generateBlockId();
          blocks[notBlockId] = {
            opcode: 'operator_not',
            next: null,
            parent: parentBlockId,
            inputs: {
              OPERAND: [2, opBlockId],
            },
            fields: {},
            shadow: false,
            topLevel: false,
          };
          return [2, notBlockId];
        }
        
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
      case '==': case '===': return 'operator_equals';
      // Note: <=, >=, !=, and !== are handled by wrapping the base operator in operator_not
      // <= becomes not (>), >= becomes not (<), != becomes not (==)
      default: 
        throw new Error(`Unsupported binary operator: ${operator}`);
    }
  }

  convertNode(ast);
  return { blocks, variables: Array.from(variables) };
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
    const { blocks, variables } = astToScratchBlocks(ast);

    // Create variables object for Scratch
    const variablesObj = {};
    variables.forEach(varName => {
      variablesObj[varName] = [varName, 0]; // [name, value]
    });

    // Check if blocks contain canvas text operations (looks_say blocks)
    // If so, make sprite invisible since canvas doesn't show sprites
    const hasCanvasText = Object.values(blocks).some(
      block => block.opcode === 'looks_say'
    );

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
          variables: variablesObj,
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
          visible: !hasCanvasText,
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
