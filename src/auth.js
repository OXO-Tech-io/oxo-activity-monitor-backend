'use strict';

const crypto = require('crypto');
const { buffer } = require('stream/consumers');

function hashKey(key) {
    return crypto.createHash('sha256').update(key, 'utf8').digest('hex');
}

function verifyDeviceKey(deviceKeys, device, providedKey){
    const expectedhex = deviceKeys.get(device);

    const providedHex = hashKey(typeof providedKey === 'string' ? providedKey : '');

    const a = Buffer.from(providedHex, 'hex');
    const b = Buffer.from(expectedhex || '0'.repeat(64), 'hex');
    const equal = crypto.timingSafeEqual(a, b);

    return Boolean(expectedhex) && equal;
}

module.exports = { hashKey, verifyDeviceKey}; 