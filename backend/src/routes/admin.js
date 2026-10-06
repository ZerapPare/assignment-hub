const express = require('express');
const pool = require('../db');
const { requireAdmin, requirePermission } = require('../middleware/adminAuth');
const { PERMISSIONS: P, hasPermission } = require('../rbac/permissions');
const { getDashboard, getSystemMetrics24h, normalizeRange } = require('../services/adminMetrics');
const { logError, sanitizeErrorLog, sanitizeMetadata } = require('../services/errorLogger');
const { getLiveMetrics } = require('../middleware/requestMetrics');

const router = express.Router();
const USER_STATUSES = new Set(['active', 'suspended']);
const ERROR_LEVELS = new Set(['error', 'warn']);

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function asPositiveId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function pagination(query, defaultPageSize) {
  const page = Number(query.page ?? 1);
  const pageSize = Number(query.pageSize ?? defaultPageSize);
  if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    return null;
  }
  const offset = (page - 1) * pageSize;
  if (!Number.isSafeInteger(offset)) return null;
  return { page, pageSize, offset };
}

function booleanFields(row) {
  return {
    ...row,
    google_connected: Boolean(row.google_connected),
    microsoft_connected: Boolean(row.microsoft_connected),
    assignment_count: Number(row.assignment_count || 0),
  };
}

function parseJson(value) {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch (_) {
    return null;
  }
}

async function writeAudit(executor, adminUserId, action, targetType, targetId, detail = null) {
  await executor.query(
    `INSERT INTO Admin_Audit_Log
       (admin_user_id, action, target_type, target_id, detail)
     VALUES (?, ?, ?, ?, ?)`,
    [
      adminUserId,
      action,
      targetType,
      targetId === null || targetId === undefined ? null : String(targetId),
      detail === null ? null : JSON.stringify(sanitizeMetadata(detail)),
    ]
  );
}

function userSelect() {
  // Aliased to the names the console already renders, so folding Student into
  // User_Account stayed invisible to the frontend.
  return `SELECT s.user_id, s.student_id,
                 s.full_name AS student_name, s.email AS university_email,
                 u.university_name, s.user_type, s.account_status, s.created_at,
                 s.last_login_at, s.last_seen_at,
                 s.gg_refresh_token IS NOT NULL AS google_connected,
                 s.ms_refresh_token IS NOT NULL AS microsoft_connected,
                 COALESCE(ac.assignment_count, 0) AS assignment_count
          FROM User_Account s
          LEFT JOIN University u ON u.university_id = s.university_id
          LEFT JOIN (
            SELECT c.student_id, COUNT(*) AS assignment_count
            FROM Course c
            JOIN Assignment a ON a.course_id = c.course_id
            GROUP BY c.student_id
          ) ac ON ac.student_id = s.user_id`;
}

// Authentication only — permissions go per route below. This prefix also covers
// /api/admin/business/*, which this router does not own, so a blanket
// requirePermission here would reject those before adminBusiness.js sees them.
router.use('/api/admin', requireAdmin);

router.get('/api/admin/dashboard', requirePermission(P.DASHBOARD_VIEW), asyncRoute(async (req, res) => {
  const rangeDays = normalizeRange(req.query.range);
  res.json(await getDashboard(rangeDays));
}));

router.get('/api/admin/users', requirePermission(P.USER_READ), asyncRoute(async (req, res) => {
  const page = pagination(req.query, 25);
  if (!page) return res.status(400).json({ error: 'invalid pagination', request_id: req.requestId });

  const clauses = ['s.user_type = ?'];
  const params = ['student'];
  const search = String(req.query.search || '').trim().slice(0, 100);
  const status = String(req.query.status || '').trim();
  const provider = String(req.query.provider || '').trim();

  if (status) {
    if (!USER_STATUSES.has(status)) {
      return res.status(400).json({ error: 'invalid status filter', request_id: req.requestId });
    }
    clauses.push('s.account_status = ?');
    params.push(status);
  }
  if (provider) {
    if (provider === 'google') clauses.push('s.gg_refresh_token IS NOT NULL');
    else if (provider === 'microsoft') clauses.push('s.ms_refresh_token IS NOT NULL');
    else return res.status(400).json({ error: 'invalid provider filter', request_id: req.requestId });
  }
  if (search) {
    clauses.push('(s.full_name LIKE ? OR s.email LIKE ? OR s.student_id LIKE ?)');
    const pattern = `%${search}%`;
    params.push(pattern, pattern, pattern);
  }

  const where = clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '';
  const [rowsResult, totalResult] = await Promise.all([
    pool.query(
      `${userSelect()}${where}
       ORDER BY s.created_at DESC, s.user_id DESC
       LIMIT ? OFFSET ?`,
      [...params, page.pageSize, page.offset]
    ),
    pool.query(`SELECT COUNT(*) AS total FROM User_Account s${where}`, params),
  ]);
  const total = Number(totalResult[0][0]?.total || 0);
  res.json({
    users: rowsResult[0].map(booleanFields),
    pagination: {
      page: page.page,
      pageSize: page.pageSize,
      total,
      totalPages: Math.ceil(total / page.pageSize),
    },
  });
}));

router.get('/api/admin/users/:id', requirePermission(P.USER_READ), asyncRoute(async (req, res) => {
  const userId = asPositiveId(req.params.id);
  if (!userId) return res.status(404).json({ error: 'not found', request_id: req.requestId });

  const [userResult, courseResult, statusResult, errorsResult, auditsResult] = await Promise.all([
    pool.query(
      `${userSelect()} WHERE s.user_type = 'student' AND s.user_id = ?`,
      [userId]
    ),
    pool.query('SELECT COUNT(*) AS course_count FROM Course WHERE student_id = ?', [userId]),
    pool.query(
      `SELECT COALESCE(d.status, 'not_started') AS status, COUNT(*) AS count
       FROM Assignment a
       JOIN Course c ON c.course_id = a.course_id
       LEFT JOIN Assignment_Detail d ON d.assignment_id = a.assignment_id
       WHERE c.student_id = ?
       GROUP BY COALESCE(d.status, 'not_started')`,
      [userId]
    ),
    pool.query(
      `SELECT error_id, occurred_at, level, source, method, path, status_code,
              error_code, message, request_id
       FROM System_Error_Log WHERE user_id = ?
       ORDER BY occurred_at DESC, error_id DESC LIMIT 20`,
      [userId]
    ),
    pool.query(
      `SELECT audit_id, admin_user_id, action, target_type, target_id, detail, created_at
       FROM Admin_Audit_Log
       WHERE target_type = 'user' AND target_id = ?
       ORDER BY created_at DESC, audit_id DESC LIMIT 20`,
      [String(userId)]
    ),
  ]);
  if (!userResult[0].length) return res.status(404).json({ error: 'not found', request_id: req.requestId });

  const assignmentStatusCounts = statusResult[0].map((row) => ({
    status: row.status,
    count: Number(row.count),
  }));
  const statusTotals = Object.fromEntries(
    assignmentStatusCounts.map((row) => [row.status, row.count])
  );
  await writeAudit(pool, req.session.userId, 'USER_VIEW_DETAIL', 'user', userId);
  res.json({
    user: booleanFields(userResult[0][0]),
    usage: {
      course_count: Number(courseResult[0][0]?.course_count || 0),
      assignment_count: assignmentStatusCounts.reduce((sum, row) => sum + row.count, 0),
      assignment_status_counts: assignmentStatusCounts,
      ...statusTotals,
    },
    recent_errors: errorsResult[0].map(sanitizeErrorLog),
    // Attribute-level check: seeing the record is user.read, seeing which
    // administrator did what to it is audit_log.read.
    recent_audit_actions: hasPermission(req.permissions, P.AUDIT_LOG_READ)
      ? auditsResult[0].map((row) => ({
        ...row,
        detail: sanitizeMetadata(parseJson(row.detail)),
      }))
      : [],
  });
}));

router.patch('/api/admin/users/:id/status', requirePermission(P.USER_SUSPEND), asyncRoute(async (req, res) => {
  const userId = asPositiveId(req.params.id);
  const status = String(req.body?.status || '');
  if (!userId) return res.status(404).json({ error: 'not found', request_id: req.requestId });
  if (!USER_STATUSES.has(status)) {
    return res.status(400).json({ error: 'status must be active or suspended', request_id: req.requestId });
  }
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    // A plain id comparison now that everyone shares one table. It used to
    // match on email, the only thing two separate key spaces had in common.
    if (userId === Number(req.session.userId)) {
      await conn.rollback();
      return res.status(400).json({ error: 'administrators cannot change their own status', request_id: req.requestId });
    }
    const [users] = await conn.query(
      'SELECT account_status FROM User_Account WHERE user_type = \'student\' AND user_id = ? FOR UPDATE',
      [userId]
    );
    if (!users.length) {
      await conn.rollback();
      return res.status(404).json({ error: 'not found', request_id: req.requestId });
    }
    const previousStatus = users[0].account_status;
    await conn.query('UPDATE User_Account SET account_status = ? WHERE user_id = ?', [status, userId]);
    await writeAudit(
      conn,
      req.session.userId,
      status === 'suspended' ? 'USER_SUSPEND' : 'USER_UNSUSPEND',
      'user',
      userId,
      { previous_status: previousStatus, status }
    );
    await conn.commit();
    res.json({ ok: true, user_id: userId, account_status: status });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}));

router.get('/api/admin/errors', requirePermission(P.ERROR_LOG_READ), asyncRoute(async (req, res) => {
  const page = pagination(req.query, 50);
  if (!page) return res.status(400).json({ error: 'invalid pagination', request_id: req.requestId });

  const clauses = [];
  const params = [];
  const level = String(req.query.level || '').trim();
  const source = String(req.query.source || '').trim().slice(0, 100);
  const status = String(req.query.status || '').trim();
  const search = String(req.query.search || '').trim().slice(0, 255);
  const from = String(req.query.from || '').trim();
  const to = String(req.query.to || '').trim();

  if (level) {
    if (!ERROR_LEVELS.has(level)) return res.status(400).json({ error: 'invalid level filter', request_id: req.requestId });
    clauses.push('e.level = ?');
    params.push(level);
  }
  if (source) {
    clauses.push('e.source = ?');
    params.push(source);
  }
  if (status) {
    const statusCode = Number(status);
    if (!Number.isInteger(statusCode) || statusCode < 100 || statusCode > 599) {
      return res.status(400).json({ error: 'invalid status filter', request_id: req.requestId });
    }
    clauses.push('e.status_code = ?');
    params.push(statusCode);
  }
  if (search) {
    clauses.push('(e.message LIKE ? OR e.request_id LIKE ? OR e.error_code LIKE ?)');
    const pattern = `%${search}%`;
    params.push(pattern, pattern, pattern);
  }
  if (from) {
    if (!/^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2})?)?$/.test(from)) {
      return res.status(400).json({ error: 'invalid from date', request_id: req.requestId });
    }
    clauses.push('e.occurred_at >= ?');
    params.push(from);
  }
  if (to) {
    if (!/^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2})?)?$/.test(to)) {
      return res.status(400).json({ error: 'invalid to date', request_id: req.requestId });
    }
    clauses.push('e.occurred_at <= ?');
    params.push(to.length === 10 ? `${to} 23:59:59` : to);
  }

  const where = clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '';
  const [rowsResult, totalResult] = await Promise.all([
    pool.query(
      `SELECT e.error_id, e.occurred_at, e.level, e.source, e.method, e.path,
              e.status_code, e.error_code, e.message, e.user_id, e.request_id,
              s.full_name, s.email
       FROM System_Error_Log e
       LEFT JOIN User_Account s ON s.user_id = e.user_id${where}
       ORDER BY e.occurred_at DESC, e.error_id DESC
       LIMIT ? OFFSET ?`,
      [...params, page.pageSize, page.offset]
    ),
    pool.query(`SELECT COUNT(*) AS total FROM System_Error_Log e${where}`, params),
  ]);
  const total = Number(totalResult[0][0]?.total || 0);
  res.json({
    errors: rowsResult[0].map(sanitizeErrorLog),
    pagination: {
      page: page.page,
      pageSize: page.pageSize,
      total,
      totalPages: Math.ceil(total / page.pageSize),
    },
  });
}));

router.get('/api/admin/errors/:id', requirePermission(P.ERROR_LOG_READ), asyncRoute(async (req, res) => {
  if (!/^\d{1,20}$/.test(String(req.params.id))) {
    return res.status(404).json({ error: 'not found', request_id: req.requestId });
  }
  const errorId = String(req.params.id);
  const [rows] = await pool.query(
    `SELECT e.error_id, e.occurred_at, e.level, e.source, e.method, e.path,
            e.status_code, e.error_code, e.message, e.user_id, e.request_id, e.metadata,
            s.full_name, s.email
     FROM System_Error_Log e
     LEFT JOIN User_Account s ON s.user_id = e.user_id
     WHERE e.error_id = ? LIMIT 1`,
    [errorId]
  );
  if (!rows.length) return res.status(404).json({ error: 'not found', request_id: req.requestId });

  await writeAudit(pool, req.session.userId, 'ERROR_VIEW_DETAIL', 'error', errorId);
  res.json({ error: sanitizeErrorLog(rows[0]) });
}));

router.get('/api/admin/system/health', requirePermission(P.SYSTEM_HEALTH_READ), asyncRoute(async (req, res) => {
  let dbStatus = 'healthy';
  try {
    await pool.query('SELECT 1');
  } catch (err) {
    dbStatus = 'unavailable';
    await logError(err, req, { source: 'database', statusCode: 503, level: 'warn' });
  }

  const liveMetrics = getLiveMetrics();
  const historicalMetrics = dbStatus === 'healthy'
    ? await getSystemMetrics24h()
    : { request_count: 0, error_count: 0, avg_response_ms: 0 };
  const memory = process.memoryUsage();
  res.status(dbStatus === 'healthy' ? 200 : 503).json({
    api_status: 'healthy',
    db_status: dbStatus,
    uptime_seconds: Math.floor(process.uptime()),
    node_version: process.version,
    memory: {
      rss: memory.rss,
      heap_used: memory.heapUsed,
      heap_total: memory.heapTotal,
    },
    memory_usage_mb: Math.round(memory.heapUsed / (1024 * 1024)),
    metrics: {
      requests_24h: historicalMetrics.request_count,
      errors_24h: historicalMetrics.error_count,
      avg_response_ms: historicalMetrics.avg_response_ms,
      process_requests: liveMetrics.request_count,
      process_error_count: liveMetrics.error_count,
      route_groups: liveMetrics.route_groups,
    },
  });
}));

module.exports = router;
