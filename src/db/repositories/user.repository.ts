import { PrismaClient, WorkspaceRole } from '@prisma/client';
import { prisma as defaultPrisma } from '../client';
import crypto from 'crypto';

export class UserRepository {
  constructor(private prisma: PrismaClient = defaultPrisma) {}

  /**
   * Find a user by normalized email address
   */
  async findByEmail(email: string) {
    const normalized = email.trim().toLowerCase();
    return this.prisma.user.findUnique({
      where: { email: normalized },
      include: {
        memberships: {
          include: {
            workspace: true,
          },
        },
      },
    });
  }

  /**
   * Find a user by UUID
   */
  async findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: {
        memberships: {
          include: {
            workspace: true,
          },
        },
      },
    });
  }

  /**
   * Create a new user, and optionally provision their default workspace
   */
  async createUser(params: {
    name: string;
    email: string;
    passwordHash: string;
    emailVerified?: boolean;
    emailVerificationToken?: string | null;
    emailVerificationExpires?: Date | null;
    workspaceName?: string;
  }) {
    const normalized = params.email.trim().toLowerCase();

    return this.prisma.$transaction(async (tx) => {
      // 1. Create user
      const user = await tx.user.create({
        data: {
          name: params.name.trim(),
          email: normalized,
          passwordHash: params.passwordHash,
          emailVerified: params.emailVerified ?? false,
          emailVerificationToken: params.emailVerificationToken,
          emailVerificationExpires: params.emailVerificationExpires,
        },
      });

      // 2. Create personal workspace for the user
      const wsSlug = `${normalized.split('@')[0].replace(/[^a-z0-9]/g, '-')}-${Date.now().toString(36)}`;
      const workspace = await tx.workspace.create({
        data: {
          name: params.workspaceName || `${params.name.trim()}'s Workspace`,
          slug: wsSlug,
          ownerId: user.id,
        },
      });

      // 3. Assign as OWNER
      await tx.workspaceMember.create({
        data: {
          workspaceId: workspace.id,
          userId: user.id,
          role: 'OWNER',
        },
      });

      return { user, workspace };
    });
  }

  /**
   * Create an active session
   */
  async createSession(params: {
    userId: string;
    sessionToken: string;
    expiresAt: Date;
    userAgent?: string;
    ipAddress?: string;
  }) {
    return this.prisma.session.create({
      data: {
        userId: params.userId,
        sessionToken: params.sessionToken,
        expiresAt: params.expiresAt,
        userAgent: params.userAgent,
        ipAddress: params.ipAddress,
      },
    });
  }

  /**
   * Validate and retrieve session with user record
   */
  async findSession(sessionToken: string) {
    const session = await this.prisma.session.findUnique({
      where: { sessionToken },
      include: {
        user: {
          include: {
            memberships: {
              include: {
                workspace: true,
              },
            },
          },
        },
      },
    });

    if (!session) return null;

    // Check expiration
    if (session.expiresAt <= new Date()) {
      await this.revokeSession(sessionToken).catch(() => {});
      return null;
    }

    return session;
  }

  /**
   * Revoke single session
   */
  async revokeSession(sessionToken: string) {
    return this.prisma.session.deleteMany({
      where: { sessionToken },
    });
  }

  /**
   * Revoke all sessions for a user (e.g. after password reset)
   */
  async revokeAllUserSessions(userId: string) {
    return this.prisma.session.deleteMany({
      where: { userId },
    });
  }

  /**
   * Save password reset token
   */
  async setPasswordResetToken(userId: string, token: string, expiresAt: Date) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordResetToken: token,
        passwordResetExpires: expiresAt,
      },
    });
  }

  /**
   * Find user by password reset token
   */
  async findByPasswordResetToken(token: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        passwordResetToken: token,
        passwordResetExpires: {
          gt: new Date(),
        },
      },
    });
    return user;
  }

  /**
   * Complete password reset
   */
  async resetPassword(userId: string, passwordHash: string) {
    return this.prisma.$transaction(async (tx) => {
      // Clear reset token and update password
      const user = await tx.user.update({
        where: { id: userId },
        data: {
          passwordHash,
          passwordResetToken: null,
          passwordResetExpires: null,
        },
      });

      // Revoke all existing sessions
      await tx.session.deleteMany({
        where: { userId },
      });

      return user;
    });
  }

  /**
   * Find user by email verification token
   */
  async findByVerificationToken(token: string) {
    return this.prisma.user.findFirst({
      where: {
        emailVerificationToken: token,
        emailVerificationExpires: {
          gt: new Date(),
        },
      },
    });
  }

  /**
   * Mark user's email as verified
   */
  async verifyEmail(userId: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpires: null,
      },
    });
  }

  /**
   * Check workspace membership and authorization
   */
  async verifyWorkspaceAccess(
    workspaceId: string,
    userId: string,
    allowedRoles: WorkspaceRole[] = ['OWNER', 'ADMIN', 'EDITOR', 'VIEWER']
  ): Promise<boolean> {
    const member = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: { workspaceId, userId },
      },
    });

    if (!member) return false;
    return allowedRoles.includes(member.role);
  }
}
