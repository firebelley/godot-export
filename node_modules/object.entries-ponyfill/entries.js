'use strict'

var has = function (obj, prop) { return Object.prototype.hasOwnProperty.call(obj, prop) }
var isEnumerable = function (obj, prop) {
  return Object.prototype.propertyIsEnumerable.call(obj, prop)
}

function entries (obj) {
  if (obj == null) {
    throw new TypeError('Cannot convert undefined or null to object')
  }
  var pairs = []
  for (var key in obj) {
    if (has(obj, key) && isEnumerable(obj, key)) {
      pairs.push([key, obj[key]])
    }
  }
  return pairs
}

module.exports = entries
