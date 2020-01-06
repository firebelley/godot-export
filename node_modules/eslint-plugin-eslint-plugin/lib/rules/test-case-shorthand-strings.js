/**
 * @fileoverview Enforce consistent usage of shorthand strings for test cases with no options
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
      description: 'Enforce consistent usage of shorthand strings for test cases with no options',
      category: 'Tests',
      recommended: false,
    },
    type: 'suggestion',
    schema: [{ enum: ['as-needed', 'never', 'consistent', 'consistent-as-needed'] }],
    fixable: 'code',
  },

  create (context) {
    const shorthandOption = context.options[0] || 'as-needed';
    const sourceCode = context.getSourceCode();

    // ----------------------------------------------------------------------
    // Helpers
    // ----------------------------------------------------------------------

    /**
    * Reports test cases as necessary
    * @param {object[]} cases A list of test case nodes
    * @returns {void}
    */
    function reportTestCases (cases) {
      const caseInfoList = cases.map(testCase => {
        if (testCase.type === 'Literal' || testCase.type === 'TemplateLiteral') {
          return { node: testCase, shorthand: true, needsLongform: false };
        }
        if (testCase.type === 'ObjectExpression') {
          return {
            node: testCase,
            shorthand: false,
            needsLongform: !(testCase.properties.length === 1 && utils.getKeyName(testCase.properties[0]) === 'code'),
          };
        }
        return null;
      }).filter(Boolean);

      const isConsistent = new Set(caseInfoList.map(caseInfo => caseInfo.shorthand)).size <= 1;
      const hasCaseNeedingLongform = caseInfoList.some(caseInfo => caseInfo.needsLongform);

      caseInfoList.filter({
        'as-needed': caseInfo => !caseInfo.shorthand && !caseInfo.needsLongform,
        never: caseInfo => caseInfo.shorthand,
        consistent: isConsistent ? () => false : caseInfo => caseInfo.shorthand,
        'consistent-as-needed': caseInfo => caseInfo.shorthand === hasCaseNeedingLongform,
      }[shorthandOption]).forEach(badCaseInfo => {
        context.report({
          node: badCaseInfo.node,
          message: 'Use {{preferred}} for this test case instead of {{actual}}.',
          data: {
            preferred: badCaseInfo.shorthand ? 'an object' : 'a string',
            actual: badCaseInfo.shorthand ? 'a string' : 'an object',
          },
          fix (fixer) {
            return fixer.replaceText(
              badCaseInfo.node,
              badCaseInfo.shorthand
                ? `{code: ${sourceCode.getText(badCaseInfo.node)}}`
                : sourceCode.getText(badCaseInfo.node.properties[0].value)
            );
          },
        });
      });
    }

    // ----------------------------------------------------------------------
    // Public
    // ----------------------------------------------------------------------

    return {
      Program (ast) {
        utils.getTestInfo(context, ast).map(testRun => testRun.valid).filter(Boolean).forEach(reportTestCases);
      },
    };
  },
};
