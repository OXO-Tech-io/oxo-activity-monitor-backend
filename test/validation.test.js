'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeDeviceName, parseFileName, buildObjectName, validateFiles } = require('../src/validation');

const DEVICE = 'oxo-laptop-042';
const NOW = Date.UTC(2026, 9, 14, 12, 0, 0); // 2026-10-14 12:00 UTC (month 9 = October)
const config = { objectPrefix: 'screenshots', maxFiles: 3, maxFileBytes: 1000, maxFileAgeDays: 7 };
const good = (name = 'screenshot_20261014_001437.jpg') =>
  ({ name, size: 500, contentType: 'image/jpeg' });

// ---- normalizeDeviceName ----

test('valid device names are lowercased', () => {
  assert.equal(normalizeDeviceName('OXO-LAPTOP-042'), 'oxo-laptop-042');
  assert.equal(normalizeDeviceName('  pc_1 '), 'pc_1');
});

test('invalid device names return null', () => {
  for (const bad of ['', '../other', 'a/b', 'a b', '-leading', 'x'.repeat(64), 'caf\u00e9', null, 42, {}]) {
    assert.equal(normalizeDeviceName(bad), null, String(bad));
  }
});

test('63 characters is the longest allowed device name', () => {
  assert.equal(normalizeDeviceName('x'.repeat(63)), 'x'.repeat(63));
  assert.equal(normalizeDeviceName('x'.repeat(64)), null);
});

// ---- parseFileName ----

test('a valid file name is parsed into folder parts', () => {
  const r = parseFileName('screenshot_20261014_001437.jpg');
  assert.equal(r.dateFolder, '2026-10-14');
  assert.equal(r.hourFolder, '00');
  assert.equal(r.ts, Date.UTC(2026, 9, 14, 0, 14, 37));
});

test('invalid file names return null', () => {
  const bad = [
    'screenshot_20261345_001437.jpg', // month 13
    'screenshot_20260230_000000.jpg', // Feb 30
    'screenshot_20261014_256100.jpg', // 25:61:00
    'screenshot_20261014_001437.png', // wrong extension
    'screenshot_20261014_001437xjpg', // the dot must be a real dot
    '../screenshot_20261014_001437.jpg',
    '',
    undefined,
    42,
  ];
  for (const name of bad) {
    assert.equal(parseFileName(name), null, String(name));
  }
});

// ---- buildObjectName ----

test('object name is built from prefix, device, capture date and hour', () => {
  const parsed = parseFileName('screenshot_20261014_001437.jpg');
  assert.equal(
    buildObjectName('screenshots', DEVICE, parsed, 'screenshot_20261014_001437.jpg'),
    'screenshots/oxo-laptop-042/2026-10-14/00/screenshot_20261014_001437.jpg'
  );
});

test('the same input always gives the same path', () => {
  const parsed = parseFileName('screenshot_20261014_001437.jpg');
  const a = buildObjectName('screenshots', 'd1', parsed, 'screenshot_20261014_001437.jpg');
  const b = buildObjectName('screenshots', 'd1', parsed, 'screenshot_20261014_001437.jpg');
  assert.equal(a, b);
});

// ---- validateFiles (files, device, config, now) ----

test('a valid batch is accepted', () => {
  const r = validateFiles([good()], DEVICE, config, NOW);
  assert.equal(r.ok, true);
  assert.equal(
    r.files[0].objectName,
    'screenshots/oxo-laptop-042/2026-10-14/00/screenshot_20261014_001437.jpg'
  );
});

test('batch-level problems are rejected', () => {
  assert.equal(validateFiles([], DEVICE, config, NOW).ok, false);
  assert.equal(validateFiles('x', DEVICE, config, NOW).ok, false);
});

test('a wrong content type is rejected and names its field', () => {
  const r = validateFiles([{ ...good(), contentType: 'image/png' }], DEVICE, config, NOW);
  assert.equal(r.ok, false);
  assert.equal(r.errors[0].field, 'files[0].contentType');
});

test('bad sizes are rejected and name their field', () => {
  for (const size of [0, 1001, '500', 1.5, -5]) {
    const r = validateFiles([{ ...good(), size }], DEVICE, config, NOW);
    assert.equal(r.ok, false, `size ${size}`);
    assert.equal(r.errors[0].field, 'files[0].size', `size ${size}`);
  }
});

test('a duplicate name in one request is rejected', () => {
  const r = validateFiles([good(), good()], DEVICE, config, NOW);
  assert.equal(r.ok, false);
  assert.equal(r.errors[0].field, 'files[1].name');
});

test('too many files in one request is rejected', () => {
  const four = [
    good('screenshot_20261014_001437.jpg'),
    good('screenshot_20261014_001438.jpg'),
    good('screenshot_20261014_001439.jpg'),
    good('screenshot_20261014_001440.jpg'),
  ];
  const r = validateFiles(four, DEVICE, config, NOW);
  assert.equal(r.ok, false);
  assert.equal(r.errors[0].field, 'files');
});

test('all errors are collected, not just the first', () => {
  const r = validateFiles([{ name: 'bad.jpg', size: 0, contentType: 'image/png' }], DEVICE, config, NOW);
  assert.equal(r.ok, false);
  assert.equal(r.errors.length, 3);
});

// ---- age checks ----

test('a file older than the allowed age is rejected', () => {
  const r = validateFiles([good('screenshot_20260901_000000.jpg')], DEVICE, config, NOW);
  assert.equal(r.ok, false);
  assert.equal(r.errors[0].field, 'files[0].name');
});

test('a file timestamped in the future is rejected', () => {
  const r = validateFiles([good('screenshot_20261101_000000.jpg')], DEVICE, config, NOW);
  assert.equal(r.ok, false);
  assert.equal(r.errors[0].field, 'files[0].name');
});

test('a late retry still lands in the folder of its capture day', () => {
  const threeDaysLater = NOW + 3 * 24 * 60 * 60 * 1000;
  const r = validateFiles([good()], DEVICE, config, threeDaysLater);
  assert.equal(r.ok, true);
  assert.match(r.files[0].objectName, /\/2026-10-14\/00\//);
});