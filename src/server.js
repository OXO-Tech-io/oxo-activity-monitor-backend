'use strict';
const { loadConfig } = require('./config');
const { createApp } = require('./app');
const {Storage} = require('@google-cloud/storage');
const {createGcsSigner} = require('./signer');

const config = loadConfig();
const useFake = process.env.USE_FAKE_SIGNER === '1';

if(useFake && process.env.K_SERVICE){
    console.error('USE_FAKE_SIGNER must not be set on CLOUD Run');
    process.exit(1);
}

const fakeSigner = async (objectName, contentType) => ({
    url: `https://example.invalid/${objectName}`,
    headers: { 'Content-Type': contentType },
});

const signer = useFake
    ? fakeSigner
    : createGcsSigner(new Storage(), confg.bucketName);

const app = createApp({ config, signer});

const server = app.listen(config.port, () => {
  console.log(JSON.stringify({ severity: 'INFO', message: 'listening', port: config.port }));
});

let confg;
try{
    confg = loadConfig();
} catch (err){
    console.error(JSON.stringify({ severity: 'CRITICAL', message: 'invalid configuration', reason: err.message}));
    process.exit(1);
}



process.on('SIGTERM', () => server.close(() => process.exit(0)));