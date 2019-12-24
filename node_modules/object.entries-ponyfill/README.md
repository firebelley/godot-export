# object.entries-ponyfill

> [`Object.entries()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/entries) [ponyfill](https://ponyfill.com)

The implementation is the same as [es-shims/Object.entries](https://github.com/es-shims/Object.entries), except ES3 is not supported, therefore making this package 600 bytes rather than [28000 bytes](https://github.com/es-shims/Object.entries/issues/10).

## built-in

You should polyfill your targeted browser environments automatically with [polyfill.io](https://polyfill.io), rather than using a non-tailored approach like this ponyfill. Node >= 7 has `Object.entries` natively. You probably only need this ponyfill if your targeted environment is Node and is version < 7.

## install

```sh
$ npm install object.entries-ponyfill
```

## example

```js
const entries = require('object.entries-ponyfill')

entries({ foo: 123, bar: 456 })
// => [ [ 'foo', 123 ], [ 'bar', 456 ] ]
```
