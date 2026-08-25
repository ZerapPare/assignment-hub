const express = require('express');
const { requireAdmin } = require('../middleware/adminAuth');
const {
  TREND_FEATURES,
  getFeatureRanking,
  getFeatureTrend,
  getIntegrations,
  getOverview,
  getSourceMix,
  normalizeRange,
} = require('../services/businessMetrics');

const router = express.Router();

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function rangeFromRequest(req, res) {
  const days = normalizeRange(req.query.range);
  if (!days) {
    res.status(400).json({ error: 'range must be 7d, 30d, or 90d', request_id: req.requestId });
    return null;
  }
  return days;
}

router.use('/api/admin/business', requireAdmin);

router.get('/api/admin/business/overview', asyncRoute(async (req, res) => {
  const days = rangeFromRequest(req, res);
  if (!days) return;
  res.json(await getOverview(days));
}));

router.get('/api/admin/business/features', asyncRoute(async (req, res) => {
  const days = rangeFromRequest(req, res);
  if (!days) return;
  res.json(await getFeatureRanking(days));
}));

router.get('/api/admin/business/features/:feature/trend', asyncRoute(async (req, res) => {
  const days = rangeFromRequest(req, res);
  if (!days) return;
  const feature = String(req.params.feature || '');
  if (!TREND_FEATURES.includes(feature)) {
    return res.status(400).json({ error: 'unknown feature', request_id: req.requestId });
  }
  const points = await getFeatureTrend(feature, days);
  res.json({
    feature,
    range_days: days,
    granularity: days <= 30 ? 'day' : 'week',
    points,
    // Keep the descriptive alias for clients written against the first draft.
    trend: points,
  });
}));

router.get('/api/admin/business/integrations', asyncRoute(async (req, res) => {
  const days = rangeFromRequest(req, res);
  if (!days) return;
  res.json(await getIntegrations(days));
}));

router.get(['/api/admin/business/assignment-sources', '/api/admin/business/sources'], asyncRoute(async (req, res) => {
  const days = rangeFromRequest(req, res);
  if (!days) return;
  res.json({ range_days: days, sources: await getSourceMix() });
}));

module.exports = router;
