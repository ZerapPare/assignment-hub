const { hasPermission } = require('../rbac/permissions');

// Must run after requireAdmin, which is what puts req.permissions in place.
//
// The denial body carries a `code` field; the plain 'admin only' rejection from
// requireAdmin deliberately does not. That difference is the whole contract the
// client uses to tell "you are not an admin, go log in" apart from "you are an
// admin but this section is not yours".
function requirePermission(code) {
  // The code is hung off the returned function so test/adminRoutes.test.js can
  // walk the router stack and check which permission each endpoint asks for,
  // not merely that some guard is present.
  permissionGuard.permissionCode = code;

  function permissionGuard(req, res, next) {
    if (!(req.permissions instanceof Set)) {
      // Reaching here means the route was wired without requireAdmin in front.
      // That is a bug in our own middleware chain, not something the caller did,
      // so surface it as a 500 through the error handler rather than quietly
      // answering 403 and hiding the misconfiguration.
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
