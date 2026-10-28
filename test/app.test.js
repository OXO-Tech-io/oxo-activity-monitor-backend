'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../src/app');
const { hashKey } = require('../src/auth');

const NOW = Date.UTC(2026, 9, 14, 12, 0, 0);
const config = {
  objectPrefix: 'screenshots',
  urlTtlSeconds: 900,
  maxFiles: 20,
  maxFileBytes: 2_000_000,
  maxFileAgeDays: 7,
  deviceKeys: new Map([
    ['oxo-laptop-042', hashKey('k-042')],
    ['oxo-laptop-043', hashKey('k-043')],
  ]),
};

const calls = [];
const fakeSigner = async (objectName, contentType, ttlSeconds) => {
  calls.push({ objectName, contentType, ttlSeconds });
  return {
    url: `https://signed.example/${objectName}?sig=FAKE`,
    headers: { 'Content-Type': contentType },
  };
};

async function withServer(signer, fn) {
  const app = createApp({ config, signer, now: () => NOW });
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    await fn(base);
  } finally {
    server.close();
  }
}

const post = (base, body, headers = {}) =>
  fetch(`${base}/upload-urls`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

const goodBody = (device = 'OXO-LAPTOP-042') => ({
  deviceName: device,
  files: [{ name: 'screenshot_20261014_001437.jpg', size: 1234, contentType: 'image/jpeg' }],
});

test('health check returns ok', async () => {
  await withServer(fakeSigner, async (base) => {
    const r = await fetch(`${base}/healthz`);
    assert.equal(r.status, 200);
  });
});

test('a valid request returns a signed URL for the server-built path', async () => {
  calls.length = 0;
  await withServer(fakeSigner, async (base) => {
    const r = await post(base, goodBody(), { 'x-device-key': 'k-042' });
    assert.equal(r.status, 200);
    const j = await r.json();
    assert.equal(j.uploads.length, 1);
    assert.equal(j.uploads[0].method, 'PUT');
    assert.equal(
      j.uploads[0].objectName,
      'screenshots/oxo-laptop-042/2026-10-14/00/screenshot_20261014_001437.jpg'
    );
    assert.equal(j.expiresAt, new Date(NOW + 900_000).toISOString());
    assert.equal(calls[0].ttlSeconds, 900);
  });
});

test('a missing or wrong key returns 401 and never calls the signer', async () => {
  calls.length = 0;
  await withServer(fakeSigner, async (base) => {
    assert.equal((await post(base, goodBody())).status, 401);
    assert.equal((await post(base, goodBody(), { 'x-device-key': 'wrong' })).status, 401);
    assert.equal(calls.length, 0);
  });
});

test('a key issued to one device cannot be used for another', async () => {
  await withServer(fakeSigner, async (base) => {
    const r = await post(base, goodBody('oxo-laptop-043'), { 'x-device-key': 'k-042' });
    assert.equal(r.status, 401);
  });
});

test('a path-traversal device name is rejected with 400', async () => {
  await withServer(fakeSigner, async (base) => {
    const r = await post(base, goodBody('../other'), { 'x-device-key': 'k-042' });
    assert.equal(r.status, 400);
  });
});

test('invalid files return 400 with the field name', async () => {
  await withServer(fakeSigner, async (base) => {
    const body = goodBody();
    body.files[0].contentType = 'image/png';
    const r = await post(base, body, { 'x-device-key': 'k-042' });
    assert.equal(r.status, 400);
    const j = await r.json();
    assert.equal(j.error.details[0].field, 'files[0].contentType');
  });
});

test('malformed JSON returns 400', async () => {
  await withServer(fakeSigner, async (base) => {
    const r = await post(base, '{not json', { 'x-device-key': 'k-042' });
    assert.equal(r.status, 400);
  });
});

test('a signer failure returns 500 without leaking the reason', async () => {
  const failing = async () => {
    throw new Error('internal secret detail');
  };
  await withServer(failing, async (base) => {
    const r = await post(base, goodBody(), { 'x-device-key': 'k-042' });
    assert.equal(r.status, 500);
    assert.doesNotMatch(await r.text(), /secret detail/);
  });
});