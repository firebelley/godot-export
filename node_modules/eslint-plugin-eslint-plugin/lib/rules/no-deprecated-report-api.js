/**
 * @fileoverview disallow use of the deprecated context.report() API
 * @author Teddy Katz
 */

'use strict';

const utils = require('../utils');

// ------------------------------------------------------------------------------
// Rule Definition
// ------------------------------------------------------------------------------

module.exports = {
  meta: {
    docs: {
      description: 'disallow use of the deprecated context.report() API',
      category: 'Rules',
      recommended: true,
    },
    type: 'suggestion',
    fixable: 'code', // or "code" or "whitespace"
    schema: [],
  },

  create (context) {
    const sourceCode = context.getSourceCode();
    let contextIdentifiers;

    // ----------------------------------------------------------------------
    // Public
    // ----------------------------------------------------------------------

    return {
      Program (node) {
        contextIdentifiers = utils.getContextIdentifiers(context, node);
      },
      CallExpression (node) {
        if (
          node.callee.type === 'MemberExpression' &&
          contextIdentifiers.has(node.callee.object) &&
          node.callee.property.type === 'Identifier' && node.callee.property.name === 'report' &&
          (node.arguments.length > 1 || (node.arguments.length === 1 && node.arguments[0].type === 'SpreadElement'))
        ) {
          context.report({
            node: node.callee.property,
            message: 'Use the new-style context.report() API.',
            fix (fixer) {
              const openingParen = sourceCode.getTokenBefore(node.arguments[0]);
              const closingParen = sourceCode.getLastToken(node);
              const reportInfo = utils.getReportInfo(node.arguments);

              if (!reportInfo) {
                return null;
              }

              return fixer.replaceTextRange(
                [openingParen.range[1], closingParen.range[0]],
                `{${Object.keys(reportInfo).map(key => `${key}: ${sourceCode.getText(reportInfo[key])}`).join(', ')}}`
              );
            },
          });
        }
      },
    };
  },
};
