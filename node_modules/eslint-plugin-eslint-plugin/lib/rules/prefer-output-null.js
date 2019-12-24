/**
 * @fileoverview disallows invalid RuleTester test cases with the output the same as the code.
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
      description: 'disallows invalid RuleTester test cases with the output the same as the code.',
      category: 'Tests',
      recommended: false,
    },
    type: 'suggestion',
    fixable: 'code',
    schema: [],
  },

  create (context) {
    // ----------------------------------------------------------------------
    // Public
    // ----------------------------------------------------------------------

    const message = 'Use `output: null` to assert that a test case is not autofixed.';
    const sourceCode = context.getSourceCode();

    return {
      Program (ast) {
        utils.getTestInfo(context, ast).forEach(testRun => {
          testRun.invalid.forEach(test => {
            /**
            * Get a test case's giving keyname node.
            * @param {string} the keyname to find.
            * @returns {Node} found node; if not found, return null;
            */
            function getTestInfo (key) {
              if (test.type === 'ObjectExpression') {
                const res = test.properties.filter(item => item.key.name === key);
                return res.length ? res[res.length - 1] : null;
              }
              return key === 'code' ? test : null;
            }

            const code = getTestInfo('code');
            const output = getTestInfo('output');

            if (output && sourceCode.getText(output.value) === sourceCode.getText(code.value)) {
              context.report({
                node: output,
                message,
                fix: fixer => fixer.replaceText(output.value, 'null'),
              });
            }
          });
        });
      },
    };
  },
};
