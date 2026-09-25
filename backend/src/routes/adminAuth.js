// What is left of the separate administrator login: 012 folded Admin into
// User_Account, so administrators now sign in through /login. Nobody becomes
// one by logging in — that takes a User_Role grant.

const express = require('express');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

// requireAdmin means "holds at least one admin permission".
router.get('/api/admin/me', requireAdmin, (req, res) => {
  res.json({
    user_id: Number(req.account.user_id),
    // Aliased to user_id so the console keeps working unchanged.
    admin_id: Number(req.account.user_id),
    email: req.account.email,
    display_name: req.account.full_name || null,
    roles: req.account.roles,
    permissions: req.account.permissions,
  });
});

// Old path, so the logout button needs no change. One session, so both apps.
router.post('/api/admin/auth/logout', (req, res) => {
  if (!Number.isSafeInteger(Number(req.session?.userId))) {
    return res.status(401).json({ error: 'not authenticated', request_id: req.requestId });
  }
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: 'logout failed', request_id: req.requestId });
    res.clearCookie('connect.sid');
    return res.json({ ok: true });
  });
});

module.exports = router;
