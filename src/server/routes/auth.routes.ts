import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { DataStore, StoredUser } from '../store';
import {
  SignUpSchema,
  LoginSchema,
  ForgotPasswordSchema,
  ResetPasswordSchema,
  VerifyEmailSchema,
} from '../../db/schemas';
import { createRateLimiter, requireAuth } from '../auth';

const COOKIE_NAME = 'flowforge_session';

export function createAuthRouter(store: DataStore): Router {
  const router = Router();
  const isProduction = process.env.NODE_ENV === 'production';

  const cookieOptions = {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax' as const,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/',
  };

  // Rate Limiters
  const signupLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 15,
    message: 'Too many registration attempts. Please try again later.',
  });

  const loginLimiter = createRateLimiter({
    windowMs: 5 * 60 * 1000,
    max: 15,
    message: 'Too many login attempts. Please try again after 5 minutes.',
  });

  const passwordResetLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: 'Too many password reset requests. Please try again later.',
  });

  // Helper: sanitize user object before sending to client
  function sanitizeUser(user: StoredUser, activeWorkspaceId = 'ws_default') {
    const ws = store.workspaces.find((w) => w.id === activeWorkspaceId) || store.workspaces[0];
    const membership = ws ? ws.members.find((m) => m.id === user.id) : null;

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      role: membership?.role || 'EDITOR',
      workspaceId: ws?.id || 'ws_default',
      workspaceName: ws?.name || 'FlowForge Core Workspace',
    };
  }

  // --------------------------------------------------------------------------
  // 1. SIGN UP
  // --------------------------------------------------------------------------
  router.post('/signup', signupLimiter, async (req: Request, res: Response) => {
    const validation = SignUpSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.error.flatten().fieldErrors,
      });
    }

    const { name, email, password } = validation.data;
    const normalizedEmail = email.trim().toLowerCase();

    // Check if user already exists
    const existing = store.findUserByEmail(normalizedEmail);
    if (existing) {
      return res.status(409).json({
        error: 'An account with this email address already exists.',
        code: 'EMAIL_ALREADY_EXISTS',
      });
    }

    // Securely hash password with bcrypt
    const passwordHash = await bcrypt.hash(password, 10);

    // Generate single-use email verification token (expires in 24h)
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Create user in store
    const newUser = store.createUser({
      name,
      email: normalizedEmail,
      passwordHash,
      emailVerified: false,
      emailVerificationToken: verificationToken,
      emailVerificationExpires: verificationExpires,
    });

    // Create session & set HttpOnly cookie
    const userAgent = req.headers['user-agent'] || 'FlowForge Web App';
    const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
    const session = store.createSession(newUser.id, userAgent, ipAddress);

    res.cookie(COOKIE_NAME, session.sessionToken, cookieOptions);

    // Dispatch verification email to outbox
    const verifyUrl = `${req.protocol}://${req.get('host')}/verify-email?token=${verificationToken}`;
    await store.sendEmail(
      newUser.email,
      'Verify your FlowForge Account',
      `Welcome to FlowForge, ${newUser.name}!\n\nPlease verify your email by opening the link below:\n${verifyUrl}\n\nThis token will expire in 24 hours.`
    );

    // Log audit event
    store.auditLogs.unshift({
      id: `aud_${Date.now()}`,
      workspaceId: 'ws_default',
      actor: newUser.name,
      action: 'USER_SIGNED_UP',
      resourceType: 'user',
      resourceId: newUser.id,
      timestamp: new Date().toISOString(),
      metadata: { email: newUser.email },
    });

    return res.status(201).json({
      success: true,
      message: 'Account created successfully. Please verify your email.',
      user: sanitizeUser(newUser),
      token: session.sessionToken,
      verificationToken, // Provided for instant testing/convenience
    });
  });

  // --------------------------------------------------------------------------
  // 2. LOGIN
  // --------------------------------------------------------------------------
  router.post('/login', loginLimiter, async (req: Request, res: Response) => {
    const validation = LoginSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid credentials format',
        details: validation.error.flatten().fieldErrors,
      });
    }

    const { email, password } = validation.data;
    const normalizedEmail = email.trim().toLowerCase();

    const user = store.findUserByEmail(normalizedEmail);
    if (!user) {
      return res.status(401).json({
        error: 'Invalid email or password.',
        code: 'INVALID_CREDENTIALS',
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({
        error: 'Invalid email or password.',
        code: 'INVALID_CREDENTIALS',
      });
    }

    // Create session & set HttpOnly cookie
    const userAgent = req.headers['user-agent'] || 'FlowForge Web App';
    const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
    const session = store.createSession(user.id, userAgent, ipAddress);

    res.cookie(COOKIE_NAME, session.sessionToken, cookieOptions);

    // Log audit event
    store.auditLogs.unshift({
      id: `aud_${Date.now()}`,
      workspaceId: 'ws_default',
      actor: user.name,
      action: 'USER_LOGGED_IN',
      resourceType: 'session',
      resourceId: session.id,
      timestamp: new Date().toISOString(),
      metadata: { email: user.email },
    });

    return res.json({
      success: true,
      message: 'Logged in successfully.',
      user: sanitizeUser(user),
      token: session.sessionToken,
    });
  });

  // --------------------------------------------------------------------------
  // 3. LOGOUT
  // --------------------------------------------------------------------------
  router.post('/logout', (req: Request, res: Response) => {
    let token = req.cookies?.[COOKIE_NAME];
    if (!token && req.headers.authorization) {
      const parts = req.headers.authorization.split(' ');
      if (parts.length === 2 && parts[0] === 'Bearer') {
        token = parts[1];
      }
    }

    if (token) {
      store.revokeSession(token);
    }

    res.clearCookie(COOKIE_NAME, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax' as const,
      path: '/',
    });

    return res.json({
      success: true,
      message: 'Logged out successfully.',
    });
  });

  // --------------------------------------------------------------------------
  // 4. CURRENT USER / SESSION LOOKUP (ME)
  // --------------------------------------------------------------------------
  router.get('/me', (req: Request, res: Response) => {
    let token = req.cookies?.[COOKIE_NAME];
    if (!token && req.headers.authorization) {
      const parts = req.headers.authorization.split(' ');
      if (parts.length === 2 && (parts[0] === 'Bearer' || parts[0] === 'Token')) {
        token = parts[1];
      }
    }

    if (!token) {
      return res.status(401).json({ user: null, message: 'No active session' });
    }

    const sessionData = store.findSessionByToken(token);
    if (!sessionData) {
      res.clearCookie(COOKIE_NAME, { path: '/' });
      return res.status(401).json({ user: null, message: 'Session expired or invalid' });
    }

    const { user, session } = sessionData;
    const workspaces = store.workspaces
      .filter((w) => w.members.some((m) => m.id === user.id))
      .map((w) => {
        const member = w.members.find((m) => m.id === user.id)!;
        return {
          workspaceId: w.id,
          workspaceName: w.name,
          role: member.role,
          isOwner: member.role === 'OWNER',
        };
      });

    return res.json({
      user: sanitizeUser(user),
      session: {
        id: session.id,
        expiresAt: session.expiresAt,
        createdAt: session.createdAt,
      },
      workspaces,
      activeWorkspaceId: workspaces[0]?.workspaceId || 'ws_default',
    });
  });

  // --------------------------------------------------------------------------
  // 5. FORGOT PASSWORD (Zero User Enumeration)
  // --------------------------------------------------------------------------
  router.post('/forgot-password', passwordResetLimiter, async (req: Request, res: Response) => {
    const validation = ForgotPasswordSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid email address',
        details: validation.error.flatten().fieldErrors,
      });
    }

    const { email } = validation.data;
    const normalizedEmail = email.trim().toLowerCase();
    const user = store.findUserByEmail(normalizedEmail);

    let resetToken: string | undefined;

    if (user) {
      // Generate cryptographically secure token & 1 hour expiry
      resetToken = crypto.randomBytes(32).toString('hex');
      const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      store.setPasswordResetToken(user.id, resetToken, resetExpires);

      // Dispatch reset email to outbox
      const resetUrl = `${req.protocol}://${req.get('host')}/reset-password?token=${resetToken}`;
      await store.sendEmail(
        user.email,
        'Reset your FlowForge Password',
        `Hello ${user.name},\n\nWe received a request to reset your password. Use the link below to set a new password:\n${resetUrl}\n\nThis token will expire in 1 hour. If you did not request this, you can safely ignore this email.`
      );

      store.auditLogs.unshift({
        id: `aud_${Date.now()}`,
        workspaceId: 'ws_default',
        actor: user.name,
        action: 'PASSWORD_RESET_REQUESTED',
        resourceType: 'user',
        resourceId: user.id,
        timestamp: new Date().toISOString(),
        metadata: { email: user.email },
      });
    }

    // STRICT SECURITY: Never reveal whether the email exists
    return res.json({
      success: true,
      message:
        'If an account exists with this email address, password reset instructions have been dispatched.',
      // Provided in non-production for instant UI/test link simulation
      ...(resetToken && !isProduction ? { debugResetToken: resetToken } : {}),
    });
  });

  // --------------------------------------------------------------------------
  // 6. RESET PASSWORD (Single-Use, Revokes Existing Sessions)
  // --------------------------------------------------------------------------
  router.post('/reset-password', passwordResetLimiter, async (req: Request, res: Response) => {
    const validation = ResetPasswordSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.error.flatten().fieldErrors,
      });
    }

    const { token, password } = validation.data;

    // Find user by valid unexpired token
    const user = store.findByPasswordResetToken(token);
    if (!user) {
      return res.status(400).json({
        error: 'Invalid or expired password reset token. Please request a new link.',
        code: 'INVALID_RESET_TOKEN',
      });
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(password, 10);

    // Update password, clear token, and invalidate all user sessions
    store.resetPassword(user.id, newPasswordHash);

    // Clear any active session cookie on this client
    res.clearCookie(COOKIE_NAME, { path: '/' });

    // Send confirmation email
    await store.sendEmail(
      user.email,
      'Your FlowForge Password Was Reset',
      `Hello ${user.name},\n\nYour FlowForge account password was successfully reset. If you did not make this change, please contact your workspace administrator immediately.`
    );

    store.auditLogs.unshift({
      id: `aud_${Date.now()}`,
      workspaceId: 'ws_default',
      actor: user.name,
      action: 'PASSWORD_RESET_COMPLETED',
      resourceType: 'user',
      resourceId: user.id,
      timestamp: new Date().toISOString(),
      metadata: { email: user.email },
    });

    return res.json({
      success: true,
      message: 'Password has been successfully updated. You may now log in with your new password.',
    });
  });

  // --------------------------------------------------------------------------
  // 7. EMAIL VERIFICATION
  // --------------------------------------------------------------------------
  router.post('/verify-email', async (req: Request, res: Response) => {
    const validation = VerifyEmailSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Verification token is required',
        details: validation.error.flatten().fieldErrors,
      });
    }

    const { token } = validation.data;
    const user = store.findByEmailVerificationToken(token);

    if (!user) {
      return res.status(400).json({
        error: 'Invalid or expired email verification token.',
        code: 'INVALID_VERIFICATION_TOKEN',
      });
    }

    store.verifyEmail(user.id);

    store.auditLogs.unshift({
      id: `aud_${Date.now()}`,
      workspaceId: 'ws_default',
      actor: user.name,
      action: 'EMAIL_VERIFIED',
      resourceType: 'user',
      resourceId: user.id,
      timestamp: new Date().toISOString(),
      metadata: { email: user.email },
    });

    return res.json({
      success: true,
      message: 'Email address has been successfully verified.',
      user: sanitizeUser(user),
    });
  });

  // --------------------------------------------------------------------------
  // 8. RESEND VERIFICATION EMAIL
  // --------------------------------------------------------------------------
  router.post('/resend-verification', requireAuth, async (req: Request, res: Response) => {
    const user = req.user!;
    if (user.emailVerified) {
      return res.json({
        success: true,
        message: 'Your email address is already verified.',
      });
    }

    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    store.updateUser(user.id, {
      emailVerificationToken: verificationToken,
      emailVerificationExpires: verificationExpires,
    });

    const verifyUrl = `${req.protocol}://${req.get('host')}/verify-email?token=${verificationToken}`;
    await store.sendEmail(
      user.email,
      'Verify your FlowForge Account (Resent)',
      `Hello ${user.name},\n\nPlease verify your email by clicking the link below:\n${verifyUrl}\n\nThis token will expire in 24 hours.`
    );

    return res.json({
      success: true,
      message: 'A fresh verification email has been dispatched to your inbox.',
      verificationToken, // Provided for easy development simulation
    });
  });

  return router;
}
