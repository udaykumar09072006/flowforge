import { UserRole } from './workflow';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
  role?: UserRole;
  workspaceId?: string;
  workspaceName?: string;
}

export interface AuthSession {
  id: string;
  userId: string;
  expiresAt: string;
  userAgent?: string;
  ipAddress?: string;
  createdAt: string;
}

export interface WorkspaceMembershipInfo {
  workspaceId: string;
  workspaceName: string;
  role: UserRole;
  isOwner: boolean;
}

export interface CurrentUserResponse {
  user: AuthUser | null;
  workspaces: WorkspaceMembershipInfo[];
  activeWorkspaceId: string;
}

export interface AuthResponse {
  success: boolean;
  message?: string;
  user?: AuthUser;
  token?: string;
  verificationToken?: string;
  resetToken?: string;
}
