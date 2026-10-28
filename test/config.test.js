'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadConfig, parseDeviceKeys } = require('../src/config');

const HASH = 'a'.repeat(64);
const goodEnv = { BUCKET_NAME: 'b', DEVICE_KEYS: JSON.stringify({ 'oxo-1': HASH }) };

test('missing BUCKET_NAME throws', () => {
  assert.throws(() => loadConfig({ DEVICE_KEYS: goodEnv.DEVICE_KEYS }), /BUCKET_NAME/);
});

test('defaults are applied', () => {
  const c = loadConfig(goodEnv);
  assert.equal(c.objectPrefix, 'screenshots');
  assert.equal(c.urlTtlSeconds, 900);
  assert.equal(c.maxFileAgeDays, 7);
  assert.equal(c.port, 8080);
});

test('a bad number throws', () => {
  assert.throws(() => loadConfig({ ...goodEnv, URL_TTL_SECONDS: 'abc' }), /URL_TTL_SECONDS/);
});

test('overrides are respected and the prefix is trimmed', () => {
  const c = loadConfig({ ...goodEnv, PORT: '3000', OBJECT_PREFIX: '/shots/' });
  assert.equal(c.port, 3000);
  assert.equal(c.objectPrefix, 'shots');
});

test('valid DEVICE_KEYS becomes a Map with lowercase device names', () => {
  const m = parseDeviceKeys(JSON.stringify({ 'OXO-1': HASH }));
  assert.equal(m.get('oxo-1'), HASH);
});

test('bad DEVICE_KEYS throw the right errors', () => {
  assert.throws(() => parseDeviceKeys(''), /DEVICE_KEYS is required/);
  assert.throws(() => parseDeviceKeys('not json'), /valid JSON/);
  assert.throws(() => parseDeviceKeys('[]'), /JSON object/);
  assert.throws(() => parseDeviceKeys('{}'), /no entries/);
  assert.throws(() => parseDeviceKeys('{"a":"short"}'), /64-character/);
});

test('loadConfig exposes deviceKeys as a Map', () => {
  assert.ok(loadConfig(goodEnv).deviceKeys instanceof Map);
});

test('loadConfig rejects a missing or invalid DEVICE_KEYS', () => {
  assert.throws(() => loadConfig({ BUCKET_NAME: 'b' }), /DEVICE_KEYS is required/);
  assert.throws(
    () => loadConfig({ BUCKET_NAME: 'b', DEVICE_KEYS: '{"a":"THE_HASH_FROM_GEN_KEY"}' }),
    /64-character/
  );
});

test('default are applied', () => {
    const c = loadConfig(goodEnv);
    assert.equal(c.bucketName, 'b');
    assert.equal(c.objectPrefix, 'screenshots');
    assert.equal(c.urlTtlSeconds, 900);
    assert.equal(c.maxFiles, 20);
    assert.equal(c.maxFileAgeDays, 7);
    assert.equal(c.maxFileBytes, 2 * 1024 * 1024);
    assert.equal(c.port, 8080);
});