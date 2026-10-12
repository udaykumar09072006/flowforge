import { PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from '../client';
import { decryptSecret, encryptSecret } from '../encryption';

export class CredentialRepository {
  constructor(private prisma: PrismaClient = defaultPrisma) {}

  /**
   * Stores a new integration credential with AES-256-GCM encryption
   */
  async createCredential(params: {
    workspaceId: string;
    userId: string;
    provider: string;
    displayName: string;
    secretPayload: Record<string, any>;
  }) {
    const encryptedSecret = encryptSecret(params.secretPayload);

    return this.prisma.$transaction(async (tx) => {
      const cred = await tx.integrationCredential.create({
        data: {
          workspaceId: params.workspaceId,
          provider: params.provider,
          displayName: params.displayName,
          encryptedSecret,
          keyVersion: 1,
          status: 'ACTIVE',
          createdById: params.userId,
        },
        select: {
          id: true,
          workspaceId: true,
          provider: true,
          displayName: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      await tx.auditLog.create({
        data: {
          workspaceId: params.workspaceId,
          actorUserId: params.userId,
          action: 'CREDENTIAL_CREATED',
          resourceType: 'IntegrationCredential',
          resourceId: cred.id,
          safeMetadata: {
            provider: params.provider,
            displayName: params.displayName,
          },
        },
      });

      return cred;
    });
  }

  /**
   * Lists workspace credentials with safe projections (encryptedSecret omitted)
   */
  async listCredentials(workspaceId: string) {
    return this.prisma.integrationCredential.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        workspaceId: true,
        provider: true,
        displayName: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  /**
   * Internal execution method: decrypts credential for runtime node invocation
   */
  async getDecryptedSecret(credentialId: string): Promise<Record<string, any>> {
    const cred = await this.prisma.integrationCredential.findUnique({
      where: { id: credentialId },
    });
    if (!cred) throw new Error('Credential not found');
    if (cred.status !== 'ACTIVE') throw new Error('Credential is inactive or revoked');

    return decryptSecret<Record<string, any>>(cred.encryptedSecret);
  }

  /**
   * Deletes a credential and logs audit entry
   */
  async deleteCredential(credentialId: string, userId: string) {
    const cred = await this.prisma.integrationCredential.findUnique({
      where: { id: credentialId },
    });
    if (!cred) throw new Error('Credential not found');

    return this.prisma.$transaction(async (tx) => {
      await tx.integrationCredential.delete({
        where: { id: credentialId },
      });

      await tx.auditLog.create({
        data: {
          workspaceId: cred.workspaceId,
          actorUserId: userId,
          action: 'CREDENTIAL_DELETED',
          resourceType: 'IntegrationCredential',
          resourceId: credentialId,
          safeMetadata: {
            provider: cred.provider,
            displayName: cred.displayName,
          },
        },
      });

      return { success: true };
    });
  }
}
