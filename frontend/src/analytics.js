const CLIENT_EVENT_NAMES = new Set([
  'dashboard.viewed',
  'assignment.search_used',
  'assignment.filter_used',
]);

export async function trackClientEvent(eventName, metadata) {
  if (!CLIENT_EVENT_NAMES.has(eventName)) return false;

  try {
    const response = await fetch('/api/analytics/events', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_name: eventName,
        ...(metadata ? { metadata } : {}),
      }),
      keepalive: true,
    });
    return response.ok;
  } catch (_error) {
    // Analytics is best effort and should never interrupt the student UI.
    return false;
  }
}
