import { Request, Response, NextFunction } from 'express';
import { DataStore, StoredUser, StoredSession } from './store';
import { UserRole } from '../types/workflow';

declare global {
  namespace Express {
    interface Request {
      user?: StoredUser;
      session?: StoredSession;
    }
  }
}

/**
 * Extracts and validates session from HttpOnly cookie or Authorization header.
 * Populates req.user and req.session if valid.
 */
export function sessionMiddleware(store: DataStore) {
  return (req: Request, _res: Response, next: NextFunction) => {
    let token: string | undefined;

    // 1. Try secure HttpOnly cookie
    if (req.cookies && req.cookies.flowforge_session) {
      token = req.cookies.flowforge_session;
    }

    // 2. Fallback to Authorization: Bearer <token>
    if (!token && req.headers.authorization) {
      const parts = req.headers.authorization.split(' ');
      if (parts.length === 2 && (parts[0] === 'Bearer' || parts[0] === 'Token')) {
        token = parts[1];
      }
    }

    // 3. Fallback to query param token for SSE EventSource connections
    if (!token && typeof req.query?.token === 'string') {
      token = req.query.token;
    }

    if (!token) {
      return next();
    }

    const sessionData = store.findSessionByToken(token);
    if (sessionData) {
      req.session = sessionData.session;
      req.user = sessionData.user;
    }

    next();
  };
}

/**
 * Middleware: Requires an active authenticated session.
 * Rejects unauthenticated requests with 401 Unauthorized.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user || !req.session) {
    return res.status(401).json({
      error: 'Authentication required. Please log in to continue.',
      code: 'UNAUTHENTICATED',
    });
  }
  next();
}

/**
 * Middleware: Enforces workspace membership and role authorization.
 * Prevents Insecure Direct Object References (IDOR) and cross-workspace access.
 */
export function requireWorkspaceRole(
  store: DataStore,
  allowedRoles: UserRole[] = ['OWNER', 'ADMIN', 'EDITOR', 'VIEWER']
) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required.',
        code: 'UNAUTHENTICATED',
      });
    }

    // Resolve workspace ID from param, query, or body
    const workspaceId =
      req.params.workspaceId ||
      (req.query.workspaceId as string) ||
      req.body?.workspaceId ||
      'ws_default';

    const membership = store.getWorkspaceMembership(workspaceId, req.user.id);
    if (!membership) {
      return res.status(403).json({
        error: 'Access denied: You are not a member of this workspace.',
        code: 'WORKSPACE_FORBIDDEN',
      });
    }

    if (!allowedRoles.includes(membership.role)) {
      return res.status(403).json({
        error: `Access denied: Action requires one of the following roles: [${allowedRoles.join(', ')}]. Your role is ${membership.role}.`,
        code: 'INSUFFICIENT_ROLE',
      });
    }

    next();
  };
}

/**
 * In-memory sliding-window rate limiter for sensitive endpoints
 */
interface RateLimitRecord {
  timestamps: number[];
}

export function createRateLimiter(options: {
  windowMs: number;
  max: number;
  message?: string;
}) {
  const hits = new Map<string, RateLimitRecord>();

  // Cleanup every 5 minutes
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of hits.entries()) {
      record.timestamps = record.timestamps.filter((t) => now - t < options.windowMs);
      if (record.timestamps.length === 0) {
        hits.delete(key);
      }
    }
  }, 5 * 60 * 1000).unref?.();

  return (req: Request, res: Response, next: NextFunction) => {
    // Determine client identifier: IP or normalized email from body
    const ip =
      req.ip ||
      (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
      req.socket.remoteAddress ||
      'unknown-ip';

    const email = req.body?.email ? String(req.body.email).toLowerCase().trim() : '';
    const key = email ? `${ip}:${email}` : ip;

    const now = Date.now();
    let record = hits.get(key);

    if (!record) {
      record = { timestamps: [] };
      hits.set(key, record);
    }

    // Filter out expired timestamps
    record.timestamps = record.timestamps.filter((t) => now - t < options.windowMs);

    if (record.timestamps.length >= options.max) {
      const oldest = record.timestamps[0];
      const retryAfterSeconds = Math.ceil((oldest + options.windowMs - now) / 1000);
      res.setHeader('Retry-After', String(retryAfterSeconds));
      return res.status(429).json({
        error:
          options.message ||
          `Too many requests. Please try again in ${retryAfterSeconds} seconds.`,
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: retryAfterSeconds,
      });
    }

    record.timestamps.push(now);
    next();
  };
}
