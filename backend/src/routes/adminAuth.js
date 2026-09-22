// What is left of the separate administrator login.
//
// There used to be a second OAuth flow here — its own state cookie, its own
// Google and Microsoft callbacks, its own allowlist lookup — because `Admin`
// and `Student` were different tables and an administrator simply had no row
// the ordinary login could find. Since migration 013 there is one user table,
// and since 012 the roles on that row decide everything, so administrators sign
// in through /login like everyone else.
//
// Nobody becomes an administrator by logging in: signing in creates an ordinary
// account, and it takes a User_Role grant to make the console reachable. That
// is the same guarantee the old allowlist gave, expressed in the access model
// rather than in a second login page.

const express = require('express');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

// requireAdmin means "holds at least one administrative permission", so an
// account that can open the console can always read back what it may do in it.
router.get('/api/admin/me', requireAdmin, (req, res) => {
  res.json({
    user_id: Number(req.account.user_id),
    // admin_id is kept as an alias of user_id so the console keeps working
    // while the two ids are still the same thing to it.
    admin_id: Number(req.account.user_id),
    email: req.account.email,
    display_name: req.account.full_name || null,
    roles: req.account.roles,
    permissions: req.account.permissions,
  });
});

// Kept at its old path so the console's logout button needs no change. It is
// now the same session as the student app, so this logs the person out of both.
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
