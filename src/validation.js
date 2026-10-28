'use strict';

const DEVICE_RE = /^[a-z0-9][a-z0-9_-]{0,62}$/;

const FILE_RE = /^screenshot_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})\.jpg$/;


const ALLOWED_CONTENT_TYPE = 'image/jpeg';
const DAY_MS = 24 * 60 * 60 * 1000;

function normalizeDeviceName(value) {
  if (typeof value !== 'string') return null;
  const name = value.trim().toLowerCase();
  return DEVICE_RE.test(name) ? name : null;
}

function parseFileName(name) {
  if (typeof name !== 'string') return null;

  const m = FILE_RE.exec(name);
  if (!m) return null;

  const [year, month, day, hour, minute, second] = m.slice(1).map(Number);

  // Date.UTC counts months from 0, so subtract 1 going in.
  const ts = Date.UTC(year, month - 1, day, hour, minute, second);
  const d = new Date(ts);

  // JavaScript rolls impossible dates forward (Feb 30 -> Mar 2).
  // Read the parts back out: if any differ, the date wasn't real.
  if (
    d.getUTCFullYear() !== year ||
    d.getUTCMonth() !== month - 1 ||
    d.getUTCDate() !== day ||
    d.getUTCHours() !== hour ||
    d.getUTCMinutes() !== minute ||
    d.getUTCSeconds() !== second
  ) {
    return null;
  }

  const pad = (n) => String(n).padStart(2, '0');
  return {
    ts,
    dateFolder: `${year}-${pad(month)}-${pad(day)}`,
    hourFolder: pad(hour),
  };
}

function buildObjectName(prefix, device, parsed, fileName){
    return `${prefix}/${device}/${parsed.dateFolder}/${parsed.hourFolder}/${fileName}`;
}

function validateFiles(files, device, config, nowMs = Date.now()) {
  if (!Array.isArray(files) || files.length === 0) {
    return { ok: false, errors: [{ field: 'files', message: 'must be a non-empty array' }] };
  }
  if (files.length > config.maxFiles) {
    return { ok: false, errors: [{ field: 'files', message: `at most ${config.maxFiles} files per request` }] };
  }

  const errors = [];
  const seen = new Set();
  const accepted = [];

  files.forEach((f, i) => {
    const at = (key) => `files[${i}].${key}`;

    if (f === null || typeof f !== 'object') {
      errors.push({ field: `files[${i}]`, message: 'must be an object' });
      return;
    }

    const parsed = parseFileName(f.name);
    if (!parsed) {
      errors.push({ field: at('name'), message: 'must match screenshot_YYYYMMDD_HHmmss.jpg with a real date' });
    } else if (parsed.ts > nowMs + DAY_MS) {
      errors.push({ field: at('name'), message: 'timestamp is in the future' });
    } else if (parsed.ts < nowMs - config.maxFileAgeDays * DAY_MS - DAY_MS) {
      errors.push({ field: at('name'), message: `older than ${config.maxFileAgeDays} days` });
    }

    if (f.contentType !== ALLOWED_CONTENT_TYPE) {
      errors.push({ field: at('contentType'), message: `must be ${ALLOWED_CONTENT_TYPE}` });
    }

    if (!Number.isInteger(f.size) || f.size <= 0 || f.size > config.maxFileBytes) {
      errors.push({ field: at('size'), message: `must be a whole number from 1 to ${config.maxFileBytes}` });
    }

    if (typeof f.name === 'string') {
      if (seen.has(f.name)) {
        errors.push({ field: at('name'), message: 'duplicate name in request' });
      }
      seen.add(f.name);
    }

    if (parsed && f.contentType === ALLOWED_CONTENT_TYPE) {
      accepted.push({
        name: f.name,
        contentType: f.contentType,
        objectName: buildObjectName(config.objectPrefix, device, parsed, f.name),
      });
    }
  });

  return errors.length ? { ok: false, errors } : { ok: true, files: accepted };
}

module.exports = { normalizeDeviceName, parseFileName, validateFiles, buildObjectName };