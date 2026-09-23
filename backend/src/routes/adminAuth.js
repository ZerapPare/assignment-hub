// What is left of the separate administrator login.
//
// A second OAuth flow used to live here because `Admin` and `Student` were
// different tables and an administrator had no row the ordinary login could
// find. Migration 013 merged them, so administrators sign in through /login.
//
// Nobody becomes an administrator by logging in — that takes a User_Role grant.
// Same guarantee the old allowlist gave, moved into the access model.

const express = require('express');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

// requireAdmin means "holds at least one admin permission", so anyone who can
// open the console can read back what they may do in it.
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

// Kept at its old path so the logout button needs no change. Same session as
// the student app, so this logs the person out of both.
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
