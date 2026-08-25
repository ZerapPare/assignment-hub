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

const requireActiveAccount = requireAuth;

module.exports = { requireAuth, requireActiveAccount };
