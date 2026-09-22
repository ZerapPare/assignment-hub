// Single source of truth for permission codes.
//
// Route guards reference these constants rather than bare strings so a typo is a
// crash at require-time instead of a silently unreachable endpoint. The codes
// must stay in step with the Permission seed rows in init.sql and
// migrations/012_rbac.sql — test/rbacSchema.test.js asserts that they do.

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
  // guards every student endpoint, so adding a permission check there today
  // would only risk locking out a student whose User_Role row went missing.
  ASSIGNMENT_MANAGE: 'assignment.manage',
  SCHEDULE_MANAGE: 'schedule.manage',
  NOTIFICATION_MANAGE: 'notification.manage',
  PROFILE_MANAGE: 'profile.manage',
};

const ALL_PERMISSION_CODES = Object.freeze(Object.values(PERMISSIONS));

// Holding any one of these is what makes the admin console relevant to an
// account. There is no separate "is an administrator" flag any more — being an
// administrator just means holding administrative permissions.
const ADMIN_PERMISSION_CODES = Object.freeze([
  PERMISSIONS.DASHBOARD_VIEW,
  PERMISSIONS.USER_READ,
  PERMISSIONS.USER_SUSPEND,
  PERMISSIONS.ERROR_LOG_READ,
  PERMISSIONS.SYSTEM_HEALTH_READ,
  PERMISSIONS.BUSINESS_ANALYTICS_READ,
  PERMISSIONS.AUDIT_LOG_READ,
]);

const ROLES = {
  SUPER_ADMIN: 'super_admin',
  SUPPORT_ADMIN: 'support_admin',
  ANALYTICS_VIEWER: 'analytics_viewer',
  STUDENT: 'student',
};

const ALL_ROLE_CODES = Object.freeze(Object.values(ROLES));

// Accepts the Set built by requireAdmin as well as a plain array, so callers
// that only have the /api/admin/me payload can use the same helper.
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
