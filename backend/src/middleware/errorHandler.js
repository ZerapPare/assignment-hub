const { logError } = require('../services/errorLogger');

function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  const requestedStatus = Number(err?.statusCode || err?.status);
  const statusCode = requestedStatus >= 400 && requestedStatus < 600 ? requestedStatus : 500;
  const isServerError = statusCode >= 500;

  if (isServerError) {
    console.error(`[${req.requestId || 'no-request-id'}] server error`, err?.code || err?.name || 'unknown');
    void logError(err, req, { statusCode, source: err?.source });
  }

  const message = !isServerError && err?.expose && err.message
    ? err.message
    : (isServerError ? 'Internal server error' : 'Request failed');
  res.status(statusCode).json({ error: message, request_id: req.requestId });
}

module.exports = { errorHandler };
