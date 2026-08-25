const pool = require('../db');
const { pendingSummary } = require('../middleware/requestMetrics');
const { sanitizeErrorLog } = require('./errorLogger');

function number(value) {
  return Number(value || 0);
}

function normalizeRange(value) {
  return value === '30d' ? 30 : 7;
}

async function getSystemMetrics24h() {
  const [rows] = await pool.query(
    `SELECT COALESCE(SUM(request_count), 0) AS request_count,
            COALESCE(SUM(error_count), 0) AS error_count,
            COALESCE(SUM(avg_response_ms * request_count), 0) AS response_total_ms
     FROM System_Request_Metric_Hourly
     WHERE bucket_start >= DATE_SUB(NOW(), INTERVAL 24 HOUR)`
  );
  const persisted = rows[0] || {};
  const pending = pendingSummary();
  const requestCount = number(persisted.request_count) + pending.request_count;
  const errorCount = number(persisted.error_count) + pending.error_count;
  const responseTotalMs = number(persisted.response_total_ms) + pending.total_response_ms;

  return {
    request_count: requestCount,
    error_count: errorCount,
    avg_response_ms: requestCount ? responseTotalMs / requestCount : 0,
  };
}

function dateKey(value) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

function mergeUserTrend(newRows, activeRows) {
  const byDate = new Map();
  for (const row of newRows) {
    const date = dateKey(row.date);
    byDate.set(date, { date, new_users: number(row.count), active_users: 0 });
  }
  for (const row of activeRows) {
    const date = dateKey(row.date);
    const current = byDate.get(date) || { date, new_users: 0, active_users: 0 };
    current.active_users = number(row.count);
    byDate.set(date, current);
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

async function getDashboard(rangeDays) {
  // rangeDays is normalized to 7 or 30 before it reaches this service, so
  // embedding it keeps MySQL's INTERVAL syntax portable across driver versions.
  const interval = String(normalizeRange(rangeDays));
  const [userRows] = await pool.query(
    `SELECT COUNT(*) AS total,
            COALESCE(SUM(account_status = 'suspended'), 0) AS suspended,
            COALESCE(SUM(last_seen_at >= CURDATE()), 0) AS active_today,
            COALESCE(SUM(last_seen_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)), 0) AS active_7d,
            COALESCE(SUM(last_seen_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)), 0) AS active_30d,
            COALESCE(SUM(created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)), 0) AS new_7d,
            COALESCE(SUM(created_at >= DATE_SUB(NOW(), INTERVAL ${interval} DAY)), 0) AS new_in_range
     FROM Student`
  );
  const [errorRows, newUserRows, activeUserRows, sourceRows, errorCountRows, recentErrors, recentUsers, metrics] = await Promise.all([
    pool.query(
      `SELECT DATE(occurred_at) AS date, COUNT(*) AS count
       FROM System_Error_Log
       WHERE occurred_at >= DATE_SUB(NOW(), INTERVAL ${interval} DAY)
       GROUP BY DATE(occurred_at)
       ORDER BY date`
    ),
    pool.query(
      `SELECT DATE(created_at) AS date, COUNT(*) AS count
       FROM Student
       WHERE created_at >= DATE_SUB(NOW(), INTERVAL ${interval} DAY)
       GROUP BY DATE(created_at)
       ORDER BY date`
    ),
    pool.query(
      `SELECT DATE(last_seen_at) AS date, COUNT(*) AS count
       FROM Student
       WHERE last_seen_at >= DATE_SUB(NOW(), INTERVAL ${interval} DAY)
       GROUP BY DATE(last_seen_at)
       ORDER BY date`
    ),
    pool.query(
      `SELECT source, COUNT(*) AS count
       FROM System_Error_Log
       WHERE occurred_at >= DATE_SUB(NOW(), INTERVAL ${interval} DAY)
       GROUP BY source
       ORDER BY count DESC, source ASC
       LIMIT 10`
    ),
    pool.query(
      `SELECT COUNT(*) AS count FROM System_Error_Log
       WHERE occurred_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)`
    ),
    pool.query(
      `SELECT error_id, occurred_at, level, source, method, path,
              status_code, error_code, message, user_id, request_id
       FROM System_Error_Log
       ORDER BY occurred_at DESC, error_id DESC LIMIT 5`
    ),
    pool.query(
      `SELECT user_id, student_id, student_name, university_email,
              account_status, last_seen_at
       FROM Student
       WHERE last_seen_at IS NOT NULL
       ORDER BY last_seen_at DESC, user_id DESC LIMIT 5`
    ),
    getSystemMetrics24h(),
  ]);

  const users = userRows[0] || {};
  return {
    users: {
      total: number(users.total),
      suspended: number(users.suspended),
      active_today: number(users.active_today),
      active_7d: number(users.active_7d),
      active_30d: number(users.active_30d),
      new_7d: number(users.new_7d),
      new_in_range: number(users.new_in_range),
    },
    system: {
      api_status: 'healthy',
      db_status: 'healthy',
      requests_24h: metrics.request_count,
      errors_24h: number(errorCountRows[0]?.[0]?.count),
      error_rate: metrics.request_count ? (metrics.error_count / metrics.request_count) * 100 : 0,
      avg_response_ms: metrics.avg_response_ms,
    },
    errors_by_day: errorRows[0].map((row) => ({ ...row, count: number(row.count) })),
    users_by_day: mergeUserTrend(newUserRows[0], activeUserRows[0]),
    top_error_sources: sourceRows[0].map((row) => ({ ...row, count: number(row.count) })),
    recent_errors: recentErrors[0].map(sanitizeErrorLog),
    recent_active_users: recentUsers[0],
  };
}

module.exports = { getDashboard, getSystemMetrics24h, normalizeRange };
