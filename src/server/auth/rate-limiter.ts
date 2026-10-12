import { Request, Response, NextFunction } from 'express';

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

export class MemoryRateLimiter {
  private store: Map<string, RateLimitRecord> = new Map();

  constructor(
    private windowMs: number,
    private maxRequests: number,
    private message = 'Too many requests, please try again later.'
  ) {
    // Cleanup expired entries periodically
    setInterval(() => {
      const now = Date.now();
      for (const [key, record] of this.store.entries()) {
        if (now > record.resetTime) {
          this.store.delete(key);
        }
      }
    }, 60000);
  }

  middleware(keyPrefix: string) {
    return (req: Request, res: Response, next: NextFunction): void => {
      const ip = req.ip || req.socket.remoteAddress || 'unknown-ip';
      const key = `${keyPrefix}:${ip}`;
      const now = Date.now();

      let record = this.store.get(key);
      if (!record || now > record.resetTime) {
        record = { count: 1, resetTime: now + this.windowMs };
        this.store.set(key, record);
        next();
        return;
      }

      record.count += 1;
      if (record.count > this.maxRequests) {
        const retryAfterSeconds = Math.ceil((record.resetTime - now) / 1000);
        res.setHeader('Retry-After', retryAfterSeconds);
        res.status(429).json({
          error: this.message,
          retryAfter: retryAfterSeconds,
        });
        return;
      }

      next();
    };
  }

  reset(keyPrefix: string, ip: string) {
    this.store.delete(`${keyPrefix}:${ip}`);
  }
}

// Pre-configured rate limiters
export const loginRateLimiter = new MemoryRateLimiter(
  15 * 60 * 1000, // 15 minutes
  10, // max 10 attempts
  'Too many login attempts. Please wait 15 minutes before trying again.'
);

export const signupRateLimiter = new MemoryRateLimiter(
  60 * 60 * 1000, // 1 hour
  10, // max 10 signups per IP per hour
  'Too many registration attempts. Please try again later.'
);

export const passwordResetRateLimiter = new MemoryRateLimiter(
  30 * 60 * 1000, // 30 minutes
  5, // max 5 password reset requests per 30 mins
  'Too many password reset requests. Please wait 30 minutes.'
);
