/**
 * @fileoverview disallow template literals as report messages
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
      description: 'disallow template literals as report messages',
      category: 'Rules',
      recommended: false,
    },
    type: 'suggestion',
    fixable: null,
    schema: [],
  },

  create (context) {
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
          node.callee.property.type === 'Identifier' && node.callee.property.name === 'report'
        ) {
          const reportInfo = utils.getReportInfo(node.arguments);

          if (
            reportInfo && reportInfo.message && (
              (reportInfo.message.type === 'TemplateLiteral' && reportInfo.message.expressions.length) ||
              (reportInfo.message.type === 'BinaryExpression' && reportInfo.message.operator === '+')
            )
          ) {
            context.report({
              node: reportInfo.message,
              message: 'Use report message placeholders instead of string concatenation.',
            });
          }
        }
      },
    };
  },
};
