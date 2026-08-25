const pool = require('../db');

let pendingBuckets = new Map();
let flushTimer = null;
const startedAt = new Date();
const totals = {
  request_count: 0,
  client_error_count: 0,
  error_count: 0,
  total_response_ms: 0,
};
const routeGroups = new Map();

function mysqlHour(date) {
  const value = new Date(date);
  value.setMinutes(0, 0, 0);
  const pad = (part) => String(part).padStart(2, '0');
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())} ${pad(value.getHours())}:00:00`;
}

function routeGroup(path) {
  const match = String(path || '').match(/^\/api(?:\/([^/?]+))?/);
  return match?.[1] || 'other';
}

function recordRequest({ path, statusCode, durationMs }) {
  const duration = Number.isFinite(durationMs) ? Math.max(0, durationMs) : 0;
  const isClientError = statusCode >= 400 && statusCode < 500;
  const isServerError = statusCode >= 500;
  const key = mysqlHour(new Date());
  const bucket = pendingBuckets.get(key) || {
    bucket_start: key,
    request_count: 0,
    error_count: 0,
    total_response_ms: 0,
  };

  bucket.request_count += 1;
  bucket.error_count += Number(isServerError);
  bucket.total_response_ms += duration;
  pendingBuckets.set(key, bucket);

  totals.request_count += 1;
  totals.client_error_count += Number(isClientError);
  totals.error_count += Number(isServerError);
  totals.total_response_ms += duration;

  const group = routeGroup(path);
  const groupTotal = routeGroups.get(group) || { request_count: 0, error_count: 0 };
  groupTotal.request_count += 1;
  groupTotal.error_count += Number(isServerError);
  routeGroups.set(group, groupTotal);
}

function requestMetrics(req, res, next) {
  res.on('finish', () => {
    const started = req.requestStartedAt;
    const durationMs = started ? Number(process.hrtime.bigint() - started) / 1e6 : 0;
    recordRequest({ path: req.path, statusCode: res.statusCode, durationMs });
  });
  next();
}

function pendingSummary() {
  return [...pendingBuckets.values()].reduce(
    (summary, bucket) => ({
      request_count: summary.request_count + bucket.request_count,
      error_count: summary.error_count + bucket.error_count,
      total_response_ms: summary.total_response_ms + bucket.total_response_ms,
    }),
    { request_count: 0, error_count: 0, total_response_ms: 0 }
  );
}

async function flushMetrics() {
  if (!pendingBuckets.size) return;

  const flushing = pendingBuckets;
  pendingBuckets = new Map();
  try {
    const rows = [...flushing.values()].map((bucket) => [
      bucket.bucket_start,
      bucket.request_count,
      bucket.error_count,
      bucket.request_count ? bucket.total_response_ms / bucket.request_count : 0,
    ]);
    await pool.query(
      `INSERT INTO System_Request_Metric_Hourly
         (bucket_start, request_count, error_count, avg_response_ms)
       VALUES ?
       ON DUPLICATE KEY UPDATE
         avg_response_ms = ((avg_response_ms * request_count) + (VALUES(avg_response_ms) * VALUES(request_count))) /
                           (request_count + VALUES(request_count)),
         request_count = request_count + VALUES(request_count),
         error_count = error_count + VALUES(error_count)`,
      [rows]
    );
  } catch (err) {
    for (const [key, failedBucket] of flushing) {
      const current = pendingBuckets.get(key);
      if (current) {
        current.request_count += failedBucket.request_count;
        current.error_count += failedBucket.error_count;
        current.total_response_ms += failedBucket.total_response_ms;
      } else {
        pendingBuckets.set(key, failedBucket);
      }
    }
    console.error('[metrics] flush failed:', err.code || 'unknown');
  }
}

function startMetricFlush() {
  if (flushTimer) return;
  flushTimer = setInterval(() => { void flushMetrics(); }, 60 * 1000);
  flushTimer.unref();
}

function getLiveMetrics() {
  return {
    started_at: startedAt,
    request_count: totals.request_count,
    client_error_count: totals.client_error_count,
    error_count: totals.error_count,
    avg_response_ms: totals.request_count ? totals.total_response_ms / totals.request_count : 0,
    route_groups: Object.fromEntries(routeGroups),
  };
}

module.exports = {
  requestMetrics,
  flushMetrics,
  getLiveMetrics,
  pendingSummary,
  startMetricFlush,
};
