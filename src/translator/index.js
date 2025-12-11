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
  const lists = new Set(); // Store all list/array names
  const objectMappings = new Map(); // Map object names to their flattened properties

  function generateBlockId() {
    return `block_${blockIdCounter++}`;
  }

  // First pass: collect function definitions (both arrow and regular), variables, and arrays
  function collectFunctionsAndVariables(node) {
    if (!node) return;

    // Collect arrow functions and function expressions from variable declarations
    if (node.type === 'VariableDeclaration') {
      node.declarations.forEach(decl => {
        if (decl.init && (decl.init.type === 'ArrowFunctionExpression' || decl.init.type === 'FunctionExpression')) {
          functionDefinitions.set(decl.id.name, {
            params: decl.init.params,
            body: decl.init.body
          });
        } else if (decl.init && decl.init.type === 'ArrayExpression') {
          // Array declaration: let arr = [1, 2, 3]
          lists.add(decl.id.name);
        } else {
          // Collect variable name
          variables.add(decl.id.name);
        }
      });
    }

    // Collect function declarations (function name() { ... })
    if (node.type === 'FunctionDeclaration') {
      functionDefinitions.set(node.id.name, {
        params: node.params,
        body: node.body
      });
    }

    // Detect array access: arr[i], arr.length
    if (node.type === 'MemberExpression') {
      if (node.object.type === 'Identifier' && 
          (node.computed || node.property.name === 'length')) {
        // arr[i] or arr.length
        lists.add(node.object.name);
      }
    }

    // Detect array methods: arr.push(), arr.pop(), etc.
    if (node.type === 'CallExpression' && 
        node.callee.type === 'MemberExpression' &&
        node.callee.object.type === 'Identifier') {
      const methodName = node.callee.property.name;
      if (['push', 'pop', 'shift', 'unshift', 'splice', 'slice'].includes(methodName)) {
        lists.add(node.callee.object.name);
      }
    }

    // Detect object expressions: {a: 1, b: 2}
    if (node.type === 'VariableDeclaration') {
      node.declarations.forEach(decl => {
        if (decl.init && decl.init.type === 'ObjectExpression') {
          const objName = decl.id.name;
          const props = [];
          decl.init.properties.forEach(prop => {
            if (prop.key.type === 'Identifier' || 
                (prop.key.type === 'Literal' && typeof prop.key.value === 'string')) {
              const propName = prop.key.name || prop.key.value;
              props.push(propName);
              // Create flattened variable name: obj_prop
              const flatName = `${objName}_${propName}`;
              variables.add(flatName);
            }
          });
          objectMappings.set(objName, props);
        }
      });
    }

    // Detect object property access: obj.prop, obj['prop']
    if (node.type === 'MemberExpression' &&
        node.object.type === 'Identifier' &&
        !node.computed && 
        node.property.type === 'Identifier') {
      // obj.prop - check if obj is in objectMappings
      const objName = node.object.name;
      if (objectMappings.has(objName)) {
        const propName = node.property.name;
        const flatName = `${objName}_${propName}`;
        variables.add(flatName);
      }
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
  
  // Third pass: detect recursive functions and remove function names/parameters from variables
  const recursiveFunctions = new Set(); // Track which functions are recursive
  
  /**
   * Detect if a function is recursive by checking if it calls itself
   * @param {string} funcName - Name of the function to check
   * @param {Object} funcBody - Function body AST node
   * @returns {boolean} True if function is recursive
   */
  function isRecursive(funcName, funcBody) {
    if (!funcBody) return false;
    
    let foundRecursive = false;
    
    function checkNode(node) {
      if (!node) return;
      
      // Check for function call with same name
      if (node.type === 'CallExpression' &&
          node.callee.type === 'Identifier' &&
          node.callee.name === funcName) {
        foundRecursive = true;
        return;
      }
      
      // Traverse children
      for (const key in node) {
        if (key === 'loc' || key === 'range') continue;
        const child = node[key];
        if (Array.isArray(child)) {
          child.forEach(checkNode);
        } else if (child && typeof child === 'object' && child.type) {
          checkNode(child);
        }
      }
    }
    
    checkNode(funcBody);
    return foundRecursive;
  }
  
  // Detect recursive functions
  functionDefinitions.forEach((funcDef, funcName) => {
    if (isRecursive(funcName, funcDef.body)) {
      recursiveFunctions.add(funcName);
    }
    
    // Remove function name (it's not a variable)
    variables.delete(funcName);
    // Remove function parameter names (they're not real variables)
    funcDef.params.forEach(param => {
      // Handle both Identifier objects and string names
      const paramName = param.name || (param.type === 'Identifier' ? param.name : param);
      variables.delete(paramName);
    });
  });

  /**
   * Convert a complex for loop to a while loop equivalent
   * @param {Object} node - ForStatement AST node
   * @param {Object} analysis - Result from analyzeForLoop
   * @param {string|null} parentId - Parent block ID
   * @returns {string} Block ID of the first block created
   */
  function convertComplexForLoop(node, analysis, parentId) {
    // Convert: for (init; test; update) { body }
    // To: init; while (test) { body; update; }
    
    let firstBlockId = null;
    let prevBlockId = null;
    
    // 1. Process init statement (if exists)
    if (node.init) {
      const initBlockId = convertNode(node.init, parentId);
      if (initBlockId) {
        firstBlockId = initBlockId;
        prevBlockId = initBlockId;
      }
    }
    
    // 2. Create while loop with test condition
    const whileBlockId = generateBlockId();
    blocks[whileBlockId] = {
      opcode: 'control_repeat_until',
      next: null,
      parent: prevBlockId || parentId,
      inputs: {
        CONDITION: convertExpressionToInput(negateExpression(analysis.condition || { type: 'Literal', value: true }), whileBlockId),
        SUBSTACK: null,
      },
      fields: {},
      shadow: false,
      topLevel: false,
    };
    
    if (prevBlockId) {
      blocks[prevBlockId].next = whileBlockId;
    } else {
      firstBlockId = whileBlockId;
    }
    
    // 3. Process body
    let bodyStartId = null;
    if (node.body) {
      bodyStartId = convertNode(node.body, whileBlockId);
    }
    
    // 4. Process update statement (if exists) - add at end of body
    let lastBodyBlockId = bodyStartId;
    if (bodyStartId) {
      // Find the last block in the body
      let current = bodyStartId;
      while (blocks[current] && blocks[current].next) {
        current = blocks[current].next;
      }
      lastBodyBlockId = current;
    }
    
    if (node.update) {
      const updateBlockId = convertNode(node.update, lastBodyBlockId || whileBlockId);
      if (updateBlockId) {
        if (lastBodyBlockId) {
          blocks[lastBodyBlockId].next = updateBlockId;
        } else {
          bodyStartId = updateBlockId;
        }
      }
    }
    
    // Link body to while loop
    if (bodyStartId) {
      blocks[whileBlockId].inputs.SUBSTACK = [2, bodyStartId];
    }
    
    return firstBlockId || whileBlockId;
  }

  /**
   * Analyze a ForStatement node to extract its components
   * @param {Object} node - ForStatement AST node
   * @returns {Object} Analysis result with initVar, initValue, condition, update, type
   */
  function analyzeForLoop(node) {
    let initVar = null;
    let initValue = null;
    let condition = node.test;
    let update = node.update;
    let type = 'complex';

    // Parse init: can be VariableDeclaration or ExpressionStatement
    if (node.init) {
      if (node.init.type === 'VariableDeclaration' && node.init.declarations.length > 0) {
        const decl = node.init.declarations[0];
        if (decl.id.type === 'Identifier') {
          initVar = decl.id.name;
          initValue = decl.init;
          variables.add(initVar); // Collect loop variable
        }
      } else if (node.init.type === 'ExpressionStatement') {
        // Expression like i = 0
        if (node.init.expression.type === 'AssignmentExpression' &&
            node.init.expression.left.type === 'Identifier') {
          initVar = node.init.expression.left.name;
          initValue = node.init.expression.right;
          variables.add(initVar);
        }
      }
    }

    // Determine if it's a simple loop: for (let i = start; i < end; i++)
    if (initVar && condition && update) {
      // Check if condition is a simple comparison: i < n, i <= n, etc.
      if (condition.type === 'BinaryExpression' &&
          condition.left.type === 'Identifier' &&
          condition.left.name === initVar) {
        // Check if update is i++ or i += n
        let isSimpleUpdate = false;
        if (update.type === 'UpdateExpression' &&
            update.argument.type === 'Identifier' &&
            update.argument.name === initVar &&
            update.operator === '++') {
          isSimpleUpdate = true;
        } else if (update.type === 'AssignmentExpression' &&
                   update.left.type === 'Identifier' &&
                   update.left.name === initVar &&
                   update.operator === '+=' &&
                   update.right.type === 'Literal' &&
                   update.right.value === 1) {
          isSimpleUpdate = true;
        }

        if (isSimpleUpdate && 
            (condition.operator === '<' || condition.operator === '<=')) {
          type = 'simple';
        }
      }
    }

    return {
      initVar,
      initValue,
      condition,
      update,
      type
    };
  }

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
          // Skip array declarations - they are handled separately in lists object
          if (decl.init && decl.init.type === 'ArrayExpression') {
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
        // Function declarations: if recursive, create procedure block; otherwise skip (will be inlined)
        if (recursiveFunctions.has(node.id.name)) {
          // Create procedures_definition block for recursive functions
          const procBlockId = generateBlockId();
          const paramIds = node.params.map((param, idx) => {
            const paramName = param.name || (param.type === 'Identifier' ? param.name : `param${idx}`);
            return paramName;
          });
          
          blocks[procBlockId] = {
            opcode: 'procedures_definition',
            next: null,
            parent: parentId,
            inputs: {},
            fields: {},
            shadow: false,
            topLevel: true,
            mutation: {
              tagName: 'mutation',
              proccode: node.id.name,
              argumentids: JSON.stringify(paramIds),
              warp: 'false',
              children: []
            }
          };
          
          // Process function body - need to handle return statements specially
          let bodyStartId = null;
          if (node.body && node.body.type === 'BlockStatement') {
            // Convert body statements, but handle return specially
            let prevStmtId = null;
            node.body.body.forEach((stmt, idx) => {
              if (stmt.type === 'ReturnStatement') {
                // For recursive functions, return values need special handling
                // For now, we'll just process the return expression
                if (stmt.argument) {
                  const returnExprId = convertExpressionToInput(stmt.argument, procBlockId);
                  // In Scratch procedures, return is implicit - last value is returned
                  // We'll need to store it in a special variable or handle it differently
                }
              } else {
                const stmtId = convertNode(stmt, procBlockId);
                if (stmtId) {
                  if (prevStmtId) {
                    blocks[prevStmtId].next = stmtId;
                    blocks[stmtId].parent = prevStmtId;
                  } else {
                    bodyStartId = stmtId;
                  }
                  prevStmtId = stmtId;
                }
              }
            });
          }
          
          if (bodyStartId) {
            // Link body to procedure definition
            // Note: Scratch procedures use a special input structure
            // For now, we'll store the body start ID in a custom way
            blocks[procBlockId].next = bodyStartId;
            blocks[bodyStartId].parent = procBlockId;
          }
          
          return procBlockId;
        }
        // Non-recursive functions are skipped (will be inlined when called)
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
        
        // Handle array assignment: arr[i] = value
        if (node.operator === '=' && 
            node.left.type === 'MemberExpression' &&
            node.left.object.type === 'Identifier' &&
            node.left.computed) {
          const listName = node.left.object.name;
          if (lists.has(listName)) {
            const indexExpr = node.left.property;
            blocks[blockId] = {
              opcode: 'data_replaceitemoflist',
              next: null,
              parent: parentId,
              inputs: {
                INDEX: convertExpressionToInput(indexExpr, blockId),
                ITEM: convertExpressionToInput(node.right, blockId),
              },
              fields: {
                LIST: [listName, listName],
              },
              shadow: false,
              topLevel: false,
            };
            return blockId;
          }
        }
        
        // Handle object property assignment: obj.prop = value or obj['prop'] = value
        if (node.operator === '=' && 
            node.left.type === 'MemberExpression' &&
            node.left.object.type === 'Identifier') {
          const objName = node.left.object.name;
          if (objectMappings.has(objName)) {
            let propName = null;
            if (!node.left.computed && node.left.property.type === 'Identifier') {
              // obj.prop = value
              propName = node.left.property.name;
            } else if (node.left.computed && node.left.property.type === 'Literal' &&
                       typeof node.left.property.value === 'string') {
              // obj['prop'] = value
              propName = node.left.property.value;
            }
            
            if (propName) {
              const flatName = `${objName}_${propName}`;
              blocks[blockId] = {
                opcode: 'data_setvariableto',
                next: null,
                parent: parentId,
                inputs: {
                  VALUE: convertExpressionToInput(node.right, blockId),
                },
                fields: {
                  VARIABLE: [flatName, flatName],
                },
                shadow: false,
                topLevel: false,
              };
              return blockId;
            }
          }
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
        
        // Handle array methods: arr.push(), arr.pop(), etc.
        if (node.callee.type === 'MemberExpression' &&
            node.callee.object.type === 'Identifier') {
          const listName = node.callee.object.name;
          const methodName = node.callee.property.name;
          
          if (lists.has(listName)) {
            if (methodName === 'push' && node.arguments.length > 0) {
              // arr.push(x) → data_addtolist
              blocks[blockId] = {
                opcode: 'data_addtolist',
                next: null,
                parent: parentId,
                inputs: {
                  ITEM: convertExpressionToInput(node.arguments[0], blockId),
                },
                fields: {
                  LIST: [listName, listName],
                },
                shadow: false,
                topLevel: false,
              };
              return blockId;
            } else if (methodName === 'pop') {
              // arr.pop() → data_deleteoflist (last item)
              const lengthBlockId = generateBlockId();
              blocks[lengthBlockId] = {
                opcode: 'data_lengthoflist',
                next: null,
                parent: blockId,
                inputs: {},
                fields: {
                  LIST: [listName, listName],
                },
                shadow: false,
                topLevel: false,
              };
              
              blocks[blockId] = {
                opcode: 'data_deleteoflist',
                next: null,
                parent: parentId,
                inputs: {
                  INDEX: [2, lengthBlockId], // Last item
                },
                fields: {
                  LIST: [listName, listName],
                },
                shadow: false,
                topLevel: false,
              };
              return blockId;
            }
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
        // Analyze the for loop
        const forAnalysis = analyzeForLoop(node);
        
        if (forAnalysis.type === 'simple' && forAnalysis.initVar && forAnalysis.condition) {
          // Simple for loop: for (let i = start; i < end; i++)
          // Convert to: initialize i; repeat (end - start) times { body; increment i; }
          
          // Extract end value from condition (i < end or i <= end)
          const endExpr = forAnalysis.condition.right;
          const startExpr = forAnalysis.initValue;
          
          // Calculate TIMES: end - start (or end - start + 1 for <=)
          let timesExpr;
          if (forAnalysis.condition.operator === '<') {
            // end - start
            timesExpr = {
              type: 'BinaryExpression',
              operator: '-',
              left: endExpr,
              right: startExpr
            };
          } else if (forAnalysis.condition.operator === '<=') {
            // end - start + 1
            timesExpr = {
              type: 'BinaryExpression',
              operator: '+',
              left: {
                type: 'BinaryExpression',
                operator: '-',
                left: endExpr,
                right: startExpr
              },
              right: { type: 'Literal', value: 1 }
            };
          } else {
            // Fallback to complex loop
            return convertComplexForLoop(node, forAnalysis, parentId);
          }
          
          // Create initialization block for loop variable
          const initBlockId = generateBlockId();
          blocks[initBlockId] = {
            opcode: 'data_setvariableto',
            next: null,
            parent: parentId,
            inputs: {
              VALUE: convertExpressionToInput(startExpr, initBlockId),
            },
            fields: {
              VARIABLE: [forAnalysis.initVar, forAnalysis.initVar],
            },
            shadow: false,
            topLevel: false,
          };
          
          // Create repeat block
          blocks[blockId] = {
            opcode: 'control_repeat',
            next: null,
            parent: initBlockId,
            inputs: {
              TIMES: convertExpressionToInput(timesExpr, blockId),
              SUBSTACK: null,
            },
            fields: {},
            shadow: false,
            topLevel: false,
          };
          
          // Process body
          let bodyStartId = null;
          if (node.body) {
            bodyStartId = convertNode(node.body, blockId);
          }
          
          // Create increment block
          const incrementBlockId = generateBlockId();
          let incrementExpr;
          if (forAnalysis.update.type === 'UpdateExpression' && 
              forAnalysis.update.operator === '++') {
            // i++ becomes i = i + 1
            incrementExpr = {
              type: 'BinaryExpression',
              operator: '+',
              left: { type: 'Identifier', name: forAnalysis.initVar },
              right: { type: 'Literal', value: 1 }
            };
          } else if (forAnalysis.update.type === 'AssignmentExpression' &&
                     forAnalysis.update.operator === '+=') {
            // i += n becomes i = i + n
            incrementExpr = {
              type: 'BinaryExpression',
              operator: '+',
              left: { type: 'Identifier', name: forAnalysis.initVar },
              right: forAnalysis.update.right
            };
          } else {
            incrementExpr = forAnalysis.update;
          }
          
          blocks[incrementBlockId] = {
            opcode: 'data_setvariableto',
            next: null,
            parent: bodyStartId || blockId,
            inputs: {
              VALUE: convertExpressionToInput(incrementExpr, incrementBlockId),
            },
            fields: {
              VARIABLE: [forAnalysis.initVar, forAnalysis.initVar],
            },
            shadow: false,
            topLevel: false,
          };
          
          // Link blocks together
          blocks[initBlockId].next = blockId;
          
          if (bodyStartId) {
            // Find the last block in the body
            let lastBodyBlockId = bodyStartId;
            while (blocks[lastBodyBlockId] && blocks[lastBodyBlockId].next) {
              lastBodyBlockId = blocks[lastBodyBlockId].next;
            }
            blocks[lastBodyBlockId].next = incrementBlockId;
            blocks[incrementBlockId].parent = lastBodyBlockId;
            blocks[blockId].inputs.SUBSTACK = [2, bodyStartId];
          } else {
            // No body, just increment
            blocks[blockId].inputs.SUBSTACK = [2, incrementBlockId];
            blocks[incrementBlockId].parent = blockId;
          }
          
          return initBlockId;
        } else {
          // Complex for loop - convert to while loop equivalent
          return convertComplexForLoop(node, forAnalysis, parentId);
        }

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
      
      case 'MemberExpression':
        // Handle array access: arr[i] and arr.length
        if (expr.object.type === 'Identifier') {
          const objName = expr.object.name;
          
          // Check if it's a list
          if (lists.has(objName)) {
            // arr.length
            if (!expr.computed && expr.property.name === 'length') {
              const lengthBlockId = generateBlockId();
              blocks[lengthBlockId] = {
                opcode: 'data_lengthoflist',
                next: null,
                parent: parentBlockId,
                inputs: {},
                fields: {
                  LIST: [objName, objName],
                },
                shadow: false,
                topLevel: false,
              };
              return [2, lengthBlockId];
            }
            
            // arr[i] - array access
            if (expr.computed) {
              const indexExpr = expr.property;
              const itemBlockId = generateBlockId();
              blocks[itemBlockId] = {
                opcode: 'data_itemoflist',
                next: null,
                parent: parentBlockId,
                inputs: {
                  INDEX: convertExpressionToInput(indexExpr, itemBlockId),
                },
                fields: {
                  LIST: [objName, objName],
                },
                shadow: false,
                topLevel: false,
              };
              return [2, itemBlockId];
            }
          }
          
          // Handle object property access: obj.prop or obj['prop']
          if (objectMappings.has(objName)) {
            let propName = null;
            if (!expr.computed && expr.property.type === 'Identifier') {
              // obj.prop
              propName = expr.property.name;
            } else if (expr.computed && expr.property.type === 'Literal' && 
                       typeof expr.property.value === 'string') {
              // obj['prop']
              propName = expr.property.value;
            }
            
            if (propName) {
              const flatName = `${objName}_${propName}`;
              // Return reference to flattened variable
              return [3, [12, flatName, flatName], [10, '']];
            }
          }
        }
        // For non-array, non-object member expressions, return default
        return [1, [10, '0']];
      
      case 'CallExpression':
        // Handle function calls: recursive functions use procedures_call, others are inlined
        if (expr.callee.type === 'Identifier') {
          const funcName = expr.callee.name;
          
          // Check if it's a recursive function
          if (recursiveFunctions.has(funcName)) {
            // Create procedures_call block for recursive functions
            const callBlockId = generateBlockId();
            const funcDef = functionDefinitions.get(funcName);
            const paramIds = funcDef ? funcDef.params.map((param, idx) => {
              const paramName = param.name || (param.type === 'Identifier' ? param.name : `param${idx}`);
              return paramName;
            }) : [];
            
            // Build inputs for procedure call
            const inputs = {};
            paramIds.forEach((paramId, idx) => {
              if (idx < expr.arguments.length) {
                inputs[paramId] = convertExpressionToInput(expr.arguments[idx], callBlockId);
              } else {
                inputs[paramId] = [1, [4, '0']]; // Default to 0
              }
            });
            
            blocks[callBlockId] = {
              opcode: 'procedures_call',
              next: null,
              parent: parentBlockId,
              inputs: inputs,
              fields: {},
              shadow: false,
              topLevel: false,
              mutation: {
                tagName: 'mutation',
                proccode: funcName,
                argumentids: JSON.stringify(paramIds),
                warp: 'false'
              }
            };
            return [2, callBlockId];
          }
          
          // Non-recursive function: inline it
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
              }
            }
            
            // Inline the function body with substituted parameters
            const inlinedBody = substituteParameters(bodyExpr, paramMap);
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
  return { blocks, variables: Array.from(variables), lists: Array.from(lists), objectMappings };
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
    const { blocks, variables, lists, objectMappings } = astToScratchBlocks(ast);

    // Create variables object for Scratch
    const variablesObj = {};
    variables.forEach(varName => {
      variablesObj[varName] = [varName, 0]; // [name, value]
    });

    // Create lists object for Scratch with initial values
    const listsObj = {};
    const arrayInitialValues = new Map(); // Store initial values for arrays
    const objectInitialValues = new Map(); // Store initial values for objects
    
    // Collect initial values from ArrayExpression and ObjectExpression declarations
    function collectInitialValues(node) {
      if (!node) return;
      
      if (node.type === 'VariableDeclaration') {
        node.declarations.forEach(decl => {
          if (decl.init && decl.init.type === 'ArrayExpression') {
            const values = decl.init.elements.map(elem => {
              if (elem.type === 'Literal') {
                return String(elem.value);
              }
              return ''; // Non-literal values default to empty string
            });
            arrayInitialValues.set(decl.id.name, values);
          } else if (decl.init && decl.init.type === 'ObjectExpression') {
            // Store object initial values for flattened variables
            const objValues = new Map();
            decl.init.properties.forEach(prop => {
              if (prop.key.type === 'Identifier' || 
                  (prop.key.type === 'Literal' && typeof prop.key.value === 'string')) {
                const propName = prop.key.name || prop.key.value;
                let propValue = 0;
                if (prop.value.type === 'Literal') {
                  propValue = typeof prop.value.value === 'number' ? prop.value.value : 0;
                }
                objValues.set(propName, propValue);
              }
            });
            objectInitialValues.set(decl.id.name, objValues);
          }
        });
      }
      
      // Traverse children
      for (const key in node) {
        if (key === 'loc' || key === 'range') continue;
        const child = node[key];
        if (Array.isArray(child)) {
          child.forEach(collectInitialValues);
        } else if (child && typeof child === 'object' && child.type) {
          collectInitialValues(child);
        }
      }
    }
    
    collectInitialValues(ast);
    
    lists.forEach(listName => {
      const initialValues = arrayInitialValues.get(listName) || [];
      listsObj[listName] = [listName, initialValues]; // [name, initialValues]
    });
    
    // Initialize object properties as flattened variables
    objectMappings.forEach((props, objName) => {
      const objValues = objectInitialValues.get(objName) || new Map();
      props.forEach(propName => {
        const flatName = `${objName}_${propName}`;
        const value = objValues.get(propName) || 0;
        variablesObj[flatName] = [flatName, value];
      });
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
          lists: listsObj,
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
