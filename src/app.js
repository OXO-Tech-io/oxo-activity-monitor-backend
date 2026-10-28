'use strict';
const express = require('express');
const {normalizeDeviceName, validateFiles} = require('./validation');
const {verifyDeviceKey} = require('./auth');

function log(severity, message, fields = {}){
    console.log(JSON.stringify({severity, message, ...fields}));
}

function errorBody(code, message, details){
    return { error: { code, message, ...(details ? { details } : {}) } };
}

function createApp({ config, signer, now = Date.now }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '16kb' }));

  app.get('/healthz', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  app.post('/upload-urls', async (req, res) => {
    const body = req.body && typeof req.body === 'object' ? req.body : {};

    // 1. Device name -> 400 if invalid
    const device = normalizeDeviceName(body.deviceName);
    if (!device) {
      return res.status(400).json(errorBody('invalid_request', 'deviceName is missing or invalid'));
    }

    const keyOk = verifyDeviceKey(config.deviceKeys, device, req.get('x-device-key'));
    if (!keyOk) {
      log('WARNING', 'auth_failed', { device });
      return res.status(401).json(errorBody('unauthorized', 'invalid device credentials'));
    }

    // 3. Files -> 400 with details if invalid
    const result = validateFiles(body.files, device, config, now());
    if (!result.ok) {
      log('INFO', 'validation_failed', { device, errorCount: result.errors.length });
      return res.status(400).json(errorBody('invalid_request', 'one or more fields are invalid', result.errors));
    }

    try {
      const uploads = await Promise.all(
        result.files.map(async (f) => {
          const { url, headers } = await signer(f.objectName, f.contentType, config.urlTtlSeconds);
          return { name: f.name, objectName: f.objectName, method: 'PUT', url, headers };
        })
      );
      log('INFO', 'urls_issued', { device, count: uploads.length });
      return res.status(200).json({
        expiresAt: new Date(now() + config.urlTtlSeconds * 1000).toISOString(),
        uploads,
      });
    } catch (err) {
      // The real reason goes to the log only, never to the client.
      log('ERROR', 'signing_failed', { device, reason: err && err.message });
      return res.status(500).json(errorBody('internal_error', 'could not issue upload URLs'));
    }
  });

  // Malformed JSON and oversized bodies land here.
  app.use((err, _req, res, _next) => {
    if (err && (err.type === 'entity.parse.failed' || err.type === 'entity.too.large')) {
      return res.status(400).json(errorBody('invalid_request', 'request body is not valid or too large'));
    }
    log('ERROR', 'unhandled', { reason: err && err.message });
    return res.status(500).json(errorBody('internal_error', 'unexpected error'));
  });

  return app;
}

module.exports = { createApp };