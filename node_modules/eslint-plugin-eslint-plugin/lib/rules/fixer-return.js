/**
 * @fileoverview Enforces always return from a fixer function
 * @author 薛定谔的猫<hh_2013@foxmail.com>
 */

'use strict';

// ------------------------------------------------------------------------------
// Requirements
// ------------------------------------------------------------------------------

const utils = require('../utils');

// ------------------------------------------------------------------------------
// Rule Definition
// ------------------------------------------------------------------------------

module.exports = {
  meta: {
    docs: {
      description: 'require fixer function to always return a value.',
      category: 'Possible Errors',
      recommended: true,
    },
    type: 'problem',
    fixable: null,
    schema: [],
  },

  create (context) {
    const message = 'Expected fixer function to always return a value.';
    let funcInfo = {
      upper: null,
      codePath: null,
      hasReturn: false,
      hasYield: false,
      shouldCheck: false,
      node: null,
    };
    let contextIdentifiers;

    /**
     * Checks whether or not the last code path segment is reachable.
     * Then reports this function if the segment is reachable.
     *
     * If the last code path segment is reachable, there are paths which are not
     * returned or thrown.
     *
     * @param {ASTNode} node - A node to check.
     * @returns {void}
     */
    function checkLastSegment (node) {
      if (
        funcInfo.shouldCheck &&
        funcInfo.codePath.currentSegments.some(segment => segment.reachable) &&
        (!node.generator || !funcInfo.hasYield)
      ) {
        context.report({
          node,
          loc: (node.id || node).loc.start,
          message,
        });
      }
    }

    return {
      Program (node) {
        contextIdentifiers = utils.getContextIdentifiers(context, node);
      },

      // Stacks this function's information.
      onCodePathStart (codePath, node) {
        const parent = node.parent;
        const shouldCheck = node.type === 'FunctionExpression' &&
          parent.parent.type === 'ObjectExpression' &&
          parent.parent.parent.type === 'CallExpression' &&
          contextIdentifiers.has(parent.parent.parent.callee.object) &&
          parent.parent.parent.callee.property.name === 'report' &&
          utils.getReportInfo(parent.parent.parent.arguments).fix === node;

        funcInfo = {
          upper: funcInfo,
          codePath,
          hasYield: false,
          hasReturn: false,
          shouldCheck,
          node,
        };
      },

      // Pops this function's information.
      onCodePathEnd () {
        funcInfo = funcInfo.upper;
      },

      // Yield in generators
      YieldExpression () {
        if (funcInfo.shouldCheck) {
          funcInfo.hasYield = true;
        }
      },

      // Checks the return statement is valid.
      ReturnStatement (node) {
        if (funcInfo.shouldCheck) {
          funcInfo.hasReturn = true;

          if (!node.argument) {
            context.report({
              node,
              message,
            });
          }
        }
      },

      // Reports a given function if the last path is reachable.
      'FunctionExpression:exit': checkLastSegment,
    };
  },
};
