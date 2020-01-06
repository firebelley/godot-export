'use strict'

var test = require('tape')
var entries = require('./entries')

test('object.entries', function (t) {
  var a = {}
  var b = {}
  var c = {}
  var obj = { a: a, b: b, c: c }

  t.deepEqual(
    entries(obj),
    [ [ 'a', a ], [ 'b', b ], [ 'c', c ] ],
    'basic support'
  )

  t.deepEqual(
    entries({ a: a, b: a, c: c }),
    [ [ 'a', a ], [ 'b', a ], [ 'c', c ] ],
    'duplicate entries are included'
  )

  t.test('entries are in the same order as keys', function (t) {
    var object = { a: a, b: b }
    object[0] = 3
    object.c = c
    object[1] = 4
    delete object[0]
    var objKeys = Object.keys(object)
    var objEntries = objKeys.map(function (key) {
      return [ key, object[key] ]
    })
    t.deepEqual(entries(object), objEntries, 'entries match key order')

    t.end()
  })

  t.test('non-enumerable properties are omitted', function (t) {
    var object = { a: a, b: b }
    Object.defineProperty(object, 'c', { enumerable: false, value: c })
    t.deepEqual(
      entries(object),
      [ [ 'a', a ], [ 'b', b ] ],
      'non-enumerable property‘s value is omitted'
    )

    t.end()
  })

  t.test('inherited properties are omitted', function (t) {
    var F = function G() {}
    F.prototype.a = a
    var f = new F()
    f.b = b
    t.deepEqual(entries(f), [ [ 'b', b ] ], 'only own properties are included')

    t.end()
  })

  t.test('Symbol properties are omitted', function (t) {
    var object = { a: a, b: b, c: c }
    var enumSym = Symbol('enum')
    var nonEnumSym = Symbol('non enum')
    object[enumSym] = enumSym
    object.d = enumSym
    Object.defineProperty(object, nonEnumSym, { enumerable: false, value: nonEnumSym })
    t.deepEqual(
      entries(object),
      [ [ 'a', a ], [ 'b', b ], [ 'c', c ], [ 'd', enumSym ] ],
      'symbol properties are omitted'
    )

    t.end()
  })

  t.test('not-yet-visited keys deleted on [[Get]] must not show up in output', function (t) {
    var o = { a: 1, b: 2, c: 3 }
    Object.defineProperty(o, 'a', {
      get: function () {
        delete this.b
        return 1
      }
    })
    t.deepEqual(
      entries(o),
      [ [ 'a', 1 ], [ 'c', 3 ] ],
      'when "b" is deleted prior to being visited, it should not show up'
    )

    t.end()
  })

  t.test(
    'not-yet-visited keys made non-enumerable on [[Get]] must not show up in output',
    function (t) {
      var o = { a: 'A', b: 'B' }
      Object.defineProperty(o, 'a', {
        get: function () {
          Object.defineProperty(o, 'b', { enumerable: false })
          return 'A'
        }
      })
      t.deepEqual(
        entries(o),
        [ [ 'a', 'A' ] ],
        'when "b" is made non-enumerable prior to being visited, it should not show up'
      )

      t.end()
    }
  )

  t.end()
})
