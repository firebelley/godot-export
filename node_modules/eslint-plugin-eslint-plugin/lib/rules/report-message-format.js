/**
 * @fileoverview enforce a consistent format for rule report messages
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
      description: 'enforce a consistent format for rule report messages',
      category: 'Rules',
      recommended: false,
    },
    type: 'suggestion',
    fixable: null,
    schema: [
      { type: 'string' },
    ],
  },

  create (context) {
    const pattern = new RegExp(context.options[0] || '');
    let contextIdentifiers;

    /**
     * Report a message node if it doesn't match the given formatting
     * @param {ASTNode} message The message AST node
     * @returns {void}
     */
    function processMessageNode (message) {
      if (
        (message.type === 'Literal' && typeof message.value === 'string' && !pattern.test(message.value)) ||
        (message.type === 'TemplateLiteral' && message.quasis.length === 1 && !pattern.test(message.quasis[0].value.cooked))
      ) {
        context.report({
          node: message,
          message: "Report message does not match the pattern '{{pattern}}'.",
          data: { pattern: context.options[0] || '' },
        });
      }
    }

    // ----------------------------------------------------------------------
    // Public
    // ----------------------------------------------------------------------

    return {
      Program (node) {
        contextIdentifiers = utils.getContextIdentifiers(context, node);
        const ruleInfo = utils.getRuleInfo(context.getSourceCode().ast);
        const messagesObject = ruleInfo &&
          ruleInfo.meta &&
          ruleInfo.meta.type === 'ObjectExpression' &&
          ruleInfo.meta.properties.find(prop => prop.type === 'Property' && utils.getKeyName(prop) === 'messages');

        if (!messagesObject || messagesObject.value.type !== 'ObjectExpression') {
          return;
        }

        messagesObject.value.properties
          .filter(prop => prop.type === 'Property')
          .map(prop => prop.value)
          .forEach(processMessageNode);
      },
      CallExpression (node) {
        if (
          node.callee.type === 'MemberExpression' &&
          contextIdentifiers.has(node.callee.object) &&
          node.callee.property.type === 'Identifier' && node.callee.property.name === 'report'
        ) {
          const reportInfo = utils.getReportInfo(node.arguments);
          const message = reportInfo && reportInfo.message;

          if (!message) {
            return;
          }

          processMessageNode(message);
        }
      },
    };
  },
};
