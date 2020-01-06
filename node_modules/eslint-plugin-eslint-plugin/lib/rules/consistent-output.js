/**
 * @fileoverview Enforce consistent use of output assertions in rule tests
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
      description: 'Enforce consistent use of output assertions in rule tests',
      category: 'Tests',
      recommended: false,
    },
    type: 'suggestion',
    fixable: null, // or "code" or "whitespace"
    schema: [],
  },

  create (context) {
    // ----------------------------------------------------------------------
    // Public
    // ----------------------------------------------------------------------

    return {
      Program (ast) {
        utils.getTestInfo(context, ast).forEach(testRun => {
          const readableCases = testRun.invalid.filter(testCase => testCase.type === 'ObjectExpression');
          const casesWithoutOutput = readableCases
            .filter(testCase => testCase.properties.map(utils.getKeyName).indexOf('output') === -1);

          if (casesWithoutOutput.length < readableCases.length) {
            casesWithoutOutput.forEach(testCase => {
              context.report({
                node: testCase,
                message: 'This test case should have an output assertion.',
              });
            });
          }
        });
      },
    };
  },
};
