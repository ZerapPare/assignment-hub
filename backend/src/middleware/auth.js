const pool = require('../db');
const { ADMIN_PERMISSION_CODES } = require('../rbac/permissions');

const lastSeenWrites = new Map();
const LAST_SEEN_INTERVAL_MS = 5 * 60 * 1000;

function updateLastSeen(userId) {
  const now = Date.now();
  if (now - (lastSeenWrites.get(userId) || 0) < LAST_SEEN_INTERVAL_MS) return;
  lastSeenWrites.set(userId, now);
  void pool.query('UPDATE User_Account SET last_seen_at = NOW() WHERE user_id = ?', [userId])
    .catch((err) => {
      // Activity tracking must not fail an otherwise valid request.
      lastSeenWrites.delete(userId);
      console.error('[auth] last-seen update failed:', userId, err.code || 'unknown');
    });
}

// One session shape for everybody: req.session.userId and nothing else. No
// "admin mode" — the roles on that user_id decide everything, which is why one
// login page serves both apps.
//
// Roles are read every request, not cached in the session, so a revocation
// takes effect immediately. The two queries run in parallel.
async function loadAccount(userId) {
  const [[rows], [grants]] = await Promise.all([
    pool.query(
      `SELECT user_id, email, full_name, user_type, account_status
       FROM User_Account WHERE user_id = ? LIMIT 1`,
      [userId]
    ),
    pool.query(
      `SELECT DISTINCT r.role_code, p.permission_code
       FROM User_Role ur
       JOIN Role r             ON r.role_id = ur.role_id
       JOIN Role_Permission rp ON rp.role_id = ur.role_id
       JOIN Permission p       ON p.permission_id = rp.permission_id
       WHERE ur.user_id = ?`,
      [userId]
    ),
  ]);
  if (!rows.length) return null;

  const account = rows[0];
  account.roles = [...new Set(grants.map((g) => g.role_code))].sort();
  account.permissions = [...new Set(grants.map((g) => g.permission_code))].sort();
  return account;
}

async function requireAuth(req, res, next) {
  const userId = Number(req.session?.userId);
  if (!Number.isSafeInteger(userId) || userId <= 0) {
    return res.status(401).json({ error: 'not authenticated', request_id: req.requestId });
  }

  try {
    const account = await loadAccount(userId);
    if (!account) {
      return res.status(401).json({ error: 'not authenticated', request_id: req.requestId });
    }
    if (account.account_status !== 'active') {
      return res.status(403).json({
        error: 'account suspended',
        code: 'ACCOUNT_SUSPENDED',
        request_id: req.requestId,
      });
    }

    req.account = account;
    req.permissions = new Set(account.permissions);
    updateLastSeen(userId);
    next();
  } catch (err) {
    next(err);
  }
}

// Guards the console shell — the layout and /api/admin/me. Answers "does the
// admin console concern you at all"; requirePermission decides what you may do
// inside it. Permissive about *which* admin permission on purpose, so a
// narrowly-scoped account can still load the console and see its own sections.
async function requireAdmin(req, res, next) {
  return requireAuth(req, res, (err) => {
    if (err) return next(err);
    const hasAny = ADMIN_PERMISSION_CODES.some((code) => req.permissions.has(code));
    if (!hasAny) {
      return res.status(403).json({ error: 'admin only', request_id: req.requestId });
    }
    return next();
  });
}

const requireActiveAccount = requireAuth;

module.exports = { requireAuth, requireActiveAccount, requireAdmin, loadAccount };
