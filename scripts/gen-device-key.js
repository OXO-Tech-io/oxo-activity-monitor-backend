'use strict';
// Usage: npm run gen-key -- OXO-LAPTOP-042
const crypto = require('crypto');
const { normalizeDeviceName } = require('../src/validation');
const { hashKey } = require('../src/auth');

const device = normalizeDeviceName(process.argv[2]);
if (!device) {
  console.error('Usage: npm run gen-key -- <deviceName>   (letters, digits, - and _ only)');
  process.exit(1);
}

const key = crypto.randomBytes(32).toString('base64url');

console.log(`device:            ${device}`);
console.log(`device key:        ${key}`);
console.log(`DEVICE_KEYS entry: "${device}": "${hashKey(key)}"`);
console.log('\nGive the key to that laptop once. Store only the hash on the server.');