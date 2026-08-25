const pool = require('../db');

const SENSITIVE_KEY = /(?:access|refresh|id)?[\s_-]*token|authorization|cookie|password|secret|session/i;
const MAX_DEPTH = 4;
const MAX_STRING_LENGTH = 2000;

function sanitizeString(value) {
  return String(value)
    .replace(/(["']?(?:access[_ -]?token|refresh[_ -]?token|id[_ -]?token|token|authorization|cookie|password|client_secret|session[_ -]?id)["']?\s*[:=]\s*)(?:Bearer\s+)?(?:"[^"]*"|'[^']*'|[^\s,;&}]+)/gi, '$1[REDACTED]')
    .replace(/\b(authorization|cookie)\s*[=:]\s*[^\r\n]*/gi, '$1=[REDACTED]')
    .replace(/\bBearer\s+[^\s,;&]+/gi, 'Bearer [REDACTED]')
    .replace(/((?:(?:access|refresh|id)[\s_-]*)?token|password|secret|session)\s*[=:]\s*[^\s,;&]+/gi, '$1[REDACTED]')
    .slice(0, MAX_STRING_LENGTH);
}

function sanitizeMetadata(value, depth = 0) {
  if (value === null || value === undefined) return value;
  if (depth >= MAX_DEPTH) return '[TRUNCATED]';
  if (typeof value === 'string') return sanitizeString(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => sanitizeMetadata(item, depth + 1));
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .slice(0, 50)
        .map(([key, item]) => [key, SENSITIVE_KEY.test(key) ? '[REDACTED]' : sanitizeMetadata(item, depth + 1)])
    );
  }
  return sanitizeString(value);
}

function errorSource(req, fallback = 'application') {
  if (fallback !== 'application') return fallback;
  const match = String(req?.path || '').match(/^\/api\/([^/?]+)/);
  return match?.[1]?.slice(0, 100) || fallback;
}

async function logError(err, req, options = {}) {
  try {
    const statusCode = Number.isInteger(options.statusCode)
      ? options.statusCode
      : (Number.isInteger(err?.statusCode) ? err.statusCode : 500);
    const source = errorSource(req, options.source).slice(0, 100);
    const userId = Number(req?.session?.userId);
    const metadata = sanitizeMetadata({
      name: err?.name,
      code: err?.code,
      ...options.metadata,
    });

    await pool.query(
      `INSERT INTO System_Error_Log
         (level, source, method, path, status_code, error_code, message, user_id, request_id, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        options.level || 'error',
        source,
        req?.method?.slice(0, 10) || null,
        req?.path?.slice(0, 255) || null,
        statusCode,
        err?.code ? String(err.code).slice(0, 100) : null,
        sanitizeString(err?.message || 'Unexpected server error'),
        Number.isInteger(userId) && userId > 0 ? userId : null,
        req?.requestId?.slice(0, 64) || null,
        JSON.stringify(metadata),
      ]
    );
  } catch (logErr) {
    console.error('[error-logger] failed to persist error:', logErr.code || 'unknown');
  }
}

function sanitizeErrorLog(row) {
  let metadata = row.metadata;
  if (typeof metadata === 'string') {
    try {
      metadata = JSON.parse(metadata);
    } catch (_) {
      metadata = '[UNPARSEABLE]';
    }
  }
  return {
    ...row,
    message: sanitizeString(row.message),
    metadata: sanitizeMetadata(metadata),
  };
}

module.exports = { logError, sanitizeMetadata, sanitizeErrorLog };
