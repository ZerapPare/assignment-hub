const pool = require('../db');

// These are the meaningful product features shown in the business ranking. A
// login, dashboard view, sync request, or failed sync is useful context, but it
// is not evidence that a student adopted a feature.
const BUSINESS_FEATURES = Object.freeze([
  'classroom_sync',
  'manual_task',
  'task_status',
  'search_filter',
  'notification_settings',
]);
const TREND_FEATURES = Object.freeze([
  'authentication',
  'integrations',
  ...BUSINESS_FEATURES,
  'dashboard',
]);

const ACTIVE_EVENTS = Object.freeze([
  'auth.login_success',
  'integration.google_connected',
  'integration.microsoft_connected',
  'classroom.sync_success',
  'assignment.manual_created',
  'assignment.manual_updated',
  'assignment.manual_deleted',
  'assignment.status_changed',
  'assignment.search_used',
  'assignment.filter_used',
  'notification.settings_updated',
]);
const RANKED_EVENTS = Object.freeze([
  'classroom.sync_success',
  'assignment.manual_created',
  'assignment.manual_updated',
  'assignment.manual_deleted',
  'assignment.status_changed',
  'assignment.search_used',
  'assignment.filter_used',
  'notification.settings_updated',
]);
const ACTIVE_EVENT_CLAUSE = `e.event_name IN (${ACTIVE_EVENTS.map((event) => `'${event}'`).join(', ')})`;
const RANKED_EVENT_CLAUSE = `e.event_name IN (${RANKED_EVENTS.map((event) => `'${event}'`).join(', ')})`;
const TREND_EVENT_CLAUSE = "e.event_name NOT IN ('classroom.sync_requested', 'classroom.sync_failed')";

function normalizeRange(value) {
  if (value === undefined || value === null || value === '') return 30;
  const normalized = String(value);
  if (normalized === '7d') return 7;
  if (normalized === '30d') return 30;
  if (normalized === '90d') return 90;
  return null;
}

function interval(days) {
  return String(Number(days));
}

function number(value) {
  return Number(value || 0);
}

function dateKey(value) {
  if (value instanceof Date) return localDateKey(value);
  return String(value || '').slice(0, 10);
}

function localDateKey(value) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function startOfDay(value = new Date()) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function trendBuckets(days) {
  const today = startOfDay();
  if (days <= 30) {
    const first = new Date(today);
    first.setDate(first.getDate() - days + 1);
    return Array.from({ length: days }, (_, index) => {
      const bucket = new Date(first);
      bucket.setDate(first.getDate() + index);
      return localDateKey(bucket);
    });
  }

  const firstInRange = new Date(today);
  firstInRange.setDate(firstInRange.getDate() - days + 1);
  const first = new Date(firstInRange);
  const mondayOffset = (first.getDay() + 6) % 7;
  first.setDate(first.getDate() - mondayOffset);
  const last = new Date(today);
  const lastMondayOffset = (last.getDay() + 6) % 7;
  last.setDate(last.getDate() - lastMondayOffset);
  const buckets = [];
  for (const cursor = first; cursor <= last; cursor.setDate(cursor.getDate() + 7)) {
    buckets.push(localDateKey(cursor));
  }
  return buckets;
}

function fillTrend(rows, days) {
  const byBucket = new Map(rows.map((row) => [dateKey(row.period), row]));
  return trendBuckets(days).map((bucket) => ({
    bucket_start: bucket,
    period: bucket,
    unique_users: number(byBucket.get(bucket)?.unique_users),
    actions: number(byBucket.get(bucket)?.actions),
  }));
}

async function getActiveUserCount(days) {
  const [rows] = await pool.query(
    `SELECT COUNT(DISTINCT e.user_id) AS active_users
     FROM Product_Event e
     JOIN Student s ON s.user_id = e.user_id AND s.role = 'student'
     WHERE e.created_at >= DATE_SUB(NOW(), INTERVAL ${interval(days)} DAY)
       AND ${ACTIVE_EVENT_CLAUSE}`
  );
  return number(rows[0]?.active_users);
}

async function getOverview(days) {
  const range = interval(days);
  const [usersResult, activityResult] = await Promise.all([
    pool.query(
      `SELECT COUNT(*) AS total_users,
              COALESCE(SUM(created_at >= DATE_SUB(NOW(), INTERVAL ${range} DAY)), 0) AS new_users
       FROM Student
       WHERE role = 'student'`
    ),
    pool.query(
      `SELECT COUNT(DISTINCT CASE
                 WHEN e.created_at >= CURDATE() AND ${ACTIVE_EVENT_CLAUSE} THEN e.user_id
               END) AS dau,
              COUNT(DISTINCT CASE
                 WHEN e.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) AND ${ACTIVE_EVENT_CLAUSE} THEN e.user_id
               END) AS wau,
              COUNT(DISTINCT CASE
                 WHEN e.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) AND ${ACTIVE_EVENT_CLAUSE} THEN e.user_id
               END) AS mau,
              COUNT(DISTINCT CASE WHEN ${ACTIVE_EVENT_CLAUSE} THEN e.user_id END) AS active_users
       FROM Product_Event e
       JOIN Student s ON s.user_id = e.user_id AND s.role = 'student'`
    ),
  ]);
  const users = usersResult[0][0] || {};
  const activity = activityResult[0][0] || {};
  return {
    range_days: Number(days),
    total_users: number(users.total_users),
    new_users: number(users.new_users),
    active_users: number(activity.active_users),
    dau: number(activity.dau),
    wau: number(activity.wau),
    mau: number(activity.mau),
  };
}

async function getFeatureRanking(days) {
  const [activeUsers, rowsResult] = await Promise.all([
    getActiveUserCount(days),
    pool.query(
      `SELECT e.feature_name AS feature,
              COUNT(DISTINCT e.user_id) AS unique_users,
              COUNT(*) AS actions
       FROM Product_Event e
       JOIN Student s ON s.user_id = e.user_id AND s.role = 'student'
       WHERE e.created_at >= DATE_SUB(NOW(), INTERVAL ${interval(days)} DAY)
         AND ${RANKED_EVENT_CLAUSE}
       GROUP BY e.feature_name
       ORDER BY unique_users DESC, actions DESC, feature ASC`
    ),
  ]);

  return rowsResult[0].map((row) => {
    const uniqueUsers = number(row.unique_users);
    const actions = number(row.actions);
    return {
      feature: row.feature,
      unique_users: uniqueUsers,
      actions,
      adoption_rate: activeUsers ? Number(((uniqueUsers / activeUsers) * 100).toFixed(1)) : 0,
      actions_per_user: uniqueUsers ? Number((actions / uniqueUsers).toFixed(1)) : 0,
    };
  });
}

async function getFeatureTrend(feature, days) {
  const grouping = days <= 30
    ? 'DATE(e.created_at)'
    : 'DATE_SUB(DATE(e.created_at), INTERVAL WEEKDAY(e.created_at) DAY)';
  const [rows] = await pool.query(
    `SELECT ${grouping} AS period,
            COUNT(DISTINCT e.user_id) AS unique_users,
            COUNT(*) AS actions
     FROM Product_Event e
     JOIN Student s ON s.user_id = e.user_id AND s.role = 'student'
     WHERE e.feature_name = ?
       AND e.created_at >= DATE_SUB(NOW(), INTERVAL ${interval(days)} DAY)
       AND ${TREND_EVENT_CLAUSE}
     GROUP BY ${grouping}
     ORDER BY period`,
    [feature]
  );
  return fillTrend(rows, days);
}

async function getIntegrations(days) {
  const [connectionResult, syncResult] = await Promise.all([
    pool.query(
      `SELECT COALESCE(SUM(gg_refresh_token IS NOT NULL), 0) AS google_connected_users,
              COALESCE(SUM(ms_refresh_token IS NOT NULL), 0) AS microsoft_connected_users
       FROM Student
       WHERE role = 'student'`
    ),
    pool.query(
      `SELECT COUNT(DISTINCT CASE WHEN e.event_name = 'classroom.sync_success' THEN e.user_id END) AS google_classroom_sync_users,
              COALESCE(SUM(e.event_name = 'classroom.sync_requested'), 0) AS classroom_sync_attempts,
              COALESCE(SUM(e.event_name = 'classroom.sync_success'), 0) AS classroom_sync_successes,
              COALESCE(SUM(e.event_name = 'classroom.sync_failed'), 0) AS classroom_sync_failures
       FROM Product_Event e
       JOIN Student s ON s.user_id = e.user_id AND s.role = 'student'
       WHERE e.feature_name = 'classroom_sync'
         AND e.created_at >= DATE_SUB(NOW(), INTERVAL ${interval(days)} DAY)`
    ),
  ]);
  const connection = connectionResult[0][0] || {};
  const sync = syncResult[0][0] || {};
  const attempts = number(sync.classroom_sync_attempts);
  const successes = number(sync.classroom_sync_successes);
  const failures = number(sync.classroom_sync_failures);
  return {
    range_days: Number(days),
    google_connected_users: number(connection.google_connected_users),
    microsoft_connected_users: number(connection.microsoft_connected_users),
    google_classroom_sync_users: number(sync.google_classroom_sync_users),
    classroom_sync_attempts: attempts,
    classroom_sync_successes: successes,
    classroom_sync_failures: failures,
    sync_success_rate: attempts ? Number(((successes / attempts) * 100).toFixed(1)) : null,
  };
}

async function getSourceMix() {
  const [rows] = await pool.query(
    `SELECT CASE
              WHEN c.platform_source IS NULL OR c.platform_source = '' THEN 'Manual'
              ELSE c.platform_source
            END AS source,
            COUNT(a.assignment_id) AS assignments,
            COUNT(DISTINCT c.student_id) AS unique_users
     FROM Course c
     JOIN Student s ON s.user_id = c.student_id AND s.role = 'student'
     JOIN Assignment a ON a.course_id = c.course_id
     GROUP BY CASE
                WHEN c.platform_source IS NULL OR c.platform_source = '' THEN 'Manual'
                ELSE c.platform_source
              END
     ORDER BY assignments DESC, source ASC`
  );
  return rows.map((row) => ({
    source: row.source,
    assignments: number(row.assignments),
    unique_users: number(row.unique_users),
  }));
}

module.exports = {
  BUSINESS_FEATURES,
  TREND_FEATURES,
  getFeatureRanking,
  getFeatureTrend,
  getIntegrations,
  getOverview,
  getSourceMix,
  normalizeRange,
};
