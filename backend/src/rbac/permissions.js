// Single source of truth for permission codes. Guards use these constants, not
// strings, so a typo crashes at require-time. Must match the Permission seeds
// in init.sql and migrations/012_rbac.sql — rbacSchema.test.js asserts it.

const PERMISSIONS = {
  // Admin console
  DASHBOARD_VIEW: 'dashboard.view',
  USER_READ: 'user.read',
  USER_SUSPEND: 'user.suspend',
  ERROR_LOG_READ: 'error_log.read',
  SYSTEM_HEALTH_READ: 'system.health.read',
  BUSINESS_ANALYTICS_READ: 'business.analytics.read',
  AUDIT_LOG_READ: 'audit_log.read',

  // Student scope — granted but not enforced; requireAuth already guards these.
  ASSIGNMENT_MANAGE: 'assignment.manage',
  SCHEDULE_MANAGE: 'schedule.manage',
  NOTIFICATION_MANAGE: 'notification.manage',
  PROFILE_MANAGE: 'profile.manage',
};

const ALL_PERMISSION_CODES = Object.freeze(Object.values(PERMISSIONS));

// There is no "is an administrator" flag: being one means holding one of these.
const ADMIN_PERMISSION_CODES = Object.freeze([
  PERMISSIONS.DASHBOARD_VIEW,
  PERMISSIONS.USER_READ,
  PERMISSIONS.USER_SUSPEND,
  PERMISSIONS.ERROR_LOG_READ,
  PERMISSIONS.SYSTEM_HEALTH_READ,
  PERMISSIONS.BUSINESS_ANALYTICS_READ,
  PERMISSIONS.AUDIT_LOG_READ,
]);

// Two roles, and a user holds exactly one. An administrator is not a student.
const ROLES = {
  ADMIN: 'admin',
  STUDENT: 'student',
};

const ALL_ROLE_CODES = Object.freeze(Object.values(ROLES));

// Takes requireAdmin's Set or a plain array, so /api/admin/me callers fit too.
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
