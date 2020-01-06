'use strict';

/**
* Determines whether a node is a 'normal' (i.e. non-async, non-generator) function expression.
* @param {ASTNode} node The node in question
* @returns {boolean} `true` if the node is a normal function expression
*/
function isNormalFunctionExpression (node) {
  return (node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression') && !node.generator && !node.async;
}

/**
* Determines whether a node is constructing a RuleTester instance
* @param {ASTNode} node The node in question
* @returns {boolean} `true` if the node is probably constructing a RuleTester instance
*/
function isRuleTesterConstruction (node) {
  return node.type === 'NewExpression' && (
    (node.callee.type === 'Identifier' && node.callee.name === 'RuleTester') ||
    (node.callee.type === 'MemberExpression' &&
      node.callee.property.type === 'Identifier' &&
      node.callee.property.name === 'RuleTester')
  );
}

module.exports = {

  /**
  * Performs static analysis on an AST to try to determine the final value of `module.exports`.
  * @param {ASTNode} ast The `Program` AST node
  * @returns {Object} An object with keys `meta`, `create`, and `isNewStyle`. `meta` and `create` correspond to the AST nodes
  for the final values of `module.exports.meta` and `module.exports.create`. `isNewStyle` will be `true` if `module.exports`
  is an object, and `false` if module.exports is just the `create` function. If no valid ESLint rule info can be extracted
  from the file, the return value will be `null`.
  */
  getRuleInfo (ast) {
    const INTERESTING_KEYS = new Set(['create', 'meta']);
    let exportsVarOverridden = false;
    let exportsIsFunction = false;

    const exportNodes = ast.body
      .filter(statement => statement.type === 'ExpressionStatement')
      .map(statement => statement.expression)
      .filter(expression => expression.type === 'AssignmentExpression')
      .filter(expression => expression.left.type === 'MemberExpression')
      .reduce((currentExports, node) => {
        if (
          node.left.object.type === 'Identifier' && node.left.object.name === 'module' &&
          node.left.property.type === 'Identifier' && node.left.property.name === 'exports'
        ) {
          exportsVarOverridden = true;

          if (isNormalFunctionExpression(node.right)) {
            // Check `module.exports = function () {}`

            exportsIsFunction = true;
            return { create: node.right, meta: null };
          } else if (node.right.type === 'ObjectExpression') {
            // Check `module.exports = { create: function () {}, meta: {} }`

            exportsIsFunction = false;
            return node.right.properties.reduce((parsedProps, prop) => {
              const keyValue = module.exports.getKeyName(prop);
              if (INTERESTING_KEYS.has(keyValue)) {
                parsedProps[keyValue] = prop.value;
              }
              return parsedProps;
            }, {});
          }
          return {};
        } else if (
          !exportsIsFunction &&
          node.left.object.type === 'MemberExpression' &&
          node.left.object.object.type === 'Identifier' && node.left.object.object.name === 'module' &&
          node.left.object.property.type === 'Identifier' && node.left.object.property.name === 'exports' &&
          node.left.property.type === 'Identifier' && INTERESTING_KEYS.has(node.left.property.name)
        ) {
          // Check `module.exports.create = () => {}`

          currentExports[node.left.property.name] = node.right;
        } else if (
          !exportsVarOverridden &&
          node.left.object.type === 'Identifier' && node.left.object.name === 'exports' &&
          node.left.property.type === 'Identifier' && INTERESTING_KEYS.has(node.left.property.name)
        ) {
          // Check `exports.create = () => {}`

          currentExports[node.left.property.name] = node.right;
        }
        return currentExports;
      }, {});

    return Object.prototype.hasOwnProperty.call(exportNodes, 'create') && isNormalFunctionExpression(exportNodes.create)
      ? Object.assign({ isNewStyle: !exportsIsFunction, meta: null }, exportNodes)
      : null;
  },

  /**
  * Gets all the identifiers referring to the `context` variable in a rule source file. Note that this function will
  * only work correctly after traversing the AST has started (e.g. in the first `Program` node).
  * @param {RuleContext} context The `context` variable for the source file itself
  * @param {ASTNode} ast The `Program` node for the file
  * @returns {Set<ASTNode>} A Set of all `Identifier` nodes that are references to the `context` value for the file
  */
  getContextIdentifiers (context, ast) {
    const ruleInfo = module.exports.getRuleInfo(ast);

    if (!ruleInfo || !ruleInfo.create.params.length || ruleInfo.create.params[0].type !== 'Identifier') {
      return new Set();
    }

    return new Set(
      context.getDeclaredVariables(ruleInfo.create)
        .find(variable => variable.name === ruleInfo.create.params[0].name)
        .references
        .map(ref => ref.identifier)
    );
  },

  /**
  * Gets the key name of a Property, if it can be determined statically.
  * @param {ASTNode} node The `Property` node
  * @returns {string|null} The key name, or `null` if the name cannot be determined statically.
  */
  getKeyName (property) {
    if (!property.computed && property.key.type === 'Identifier') {
      return property.key.name;
    }
    if (property.key.type === 'Literal') {
      return '' + property.key.value;
    }
    if (property.key.type === 'TemplateLiteral' && property.key.quasis.length === 1) {
      return property.key.quasis[0].value.cooked;
    }
    return null;
  },

  /**
  * Performs static analysis on an AST to try to find test cases
  * @param {RuleContext} context The `context` variable for the source file itself
  * @param {ASTNode} ast The `Program` node for the file.
  * @returns {object} An object with `valid` and `invalid` keys containing a list of AST nodes corresponding to tests
  */
  getTestInfo (context, ast) {
    const runCalls = [];
    const variableIdentifiers = new Set();

    ast.body.forEach(statement => {
      if (statement.type === 'VariableDeclaration') {
        statement.declarations.forEach(declarator => {
          if (declarator.init && isRuleTesterConstruction(declarator.init) && declarator.id.type === 'Identifier') {
            context.getDeclaredVariables(declarator).forEach(variable => {
              variable.references.filter(ref => ref.isRead()).forEach(ref => variableIdentifiers.add(ref.identifier));
            });
          }
        });
      }

      if (
        statement.type === 'ExpressionStatement' &&
        statement.expression.type === 'CallExpression' &&
        statement.expression.callee.type === 'MemberExpression' &&
        (
          isRuleTesterConstruction(statement.expression.callee.object) ||
          variableIdentifiers.has(statement.expression.callee.object)
        ) &&
        statement.expression.callee.property.type === 'Identifier' &&
        statement.expression.callee.property.name === 'run'
      ) {
        runCalls.push(statement.expression);
      }
    });

    return runCalls
      .filter(call => call.arguments.length >= 3 && call.arguments[2].type === 'ObjectExpression')
      .map(call => call.arguments[2])
      .map(run => {
        const validProperty = run.properties.find(prop => module.exports.getKeyName(prop) === 'valid');
        const invalidProperty = run.properties.find(prop => module.exports.getKeyName(prop) === 'invalid');

        return {
          valid: validProperty && validProperty.value.type === 'ArrayExpression' ? validProperty.value.elements.filter(Boolean) : [],
          invalid: invalidProperty && invalidProperty.value.type === 'ArrayExpression' ? invalidProperty.value.elements.filter(Boolean) : [],
        };
      });
  },

  /**
  * Gets information on a report, given the arguments passed to context.report().
  * @param {ASTNode[]} reportArgs The arguments passed to context.report()
  */
  getReportInfo (reportArgs) {
    // If there is exactly one argument, the API expects an object.
    // Otherwise, if the second argument is a string, the arguments are interpreted as
    // ['node', 'message', 'data', 'fix'].
    // Otherwise, the arguments are interpreted as ['node', 'loc', 'message', 'data', 'fix'].

    if (!reportArgs.length) {
      return null;
    }

    if (reportArgs.length === 1) {
      if (reportArgs[0].type === 'ObjectExpression') {
        return reportArgs[0].properties.reduce((reportInfo, property) => {
          const propName = module.exports.getKeyName(property);

          if (propName !== null) {
            return Object.assign(reportInfo, { [propName]: property.value });
          }
          return reportInfo;
        }, {});
      }
      return null;
    }

    let keys;

    if (
      (reportArgs[1].type === 'Literal' && typeof reportArgs[1].value === 'string') ||
      reportArgs[1].type === 'TemplateLiteral'
    ) {
      keys = ['node', 'message', 'data', 'fix'];
    } else if (
      reportArgs[1].type === 'ObjectExpression' ||
      reportArgs[1].type === 'ArrayExpression' ||
      (reportArgs[1].type === 'Literal' && typeof reportArgs[1].value !== 'string')
    ) {
      keys = ['node', 'loc', 'message', 'data', 'fix'];
    } else {
      // Otherwise, we can't statically determine what argument means what, so no safe fix is possible.
      return null;
    }

    return keys
      .slice(0, reportArgs.length)
      .reduce((reportInfo, key, index) => Object.assign(reportInfo, { [key]: reportArgs[index] }), {});
  },

  /**
   * Gets a set of all `sourceCode` identifiers.
   * @param {RuleContext} context The context for the rule file
   * @param {ASTNode} ast The AST of the file. This must have `parent` properties.
   * @returns {Set<ASTNode>} A set of all identifiers referring to the `SourceCode` object.
   */
  getSourceCodeIdentifiers (context, ast) {
    return new Set(Array.from(module.exports.getContextIdentifiers(context, ast))
      .filter(identifier => identifier.parent &&
        identifier.parent.type === 'MemberExpression' &&
        identifier === identifier.parent.object &&
        identifier.parent.property.type === 'Identifier' &&
        identifier.parent.property.name === 'getSourceCode' &&
        identifier.parent.parent.type === 'CallExpression' &&
        identifier.parent === identifier.parent.parent.callee &&
        identifier.parent.parent.parent.type === 'VariableDeclarator' &&
        identifier.parent.parent === identifier.parent.parent.parent.init &&
        identifier.parent.parent.parent.id.type === 'Identifier'
      )
      .map(identifier => context.getDeclaredVariables(identifier.parent.parent.parent))
      .reduce((allVariables, variablesForIdentifier) => allVariables.concat(variablesForIdentifier), [])
      .map(variable => variable.references)
      .reduce((allRefs, refsForVariable) => allRefs.concat(refsForVariable), [])
      .map(ref => ref.identifier));
  },
};
