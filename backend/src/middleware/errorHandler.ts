import type { ErrorRequestHandler } from 'express';

interface CustomHttpError extends Error {
  statusCode?: number;
  status?: number;
  code?: string;
  body?: unknown;
}

/**
 * Dedicated error class for CORS origin rejections originating from the application's CORS callback.
 * Using a dedicated class ensures that origin rejections are recognized explicitly and unambiguously,
 * preventing arbitrary internal errors mentioning "CORS" (e.g. database errors or internal logs)
 * from being mistakenly classified as a 403 CORS rejection.
 */
export class CorsOriginError extends Error {
  public readonly isCorsOriginError = true;

  constructor(message = 'Origin not allowed by CORS') {
    super(message);
    this.name = 'CorsOriginError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Trusted client-facing operational error.
 * Only legitimate instances of this class (and explicitly recognized framework errors like
 * CorsOriginError and malformed body JSON parse) are permitted to emit 4xx HTTP responses
 * with public functional messages.
 *
 * POLICY ON PUBLIC MESSAGES & FUTURE VALIDATION (e.g. Zod):
 * 1. AppClientError preserves its provided message as the public response payload.
 * 2. Controllers and domain handlers are strictly responsible for constructing deliberate,
 *    sanitized, and user-appropriate messages when instantiating AppClientError.
 * 3. Validation libraries (e.g. Zod) produce raw issues that may contain internal schema paths,
 *    untrusted user input values, or internal database field names. Controllers and validation
 *    middlewares MUST NOT blindly forward `zodError.message` or raw issue objects into AppClientError.
 *    Instead, validation errors must be mapped intentionally to curated public messages.
 * 4. Uncaught ZodErrors or other unexpected errors that escape controller handling will deliberately
 *    fall through to the 500 Internal Server Error handler, preventing accidental data leakage.
 */
export class AppClientError extends Error {
  public readonly statusCode: number;
  public readonly isAppClientError = true;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'AppClientError';

    // Validate that statusCode is strictly an integer within the 400-499 range (inclusive).
    // Any invalid value (float, NaN, Infinity, string, out-of-range, undefined) is safely normalized to 400.
    if (Number.isInteger(statusCode) && statusCode >= 400 && statusCode <= 499) {
      this.statusCode = statusCode;
    } else {
      this.statusCode = 400;
    }

    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Redacts connection strings and credentials from error messages for server-side logging.
 */
function sanitizeForLog(message: string): string {
  return message.replace(/postgres(?:ql)?:\/\/[^\s]+/gi, '[REDACTED_URL]');
}

export function createErrorHandler(_isProduction?: boolean): ErrorRequestHandler {
  return (err: unknown, _req, res, _next) => {
    const error = err as CustomHttpError;

    // 1. Handle CORS origin rejections explicitly
    // Recognized strictly via CorsOriginError instance, avoiding arbitrary text matching on error.message
    const isCorsRejection =
      error instanceof CorsOriginError ||
      (error instanceof Error && error.name === 'CorsOriginError' && (error as CorsOriginError).isCorsOriginError === true);

    if (isCorsRejection) {
      // Maintain 403 status with static public message, suppressing rejected origin and raw error details
      res.status(403).json({
        error: {
          message: 'Access denied by CORS policy',
        },
      });
      return;
    }

    // 2. Handle malformed JSON body errors from express.json() (Recognized Client Error 400)
    if (error instanceof SyntaxError && 'body' in error && (error.statusCode === 400 || error.status === 400)) {
      res.status(400).json({
        error: {
          message: 'Malformed JSON payload in request body',
        },
      });
      return;
    }

    // 3. Explicitly trusted application client errors (Recognized 4xx)
    // Only genuine instances of AppClientError are accepted.
    // Plain duck-typed objects or arbitrary errors spoofing 'isAppClientError' or 'name' are strictly rejected.
    const isExplicitClientError =
      error instanceof AppClientError && error.isAppClientError === true;

    if (isExplicitClientError) {
      const clientStatusCode =
        Number.isInteger(error.statusCode) && error.statusCode >= 400 && error.statusCode <= 499
          ? error.statusCode
          : 400;

      res.status(clientStatusCode).json({
        error: {
          message: error.message || 'Bad Request',
        },
      });
      return;
    }

    // 4. Unexpected internal errors, PostgreSQL driver errors, third-party library errors,
    // spoofed client error objects, or unverified errors (Treated strictly as 500)
    const logMessage =
      error && typeof error === 'object' && 'message' in error && typeof error.message === 'string'
        ? sanitizeForLog(error.message)
        : 'Unknown internal error';
    console.error(`[Server Error] ${logMessage}`);

    // Strictly NEVER leak error.stack, SQL queries, database messages, credentials, or internal details
    res.status(500).json({
      error: {
        message: 'Internal server error',
      },
    });
  };
}
