import { rateLimit } from 'express-rate-limit';

/**
 * Dedicated rate limiter for the authentication login endpoint.
 * Restricts requests strictly per IP address to mitigate volumetric brute force
 * and credential stuffing attacks before hitting the database.
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes window
  limit: 30, // Maximum 30 attempts per IP per window
  standardHeaders: 'draft-7', // Returns RateLimit-* headers
  legacyHeaders: false,
  message: {
    error: {
      message: 'Demasiadas solicitudes. Por favor intente nuevamente en 15 minutos.',
    },
  },
  validate: {
    xForwardedForHeader: false,
  },
});
