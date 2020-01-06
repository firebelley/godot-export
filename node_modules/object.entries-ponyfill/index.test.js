'use strict'

var test = require('tape')
var ponyfill = require('./')
var entries = require('./entries')

test('ponyfill', function (t) {
  if (typeof Object.entries === 'function') {
    t.equal(ponyfill, Object.entries, 'ponyfill exports native Object.entries when available')
  } else {
    t.equal(ponyfill, entries, 'ponyfill uses own implementation when native is not available')
  }

  t.end()
})
