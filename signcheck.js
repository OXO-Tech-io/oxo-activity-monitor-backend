const crypto = require('crypto');
const { Storage } = require('@google-cloud/storage');
const { createGcsSigner } = require('./src/signer');

const { privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});

const storage = new Storage({
  projectId: 'x',
  credentials: { client_email: 'test@x.iam.gserviceaccount.com', private_key: privateKey },
});

createGcsSigner(storage, 'oxo-hris-bucket')('screenshots/d/2026-10-27/10/a.jpg', 'image/jpeg', 900).then((r) => {
  const u = new URL(r.url);
  console.log('path:          ', u.pathname);
  console.log('signed headers:', u.searchParams.get('X-Goog-SignedHeaders'));
  console.log('expires (s):   ', u.searchParams.get('X-Goog-Expires'));
  console.log('client sends:  ', r.headers);
});