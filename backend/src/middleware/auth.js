const pool = require('../db');

const lastSeenWrites = new Map();
const LAST_SEEN_INTERVAL_MS = 5 * 60 * 1000;

function updateLastSeen(userId) {
  const now = Date.now();
  if (now - (lastSeenWrites.get(userId) || 0) < LAST_SEEN_INTERVAL_MS) return;
  lastSeenWrites.set(userId, now);
  void pool.query('UPDATE Student SET last_seen_at = NOW() WHERE user_id = ?', [userId])
    .catch((err) => {
      // Activity tracking must not make an otherwise valid request fail.
      lastSeenWrites.delete(userId);
      console.error('[auth] last-seen update failed:', userId, err.code || 'unknown');
    });
}

async function requireAuth(req, res, next) {
  if (req.session?.authType === 'admin' || req.session?.adminId) {
    return res.status(401).json({ error: 'not authenticated', request_id: req.requestId });
  }
  const userId = Number(req.session?.userId);
  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(401).json({ error: 'not authenticated', request_id: req.requestId });
  }

  try {
    const [rows] = await pool.query(
      `SELECT user_id, role, account_status
       FROM Student WHERE user_id = ? LIMIT 1`,
      [userId]
    );
    if (!rows.length) {
      return res.status(401).json({ error: 'not authenticated', request_id: req.requestId });
    }
    if (rows[0].account_status !== 'active') {
      return res.status(403).json({
        error: 'account suspended',
        code: 'ACCOUNT_SUSPENDED',
        request_id: req.requestId,
      });
    }

    req.account = rows[0];
    updateLastSeen(userId);
    next();
  } catch (err) {
    next(err);
  }
}

async function requireAdmin(req, res, next) {
  const hasStudentSession = Number.isSafeInteger(Number(req.session?.userId)) && Number(req.session.userId) > 0;
  const hasAdminSession = req.session?.authType === 'admin' || req.session?.adminId;
  if (!hasAdminSession && !hasStudentSession) {
    return res.status(401).json({ error: 'not authenticated', request_id: req.requestId });
  }

  const adminId = Number(req.session?.adminId);
  if (
    req.session?.authType !== 'admin'
    || hasStudentSession
    || !Number.isSafeInteger(adminId)
    || adminId <= 0
  ) {
    return res.status(403).json({ error: 'admin only', request_id: req.requestId });
  }

  try {
    // Roles are read on every request rather than cached in the session, so
    // revoking one takes effect immediately instead of at next login. The two
    // queries run in parallel, so this costs one round-trip window, not two.
    const [[rows], [grants]] = await Promise.all([
      pool.query(
        `SELECT admin_id, user_id, email, display_name, is_active
         FROM Admin WHERE admin_id = ? LIMIT 1`,
        [adminId]
      ),
      pool.query(
        `SELECT DISTINCT r.role_code, p.permission_code
         FROM Admin a
         JOIN User_Role ur       ON ur.user_id = a.user_id
         JOIN Role r             ON r.role_id = ur.role_id
         JOIN Role_Permission rp ON rp.role_id = ur.role_id
         JOIN Permission p       ON p.permission_id = rp.permission_id
         WHERE a.admin_id = ?`,
        [adminId]
      ),
    ]);
    if (!rows.length || Number(rows[0].is_active) !== 1) {
      return res.status(403).json({ error: 'admin only', request_id: req.requestId });
    }

    // An administrator with no role passes this guard and then fails every
    // requirePermission. That is deliberate: /api/admin/me stays reachable so
    // the console can say "this account has no role yet" rather than bouncing
    // them to the login page they just came from.
    req.admin = rows[0];
    req.admin.roles = [...new Set(grants.map((g) => g.role_code))].sort();
    req.admin.permissions = [...new Set(grants.map((g) => g.permission_code))].sort();
    req.permissions = new Set(req.admin.permissions);
    next();
  } catch (err) {
    next(err);
  }
}

const requireActiveAccount = requireAuth;

module.exports = { requireAuth, requireActiveAccount, requireAdmin };
