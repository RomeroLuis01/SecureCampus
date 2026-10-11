import type { ErrorRequestHandler } from 'express';

interface CustomHttpError extends Error {
  statusCode?: number;
  status?: number;
}

export function createErrorHandler(isProduction: boolean): ErrorRequestHandler {
  return (err: unknown, _req, res, _next) => {
    const error = err as CustomHttpError;
    const statusCode = error.statusCode || error.status || 500;

    // Handle CORS errors specifically
    if (error.message && error.message.includes('CORS')) {
      res.status(403).json({
        error: {
          message: 'Access denied by CORS policy',
        },
      });
      return;
    }

    // Handle malformed JSON body errors from express.json()
    if (error instanceof SyntaxError && 'body' in error && statusCode === 400) {
      res.status(400).json({
        error: {
          message: 'Malformed JSON payload in request body',
        },
      });
      return;
    }

    const isClientError = statusCode >= 400 && statusCode < 500;
    const message = isProduction && !isClientError
      ? 'Internal server error'
      : (error.message || 'An unexpected error occurred');

    res.status(statusCode).json({
      error: {
        message,
        ...(isProduction ? {} : { stack: error.stack }),
      },
    });
  };
}
