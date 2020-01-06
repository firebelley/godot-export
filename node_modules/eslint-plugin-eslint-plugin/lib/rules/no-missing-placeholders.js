/**
 * @fileoverview Disallow missing placeholders in rule report messages
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
      description: 'Disallow missing placeholders in rule report messages',
      category: 'Rules',
      recommended: true,
    },
    type: 'problem',
    fixable: null,
    schema: [],
  },

  create (context) {
    let contextIdentifiers;

    // ----------------------------------------------------------------------
    // Public
    // ----------------------------------------------------------------------

    return {
      Program (ast) {
        contextIdentifiers = utils.getContextIdentifiers(context, ast);
      },
      CallExpression (node) {
        if (
          node.callee.type === 'MemberExpression' &&
          contextIdentifiers.has(node.callee.object) &&
          node.callee.property.type === 'Identifier' && node.callee.property.name === 'report'
        ) {
          const reportInfo = utils.getReportInfo(node.arguments);

          if (
            reportInfo &&
            reportInfo.message &&
            reportInfo.message.type === 'Literal' &&
            typeof reportInfo.message.value === 'string' &&
            (!reportInfo.data || reportInfo.data.type === 'ObjectExpression')
          ) {
            // Same regex as the one ESLint uses
            // https://github.com/eslint/eslint/blob/e5446449d93668ccbdb79d78cc69f165ce4fde07/lib/eslint.js#L990
            const PLACEHOLDER_MATCHER = /\{\{\s*([^{}]+?)\s*\}\}/g;
            let match;

            while ((match = PLACEHOLDER_MATCHER.exec(reportInfo.message.value))) { // eslint-disable-line no-extra-parens
              const matchingProperty = reportInfo.data &&
                reportInfo.data.properties.find(prop => utils.getKeyName(prop) === match[1]);

              if (!matchingProperty) {
                context.report({
                  node: reportInfo.message,
                  message: 'The placeholder {{{{missingKey}}}} does not exist.',
                  data: { missingKey: match[1] },
                });
              }
            }
          }
        }
      },
    };
  },
};
