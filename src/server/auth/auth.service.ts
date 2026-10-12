import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const BCRYPT_SALT_ROUNDS = 12;
const SESSION_TTL_DAYS = 7;
const RESET_TOKEN_TTL_HOURS = 1;
const VERIFY_TOKEN_TTL_HOURS = 24;

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  createdAt: string;
}

export interface UserSession {
  id: string;
  userId: string;
  sessionToken: string;
  expiresAt: Date;
  userAgent?: string;
  ipAddress?: string;
  user: AuthUser;
}

/**
 * Authentication Service for FlowForge
 */
export class AuthService {
  /**
   * Hashes a password using bcrypt with high cost factor
   */
  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
  }

  /**
   * Verifies a plain password against the stored bcrypt hash
   */
  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Generates a cryptographically secure random session token
   */
  static generateSessionToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Computes expiration date for sessions
   */
  static getSessionExpiry(): Date {
    return new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
  }

  /**
   * Generates a single-use password reset token with 1-hour expiration
   */
  static generatePasswordResetToken(): { token: string; expiresAt: Date } {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_HOURS * 60 * 60 * 1000);
    return { token, expiresAt };
  }

  /**
   * Generates an email verification token with 24-hour expiration
   */
  static generateEmailVerificationToken(): { token: string; expiresAt: Date } {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + VERIFY_TOKEN_TTL_HOURS * 60 * 60 * 1000);
    return { token, expiresAt };
  }
}
