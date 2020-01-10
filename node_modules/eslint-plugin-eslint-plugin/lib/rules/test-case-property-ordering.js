/**
 * @fileoverview Requires the properties of a test case to be placed in a consistent order.
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
      description: 'require the properties of a test case to be placed in a consistent order',
      category: 'Tests',
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
    // ----------------------------------------------------------------------
    // Public
    // ----------------------------------------------------------------------
    const message = 'The properties of a test case should be placed in a consistent order: [{{order}}].';
    const order = context.options[0] || ['code', 'output', 'options', 'parserOptions', 'errors'];
    const sourceCode = context.getSourceCode();

    return {
      Program (ast) {
        utils.getTestInfo(context, ast).forEach(testRun => {
          [testRun.valid, testRun.invalid].forEach(tests => {
            tests.forEach(test => {
              const properties = (test && test.properties) || [];
              const keyNames = properties.map(utils.getKeyName);

              for (let i = 0, lastChecked; i < keyNames.length; i++) {
                const current = order.indexOf(keyNames[i]);

                // current < lastChecked to catch unordered;
                // and lastChecked === -1 to catch extra properties before.
                if (current > -1 && (current < lastChecked || lastChecked === -1)) {
                  let orderMsg = order.filter(item => keyNames.indexOf(item) > -1);
                  orderMsg = orderMsg.concat(
                    lastChecked === -1 ? keyNames.filter(item => order.indexOf(item) === -1) : []
                  );

                  context.report({
                    node: properties[i],
                    message,
                    data: { order: orderMsg.join(', ') },
                    fix (fixer) {
                      return orderMsg.map((key, index) => {
                        const propertyToInsert = properties[keyNames.indexOf(key)];
                        return fixer.replaceText(properties[index], sourceCode.getText(propertyToInsert));
                      });
                    },
                  });
                }
                lastChecked = current;
              }
            });
          });
        });
      },
    };
  },
};
