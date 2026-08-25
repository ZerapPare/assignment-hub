const pool = require('../db');

const EVENT_DEFINITIONS = Object.freeze({
  'auth.login_success': { feature: 'authentication', client: false },
  'integration.google_connected': { feature: 'integrations', client: false },
  'integration.microsoft_connected': { feature: 'integrations', client: false },
  'classroom.sync_requested': { feature: 'classroom_sync', client: false },
  'classroom.sync_success': { feature: 'classroom_sync', client: false },
  'classroom.sync_failed': { feature: 'classroom_sync', client: false },
  'assignment.manual_created': { feature: 'manual_task', client: false },
  'assignment.manual_updated': { feature: 'manual_task', client: false },
  'assignment.manual_deleted': { feature: 'manual_task', client: false },
  'assignment.status_changed': { feature: 'task_status', client: false },
  'assignment.search_used': { feature: 'search_filter', client: true },
  'assignment.filter_used': { feature: 'search_filter', client: true },
  'dashboard.viewed': { feature: 'dashboard', client: true },
  'notification.settings_updated': { feature: 'notification_settings', client: false },
});

const CLIENT_EVENTS = new Set(
  Object.entries(EVENT_DEFINITIONS)
    .filter(([, definition]) => definition.client)
    .map(([name]) => name)
);
const EVENT_RESULTS = new Set(['success', 'failure', null]);
const TASK_TYPES = new Set(['homework', 'project', 'quiz', 'exam', 'reading', 'other']);
const TASK_STATUSES = new Set(['not_started', 'in_progress', 'submitted', 'completed']);
const FILTER_TYPES = new Set(['platform', 'status']);
const FILTER_VALUES = {
  platform: new Set(['all', 'classroom', 'teams', 'manual']),
  status: new Set(['all', ...TASK_STATUSES]),
};
const PROVIDERS = new Set(['google', 'microsoft']);
const MAX_METADATA_KEYS = 8;
const MAX_METADATA_BYTES = 2000;

class AnalyticsValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AnalyticsValidationError';
    this.statusCode = 400;
  }
}

function definitionFor(eventName) {
  const definition = EVENT_DEFINITIONS[eventName];
  if (!definition) throw new AnalyticsValidationError('unsupported analytics event');
  return definition;
}

function positiveInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new AnalyticsValidationError(`${label} must be a non-negative integer`);
  }
  return value;
}

function stringValue(value, label, maxLength = 80) {
  if (typeof value !== 'string' || value.length === 0 || value.length > maxLength) {
    throw new AnalyticsValidationError(`${label} is invalid`);
  }
  return value;
}

function assertKnownKeys(metadata, allowedKeys) {
  const keys = Object.keys(metadata);
  if (keys.length > MAX_METADATA_KEYS || keys.some((key) => !allowedKeys.has(key))) {
    throw new AnalyticsValidationError('analytics metadata contains unsupported keys');
  }
}

function normalizeMetadata(eventName, metadata) {
  if (metadata === null || metadata === undefined) return null;
  if (!metadata || Array.isArray(metadata) || typeof metadata !== 'object') {
    throw new AnalyticsValidationError('analytics metadata must be an object');
  }

  let normalized;
  switch (eventName) {
    case 'classroom.sync_requested':
    case 'classroom.sync_success':
    case 'classroom.sync_failed': {
      assertKnownKeys(metadata, new Set(['provider', 'imported_count', 'updated_count', 'skipped_count']));
      normalized = {};
      if (metadata.provider !== undefined) {
        const provider = stringValue(metadata.provider, 'provider', 20).toLowerCase();
        if (!PROVIDERS.has(provider)) throw new AnalyticsValidationError('provider is invalid');
        normalized.provider = provider;
      }
      for (const key of ['imported_count', 'updated_count', 'skipped_count']) {
        if (metadata[key] !== undefined) normalized[key] = positiveInteger(metadata[key], key);
      }
      break;
    }
    case 'integration.google_connected':
    case 'integration.microsoft_connected': {
      assertKnownKeys(metadata, new Set(['provider']));
      normalized = {};
      if (metadata.provider !== undefined) {
        const provider = stringValue(metadata.provider, 'provider', 20).toLowerCase();
        if (!PROVIDERS.has(provider)) throw new AnalyticsValidationError('provider is invalid');
        normalized.provider = provider;
      }
      break;
    }
    case 'assignment.manual_created':
    case 'assignment.manual_updated': {
      assertKnownKeys(metadata, new Set(['task_type']));
      normalized = {};
      if (metadata.task_type !== undefined) {
        const taskType = stringValue(metadata.task_type, 'task_type', 20);
        if (!TASK_TYPES.has(taskType)) throw new AnalyticsValidationError('task_type is invalid');
        normalized.task_type = taskType;
      }
      break;
    }
    case 'assignment.status_changed': {
      assertKnownKeys(metadata, new Set(['from', 'to']));
      normalized = {};
      for (const key of ['from', 'to']) {
        if (metadata[key] !== undefined) {
          const status = stringValue(metadata[key], key, 20);
          if (!TASK_STATUSES.has(status)) throw new AnalyticsValidationError(`${key} is invalid`);
          normalized[key] = status;
        }
      }
      break;
    }
    case 'assignment.search_used':
      assertKnownKeys(metadata, new Set(['has_query']));
      normalized = {};
      if (metadata.has_query !== undefined && typeof metadata.has_query !== 'boolean') {
        throw new AnalyticsValidationError('has_query is invalid');
      }
      if (metadata.has_query !== undefined) normalized.has_query = metadata.has_query;
      break;
    case 'assignment.filter_used': {
      assertKnownKeys(metadata, new Set(['filter_type', 'filter_value']));
      normalized = {};
      if (metadata.filter_type === undefined) {
        throw new AnalyticsValidationError('filter_type is required');
      }
      const filterType = stringValue(metadata.filter_type, 'filter_type', 20);
      if (!FILTER_TYPES.has(filterType)) throw new AnalyticsValidationError('filter_type is invalid');
      normalized.filter_type = filterType;
      if (metadata.filter_value !== undefined) {
        const filterValue = stringValue(metadata.filter_value, 'filter_value', 40);
        if (!FILTER_VALUES[filterType].has(filterValue)) {
          throw new AnalyticsValidationError('filter_value is invalid');
        }
        normalized.filter_value = filterValue;
      }
      break;
    }
    case 'notification.settings_updated':
      assertKnownKeys(metadata, new Set(['enabled', 'daily_repeat', 'lead_time_count']));
      normalized = {};
      if (metadata.enabled !== undefined && typeof metadata.enabled !== 'boolean') {
        throw new AnalyticsValidationError('enabled is invalid');
      }
      if (metadata.daily_repeat !== undefined && typeof metadata.daily_repeat !== 'boolean') {
        throw new AnalyticsValidationError('daily_repeat is invalid');
      }
      if (metadata.enabled !== undefined) normalized.enabled = metadata.enabled;
      if (metadata.daily_repeat !== undefined) normalized.daily_repeat = metadata.daily_repeat;
      if (metadata.lead_time_count !== undefined) {
        normalized.lead_time_count = positiveInteger(metadata.lead_time_count, 'lead_time_count');
      }
      break;
    case 'dashboard.viewed':
    case 'auth.login_success':
      assertKnownKeys(metadata, new Set());
      normalized = {};
      break;
    default:
      normalized = {};
  }

  if (!Object.keys(normalized).length) return null;
  if (Buffer.byteLength(JSON.stringify(normalized), 'utf8') > MAX_METADATA_BYTES) {
    throw new AnalyticsValidationError('analytics metadata is too large');
  }
  return normalized;
}

function validateEventPayload({ eventName, metadata = null, result = null }) {
  definitionFor(eventName);
  if (!EVENT_RESULTS.has(result)) {
    throw new AnalyticsValidationError('event result is invalid');
  }
  return normalizeMetadata(eventName, metadata);
}

async function trackEvent({ userId, eventName, featureName, result = null, metadata = null }) {
  if (!Number.isSafeInteger(Number(userId)) || Number(userId) <= 0) {
    throw new AnalyticsValidationError('user id is invalid');
  }
  const definition = definitionFor(eventName);
  const normalizedMetadata = validateEventPayload({ eventName, metadata, result });
  if (featureName !== undefined && featureName !== definition.feature) {
    throw new AnalyticsValidationError('feature name does not match event');
  }

  await pool.query(
    `INSERT INTO Product_Event
       (user_id, event_name, feature_name, event_result, metadata)
     VALUES (?, ?, ?, ?, ?)`,
    [Number(userId), eventName, definition.feature, result, normalizedMetadata ? JSON.stringify(normalizedMetadata) : null]
  );
}

async function safeTrackEvent(args) {
  try {
    await trackEvent(args);
    return true;
  } catch (err) {
    // Analytics is deliberately best effort. A failed event insert must never
    // turn a successful user operation into an error response.
    console.warn('[analytics] failed:', err.message);
    return false;
  }
}

module.exports = {
  ANALYTICS_EVENTS: EVENT_DEFINITIONS,
  CLIENT_EVENTS,
  AnalyticsValidationError,
  normalizeMetadata,
  safeTrackEvent,
  trackEvent,
  validateEventPayload,
};
