'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { hashKey, verifyDeviceKey } = require('../src/auth');

const keys = new Map([['d1', hashKey('secret-1')], ['d2', hashKey('secret-2')]]);

test('the right key for its own device passes', () => {
  assert.equal(verifyDeviceKey(keys, 'd1', 'secret-1'), true);
});

test('wrong, missing, or another device\'s key fails', () => {
  assert.equal(verifyDeviceKey(keys, 'd1', 'nope'), false);
  assert.equal(verifyDeviceKey(keys, 'd1', undefined), false);
  assert.equal(verifyDeviceKey(keys, 'd1', 'secret-2'), false);
});

test('an unknown device fails, including names on Object.prototype', () => {
  assert.equal(verifyDeviceKey(keys, 'ghost', 'secret-1'), false);
  assert.equal(verifyDeviceKey(keys, 'constructor', 'secret-1'), false);
});