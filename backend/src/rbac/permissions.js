// Single source of truth for permission codes.
//
// Guards reference these constants, not bare strings, so a typo crashes at
// require-time instead of leaving an endpoint silently unreachable. Must stay
// in step with the Permission seed rows in init.sql and migrations/012_rbac.sql
// — test/rbacSchema.test.js asserts it.

const PERMISSIONS = {
  // Admin console
  DASHBOARD_VIEW: 'dashboard.view',
  USER_READ: 'user.read',
  USER_SUSPEND: 'user.suspend',
  ERROR_LOG_READ: 'error_log.read',
  SYSTEM_HEALTH_READ: 'system.health.read',
  BUSINESS_ANALYTICS_READ: 'business.analytics.read',
  AUDIT_LOG_READ: 'audit_log.read',

  // Student scope — modelled and granted, not yet enforced. requireAuth already
  // guards these endpoints, so checking here would only risk locking out a
  // student whose User_Role row went missing.
  ASSIGNMENT_MANAGE: 'assignment.manage',
  SCHEDULE_MANAGE: 'schedule.manage',
  NOTIFICATION_MANAGE: 'notification.manage',
  PROFILE_MANAGE: 'profile.manage',
};

const ALL_PERMISSION_CODES = Object.freeze(Object.values(PERMISSIONS));

// Holding any one of these is what makes the admin console relevant. There is
// no "is an administrator" flag — being one means holding these permissions.
const ADMIN_PERMISSION_CODES = Object.freeze([
  PERMISSIONS.DASHBOARD_VIEW,
  PERMISSIONS.USER_READ,
  PERMISSIONS.USER_SUSPEND,
  PERMISSIONS.ERROR_LOG_READ,
  PERMISSIONS.SYSTEM_HEALTH_READ,
  PERMISSIONS.BUSINESS_ANALYTICS_READ,
  PERMISSIONS.AUDIT_LOG_READ,
]);

// Two roles, and a user holds exactly one. An administrator is not also a
// student — see docs/roles.md.
const ROLES = {
  ADMIN: 'admin',
  STUDENT: 'student',
};

const ALL_ROLE_CODES = Object.freeze(Object.values(ROLES));

// Takes the Set requireAdmin builds or a plain array, so callers holding only
// the /api/admin/me payload can use the same helper.
function hasPermission(permissions, code) {
  if (permissions instanceof Set) return permissions.has(code);
  if (Array.isArray(permissions)) return permissions.includes(code);
  return false;
}

module.exports = {
  PERMISSIONS,
  ALL_PERMISSION_CODES,
  ADMIN_PERMISSION_CODES,
  ROLES,
  ALL_ROLE_CODES,
  hasPermission,
};
