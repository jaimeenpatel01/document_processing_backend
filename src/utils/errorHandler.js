// ============================================================
// Centralized Error Handling Middleware
// ============================================================

const logger = require('./logger');

/**
 * Custom application error with HTTP status code.
 */
class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * 404 Not Found handler – catches unmatched routes.
 */
function notFoundHandler(req, _res, next) {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404));
}

/**
 * Global error handler – returns consistent JSON error responses.
 */
function errorHandler(err, _req, res, _next) {
  const statusCode = err.statusCode || 500;
  const message = err.isOperational ? err.message : 'Internal Server Error';

  // Log full stack for unexpected errors
  if (!err.isOperational) {
    logger.error('Unexpected error:', err);
  } else {
    logger.warn(`Operational error [${statusCode}]: ${err.message}`);
  }

  res.status(statusCode).json({
    success: false,
    error: {
      message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    },
  });
}

module.exports = { AppError, notFoundHandler, errorHandler };
