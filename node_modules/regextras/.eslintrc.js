module.exports = {
  extends: 'ash-nazg/sauron-node',
  settings: {
      polyfills: [
          'console',
          'document.body'
      ]
  },
  overrides: [{
      files: 'test/**.js',
      env: {
          mocha: true
      },
      extends: ['plugin:node/recommended-script'],
      rules: {
          'node/no-unsupported-features/es-syntax': 0
      }
  }, {
      files: 'tests/**.js',
      rules: {
          'no-console': 0
      }
  }],
  rules: {
    indent: ['error', 4, {'outerIIFEBody': 0}],

    // Disable for now
    'prefer-named-capture-group': 0,
    'require-unicode-regexp': 0
  }
};
