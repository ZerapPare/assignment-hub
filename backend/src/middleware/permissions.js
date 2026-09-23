const { hasPermission } = require('../rbac/permissions');

// Must run after requireAdmin, which is what puts req.permissions in place.
//
// The denial carries a `code`; requireAdmin's plain 'admin only' does not. That
// difference is how the client tells "not an admin, go log in" apart from
// "an admin, but this section is not yours".
function requirePermission(code) {
  // Hung off the function so test/adminRoutes.test.js can walk the router stack
  // and check *which* permission each endpoint asks for, not just that a guard
  // is present.
  permissionGuard.permissionCode = code;

  function permissionGuard(req, res, next) {
    if (!(req.permissions instanceof Set)) {
      // The route was wired without requireAdmin in front — our bug, not the
      // caller's. Surface it as a 500 rather than hide it behind a 403.
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
