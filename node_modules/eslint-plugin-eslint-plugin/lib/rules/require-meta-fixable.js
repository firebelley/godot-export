/**
 * @fileoverview require rules to implement a meta.fixable property
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
      description: 'require rules to implement a meta.fixable property',
      category: 'Rules',
      recommended: true,
    },
    type: 'problem',
    schema: [],
  },

  create (context) {
    const sourceCode = context.getSourceCode();
    const ruleInfo = utils.getRuleInfo(sourceCode.ast);
    let contextIdentifiers;
    let usesFixFunctions;

    // ----------------------------------------------------------------------
    // Helpers
    // ----------------------------------------------------------------------

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
          node.callee.property.type === 'Identifier' &&
          node.callee.property.name === 'report' &&
          (node.arguments.length > 4 || (
            node.arguments.length === 1 &&
            node.arguments[0].type === 'ObjectExpression' &&
            node.arguments[0].properties.some(prop => utils.getKeyName(prop) === 'fix')
          ))
        ) {
          usesFixFunctions = true;
        }
      },
      'Program:exit' () {
        const metaFixableProp = ruleInfo &&
          ruleInfo.meta &&
          ruleInfo.meta.type === 'ObjectExpression' &&
          ruleInfo.meta.properties.find(prop => utils.getKeyName(prop) === 'fixable');

        if (metaFixableProp) {
          const VALID_VALUES = new Set(['code', 'whitespace', null, undefined]);
          const valueIsValid = metaFixableProp.value.type === 'Literal'
            ? VALID_VALUES.has(metaFixableProp.value.value)
            : metaFixableProp.value.type === 'TemplateLiteral' && metaFixableProp.value.quasis.length === 1
              ? VALID_VALUES.has(metaFixableProp.value.quasis[0].value.cooked)
              : metaFixableProp.value.type === 'Identifier' && metaFixableProp.value.name === 'undefined';

          if (!valueIsValid) {
            context.report({ node: metaFixableProp, message: '`meta.fixable` must be either `code`, `whitespace` or `null`.' });
          }
        } else if (usesFixFunctions) {
          context.report({ node: ruleInfo.create, message: 'Fixable rules must export a `meta.fixable` property.' });
        }
      },
    };
  },
};
