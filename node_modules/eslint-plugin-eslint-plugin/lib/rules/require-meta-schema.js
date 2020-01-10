'use strict';

const utils = require('../utils');

// ------------------------------------------------------------------------------
// Rule Definition
// ------------------------------------------------------------------------------

module.exports = {
  meta: {
    docs: {
      description: 'require rules to implement a meta.schema property',
      category: 'Rules',
      recommended: false, // TODO: enable it in a major release.
    },
    type: 'suggestion',
    fixable: 'code',
    schema: [
      {
        type: 'object',
        properties: {
          exceptRange: {
            type: 'boolean',
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      missing: '`meta.schema` is required (use [] if rule has no schema).',
      wrongType: '`meta.schema` should be an array (use [] if rule has no schema).',
    },
  },

  create (context) {
    const sourceCode = context.getSourceCode();
    const info = utils.getRuleInfo(sourceCode.ast, sourceCode.scopeManager);

    return {
      Program () {
        if (info === null || info.meta === null) {
          return;
        }

        const metaNode = info.meta;
        const schemaNode =
          metaNode &&
          metaNode.properties &&
          metaNode.properties.find(p => p.type === 'Property' && utils.getKeyName(p) === 'schema');

        if (!schemaNode) {
          context.report({
            node: metaNode,
            messageId: 'missing',
            fix (fixer) {
              return utils.insertProperty(fixer, metaNode, 'schema: []', sourceCode);
            },
          });
        } else if (schemaNode.value.type !== 'ArrayExpression') {
          context.report({ node: schemaNode.value, messageId: 'wrongType' });
        }
      },
    };
  },
};
