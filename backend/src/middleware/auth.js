// Blocks a route unless there is a logged-in session.
function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'not authenticated' });
  }
  next();
}

module.exports = { requireAuth };
