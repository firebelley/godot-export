/**
 * @fileoverview prefer using replaceText instead of replaceTextRange.
 * @author 薛定谔的猫<hh_2013@foxmail.com>
 */

'use strict';

const utils = require('../utils');

// ------------------------------------------------------------------------------
// Rule Definition
// ------------------------------------------------------------------------------

module.exports = {
  meta: {
    docs: {
      description: 'prefer using replaceText instead of replaceTextRange.',
      category: 'Rules',
      recommended: false,
    },
    type: 'suggestion',
    fixable: null,
    schema: [],
  },

  create (context) {
    const sourceCode = context.getSourceCode();
    const message = 'Use replaceText instead of replaceTextRange.';
    let funcInfo = {
      upper: null,
      codePath: null,
      shouldCheck: false,
      node: null,
    };
    let contextIdentifiers;

    return {
      Program (node) {
        contextIdentifiers = utils.getContextIdentifiers(context, node);
      },

      // Stacks this function's information.
      onCodePathStart (codePath, node) {
        const parent = node.parent;
        const shouldCheck = (node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression') &&
          parent.parent.type === 'ObjectExpression' &&
          parent.parent.parent.type === 'CallExpression' &&
          contextIdentifiers.has(parent.parent.parent.callee.object) &&
          parent.parent.parent.callee.property.name === 'report' &&
          utils.getReportInfo(parent.parent.parent.arguments).fix === node;

        funcInfo = {
          upper: funcInfo,
          codePath,
          shouldCheck,
          node,
        };
      },

      // Pops this function's information.
      onCodePathEnd () {
        funcInfo = funcInfo.upper;
      },

      // Checks the replaceTextRange arguments.
      'CallExpression[arguments.length=2]' (node) {
        if (funcInfo.shouldCheck &&
          node.callee.type === 'MemberExpression' &&
          node.callee.property.name === 'replaceTextRange') {
          const arg = node.arguments[0];
          const isIdenticalNodeRange = arg.type === 'ArrayExpression' &&
            arg.elements[0].type === 'MemberExpression' && arg.elements[1].type === 'MemberExpression' &&
            sourceCode.getText(arg.elements[0].object) === sourceCode.getText(arg.elements[1].object);
          if (isIdenticalNodeRange) {
            context.report({
              node,
              message,
            });
          }
        }
      },
    };
  },
};
