/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable @typescript-eslint/no-require-imports */
const path = require('path');

module.exports = {
  mode: 'production',
  target: 'node',
  entry: './lib/main.js',
  output: {
    path: __dirname + '/dist',
    filename: 'index.js',
  },
};
