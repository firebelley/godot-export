/**
 * @fileoverview Enforces the order of meta properties
 */

'use strict';

const { getKeyName, getRuleInfo } = require('../utils');

// ------------------------------------------------------------------------------
// Rule Definition
// ------------------------------------------------------------------------------

module.exports = {
  meta: {
    docs: {
      description: 'Enforces the order of meta properties',
      category: 'Rules',
      recommended: false,
    },
    type: 'suggestion',
    fixable: 'code',
    schema: [{
      type: 'array',
      elements: { type: 'string' },
    }],
  },

  create (context) {
    const sourceCode = context.getSourceCode();
    const info = getRuleInfo(sourceCode.ast);

    const message = 'The meta properties should be placed in a consistent order: [{{order}}].';
    const order = context.options[0] || ['type', 'docs', 'fixable', 'schema', 'messages'];

    const orderMap = new Map(order.map((name, i) => [name, i]));

    return {
      Program () {
        if (
          !info ||
          !info.meta ||
          info.meta.properties.length < 2
        ) {
          return;
        }

        const props = info.meta.properties;

        let last;

        const violatingProps = props.filter(prop => {
          const curr = orderMap.has(getKeyName(prop))
            ? orderMap.get(getKeyName(prop))
            : Infinity;
          return last > (last = curr);
        });

        if (violatingProps.length === 0) {
          return;
        }

        const knownProps = props
          .filter(prop => orderMap.has(getKeyName(prop)))
          .sort((a, b) => orderMap.get(getKeyName(a)) - orderMap.get(getKeyName(b)));
        const unknownProps = props.filter(prop => !orderMap.has(getKeyName(prop)));

        for (const violatingProp of violatingProps) {
          context.report({
            node: violatingProp,
            message,
            data: {
              order: knownProps.map(getKeyName).join(', '),
            },
            fix (fixer) {
              const expectedProps = [...knownProps, ...unknownProps];
              return props.map((prop, k) => {
                return fixer.replaceText(
                  prop,
                  sourceCode.getText(expectedProps[k])
                );
              });
            },
          });
        }
      },
    };
  },
};
