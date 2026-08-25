const express = require('express');
const { requireAuth } = require('../middleware/auth');
const {
  AnalyticsValidationError,
  CLIENT_EVENTS,
  trackEvent,
  validateEventPayload,
} = require('../services/analytics');

const router = express.Router();

router.post('/api/analytics/events', requireAuth, async (req, res) => {
  const bodyKeys = Object.keys(req.body || {});
  if (bodyKeys.some((key) => key !== 'event_name' && key !== 'metadata')) {
    return res.status(400).json({ error: 'unexpected analytics fields', request_id: req.requestId });
  }
  const eventName = req.body?.event_name;
  if (typeof eventName !== 'string' || !CLIENT_EVENTS.has(eventName)) {
    return res.status(400).json({ error: 'unsupported analytics event', request_id: req.requestId });
  }

  try {
    validateEventPayload({ eventName, metadata: req.body?.metadata ?? null });
  } catch (err) {
    if (err instanceof AnalyticsValidationError) {
      return res.status(400).json({ error: err.message, request_id: req.requestId });
    }
    return res.status(400).json({ error: 'invalid analytics payload', request_id: req.requestId });
  }

  try {
    await trackEvent({
      userId: req.session.userId,
      eventName,
      metadata: req.body?.metadata ?? null,
    });
  } catch (err) {
    // The browser sends this endpoint as a best-effort signal. A database
    // outage must not turn a harmless client event into a product failure.
    if (!(err instanceof AnalyticsValidationError)) {
      console.warn('[analytics] client event write failed:', err.message);
      return res.status(202).json({ ok: false });
    }
    return res.status(400).json({ error: err.message, request_id: req.requestId });
  }

  return res.status(201).json({ ok: true });
});

module.exports = router;
