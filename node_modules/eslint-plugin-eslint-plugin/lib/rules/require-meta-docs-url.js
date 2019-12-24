/**
 * @author Toru Nagashima <https://github.com/mysticatea>
 */

'use strict';

// -----------------------------------------------------------------------------
// Requirements
// -----------------------------------------------------------------------------

const path = require('path');
const util = require('../utils');

// -----------------------------------------------------------------------------
// Rule Definition
// -----------------------------------------------------------------------------

module.exports = {
  meta: {
    docs: {
      description: 'require rules to implement a meta.docs.url property',
      category: 'Rules',
      recommended: false,
    },
    type: 'suggestion',
    fixable: 'code',
    schema: [{
      type: 'object',
      properties: {
        pattern: { type: 'string' },
      },
      additionalProperties: false,
    }],
  },

  /**
   * Creates AST event handlers for require-meta-docs-url.
   * @param {RuleContext} context - The rule context.
   * @returns {Object} AST event handlers.
   */
  create (context) {
    const options = context.options[0] || {};
    const sourceCode = context.getSourceCode();
    const filename = context.getFilename();
    const ruleName = filename === '<input>' ? undefined : path.basename(filename, '.js');
    const expectedUrl = !options.pattern || !ruleName
      ? undefined
      : options.pattern.replace(/{{\s*name\s*}}/g, ruleName);

    /**
     * Check whether a given node is the expected URL.
     * @param {Node} node The node of property value to check.
     * @returns {boolean} `true` if the node is the expected URL.
     */
    function isExpectedUrl (node) {
      return Boolean(
        node &&
        node.type === 'Literal' &&
        typeof node.value === 'string' &&
        (
          expectedUrl === undefined ||
          node.value === expectedUrl
        )
      );
    }

    /**
     * Insert a given property into a given object literal.
     * @param {SourceCodeFixer} fixer The fixer.
     * @param {Node} node The ObjectExpression node to insert a property.
     * @param {string} propertyText The property code to insert.
     * @returns {void}
     */
    function insertProperty (fixer, node, propertyText) {
      if (node.properties.length === 0) {
        return fixer.replaceText(node, `{\n${propertyText}\n}`);
      }
      return fixer.insertTextAfter(
        sourceCode.getLastToken(node.properties[node.properties.length - 1]),
        `,\n${propertyText}`
      );
    }

    return {
      Program (node) {
        const info = util.getRuleInfo(node);
        if (info === null) {
          return;
        }

        const metaNode = info.meta;
        const docsPropNode =
          metaNode &&
          metaNode.properties &&
          metaNode.properties.find(p => p.type === 'Property' && util.getKeyName(p) === 'docs');
        const urlPropNode =
          docsPropNode &&
          docsPropNode.value.properties &&
          docsPropNode.value.properties.find(p => p.type === 'Property' && util.getKeyName(p) === 'url');

        if (isExpectedUrl(urlPropNode && urlPropNode.value)) {
          return;
        }

        context.report({
          loc:
            (urlPropNode && urlPropNode.value.loc) ||
            (docsPropNode && docsPropNode.value.loc) ||
            (metaNode && metaNode.loc) ||
            node.loc.start,

          message:
            !urlPropNode ? 'Rules should export a `meta.docs.url` property.' :
              !expectedUrl ? '`meta.docs.url` property must be a string.' :
                /* otherwise */ '`meta.docs.url` property must be `{{expectedUrl}}`.',

          data: {
            expectedUrl,
          },

          fix (fixer) {
            if (expectedUrl) {
              const urlString = JSON.stringify(expectedUrl);
              if (urlPropNode) {
                return fixer.replaceText(urlPropNode.value, urlString);
              }
              if (docsPropNode && docsPropNode.value.type === 'ObjectExpression') {
                return insertProperty(fixer, docsPropNode.value, `url: ${urlString}`);
              }
              if (!docsPropNode && metaNode && metaNode.type === 'ObjectExpression') {
                return insertProperty(fixer, metaNode, `docs: {\nurl: ${urlString}\n}`);
              }
            }
            return null;
          },
        });
      },
    };
  },
};
