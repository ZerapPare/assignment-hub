const { requireAdmin } = require('./auth');
const { requirePermission } = require('./permissions');

module.exports = { requireAdmin, requirePermission };
