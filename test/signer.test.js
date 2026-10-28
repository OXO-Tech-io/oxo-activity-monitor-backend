'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createGcsSigner} = require('../src/signer');

test('the signer asks for a V4 write URL with create-only-if-absent', async () => {
    let seen;
    const fakeStorage = {
        bucket: (bucketName) => ({
            file:(objectName) => ({
                getSignedUrl: async (opts) => {
                    seen = {bucketName, objectName, opts};
                    return ['https://signed.example/x'];
                },
            }),
        }),
    };

    const sign = createGcsSigner(fakeStorage, 'my-bucket');
    const before = Date.now();
    const r = await sign('screenshots/d/2026-10-27/10/a.jpg', 'image/jpeg', 900);


    assert.equal(seen.bucketName, 'my-bucket');
    assert.equal(seen.objectName, 'screenshots/d/2026-10-27/10/a.jpg');
    assert.equal(seen.opts.version, 'v4');
    assert.equal(seen.opts.action, 'write');
    assert.equal(seen.opts.contentType, 'image/jpeg');
    assert.equal(seen.opts.extensionHeaders['x-goog-if-generation-match'], '0');

    assert.ok(seen.opts.expires >= before + 900_000);
    assert.ok(seen.opts.expires <= Date.now() + 900_000);

    assert.equal(r.url, 'https://signed.example/x');
    assert.equal(r.headers['Content-Type'], 'image/jpeg');
    assert.equal(r.headers['x-goog-if-generation-match'], '0');
});