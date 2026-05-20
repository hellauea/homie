import rateLimit from 'express-rate-limit';

// 5 OTP verify attempts per phone per hour
// Keyed by IP + body.phone to prevent abuse across IPs
export const otpRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  keyGenerator: (req) => {
    const phone = (req.body as { phone?: string })?.phone ?? req.ip ?? 'unknown';
    return `otp:${phone}`;
  },
  message: {
    error: 'rate_limited',
    message: 'Too many attempts. Try again in an hour.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// General API rate limit — 200 requests per minute per IP
export const apiRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  message: {
    error: 'rate_limited',
    message: 'Too many requests. Slow down.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
