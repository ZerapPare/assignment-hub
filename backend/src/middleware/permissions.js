const { hasPermission } = require('../rbac/permissions');

// Must run after requireAdmin, which puts req.permissions in place. The denial
// carries a `code`, which is how the client tells it from "not an admin".
function requirePermission(code) {
  // Hung off the function so adminRoutes.test.js can see which one it asks for.
  permissionGuard.permissionCode = code;

  function permissionGuard(req, res, next) {
    if (!(req.permissions instanceof Set)) {
      // Wired without requireAdmin: our bug, so a 500 rather than a 403.
      return next(new Error(`requirePermission('${code}') used without requireAdmin`));
    }

    if (!hasPermission(req.permissions, code)) {
      return res.status(403).json({
        error: 'permission denied',
        code: 'PERMISSION_DENIED',
        required_permission: code,
        request_id: req.requestId,
      });
    }

    return next();
  }

  return permissionGuard;
}

module.exports = { requirePermission };
