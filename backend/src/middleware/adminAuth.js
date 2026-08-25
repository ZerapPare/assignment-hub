const { requireAuth } = require('./auth');

function requireAdmin(req, res, next) {
  requireAuth(req, res, (err) => {
    if (err) return next(err);
    if (req.account?.role !== 'admin') {
      return res.status(403).json({ error: 'forbidden', request_id: req.requestId });
    }
    next();
  });
}

module.exports = { requireAdmin };
