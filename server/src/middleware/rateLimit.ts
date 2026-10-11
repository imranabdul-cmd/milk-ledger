import rateLimit from 'express-rate-limit';

const isTestEnv = (): boolean => process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST);

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 login attempts per IP per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  skip: isTestEnv,
  message: {
    error: 'Too many login attempts. Please try again after 15 minutes.'
  }
});

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 300, // 300 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  skip: isTestEnv,
  message: {
    error: 'Too many requests. Please slow down.'
  }
});
