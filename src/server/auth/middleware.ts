import { Request, Response, NextFunction } from 'express';
import { AuthUser, UserSession } from './auth.service';
import { WorkspaceRole } from '@prisma/client';

export interface AuthenticatedRequest extends Omit<Request, 'user' | 'session'> {
  user?: AuthUser | any;
  session?: UserSession | any;
  workspaceRole?: WorkspaceRole;
}

export const SESSION_COOKIE_NAME = 'flowforge_session';

/**
 * Middleware that validates the session cookie and attaches user & session to Request
 */
export function createSessionMiddleware(sessionLookup: (token: string) => Promise<UserSession | null>) {
  return async (req: AuthenticatedRequest, _res: Response, next: NextFunction): Promise<void> => {
    // Read session token from HttpOnly cookie or Authorization Bearer header
    const token =
      req.cookies?.[SESSION_COOKIE_NAME] ||
      (req.headers.authorization?.startsWith('Bearer ')
        ? req.headers.authorization.slice(7)
        : null);

    if (!token) {
      next();
      return;
    }

    try {
      const session = await sessionLookup(token);
      if (session && new Date(session.expiresAt) > new Date()) {
        req.session = session;
        req.user = session.user;
      }
    } catch (err) {
      console.error('[Auth Middleware] Session lookup failed:', err);
    }

    next();
  };
}

/**
 * Middleware that blocks unauthenticated requests with HTTP 401
 */
export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.user || !req.session) {
    res.status(401).json({
      error: 'Authentication required. Please sign in to continue.',
      code: 'UNAUTHENTICATED',
    });
    return;
  }
  next();
}

/**
 * Middleware that enforces workspace membership and role authorization,
 * preventing Insecure Direct Object References (IDOR) and cross-tenant leakage.
 */
export function createWorkspaceAccessMiddleware(
  membershipLookup: (workspaceId: string, userId: string) => Promise<{ role: WorkspaceRole } | null>
) {
  return (requiredRoles: WorkspaceRole[] = ['OWNER', 'ADMIN', 'EDITOR', 'VIEWER']) => {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required.' });
        return;
      }

      const workspaceId =
        req.params.workspaceId ||
        req.body?.workspaceId ||
        (req.query.workspaceId as string);

      if (!workspaceId) {
        res.status(400).json({ error: 'Missing required workspace identifier.' });
        return;
      }

      try {
        const member = await membershipLookup(workspaceId, req.user.id);
        if (!member) {
          res.status(403).json({
            error: 'Access denied: You are not a member of this workspace.',
            code: 'FORBIDDEN_WORKSPACE',
          });
          return;
        }

        if (!requiredRoles.includes(member.role)) {
          res.status(403).json({
            error: `Access denied: Role '${member.role}' lacks permission for this action. Required: ${requiredRoles.join(', ')}`,
            code: 'INSUFFICIENT_ROLE',
          });
          return;
        }

        req.workspaceRole = member.role;
        next();
      } catch (err: any) {
        res.status(500).json({ error: `Authorization check failed: ${err.message}` });
      }
    };
  };
}
