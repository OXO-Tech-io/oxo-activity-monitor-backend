'use strict';

const HEX64 = /^[0-9a-f]{64}$/;

function positiveInt(env, name, fallback) {
  const raw = env[name];
  if (raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return n;
}

function parseDeviceKeys(raw) {
    if (!raw) throw new Error('DEVICE_KEYS is required');

    let parsed;
    try{
        parsed = JSON.parse(raw);
    } catch {
        throw new Error('DEVICE_KEYS must be valid JSON');
    }

    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)){
        throw new Error('DEVICE_KEYS must be a JSON object of deviceName -> sha256 hex');
    }

     const map = new Map();
    for (const [device, hash] of Object.entries(parsed)) {
        const h = String(hash).toLowerCase();
        if (!HEX64.test(h)) {
        throw new Error(`DEVICE_KEYS entry for "${device}" is not a 64-character SHA-256 hex string`);
        }
        map.set(device.trim().toLowerCase(), h);
    }
    if (map.size === 0) throw new Error('DEVICE_KEYS has no entries');
    return map;
}

function loadConfig(env = process.env) {
  if (!env.BUCKET_NAME) {
    throw new Error('BUCKET_NAME is required');
  }

  return {
    bucketName: env.BUCKET_NAME,
    objectPrefix: (env.OBJECT_PREFIX || 'screenshots').replace(/^\/+|\/+$/g, ''),
    urlTtlSeconds: positiveInt(env, 'URL_TTL_SECONDS', 900),
    maxFiles: positiveInt(env, 'MAX_FILES_PER_REQUEST', 20),
    maxFileBytes: positiveInt(env, 'MAX_FILE_BYTES', 2 * 1024 * 1024),
    maxFileAgeDays: positiveInt(env, 'MAX_FILE_AGE_DAYS', 7),
    deviceKeys: parseDeviceKeys(env.DEVICE_KEYS),
    port: positiveInt(env, 'PORT', 8080),
  };
}

module.exports = { loadConfig, parseDeviceKeys };