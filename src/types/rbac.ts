import { UserRole } from './workflow';

export type RbacAction =
  | 'view'
  | 'read'
  | 'create'
  | 'edit'
  | 'update'
  | 'run'
  | 'execute'
  | 'publish'
  | 'delete'
  | 'archive'
  | 'manage'
  | 'invite'
  | 'export';

export type RbacResource =
  | 'workflow'
  | 'workflows'
  | 'execution'
  | 'executions'
  | 'integration'
  | 'integrations'
  | 'member'
  | 'members'
  | 'workspace'
  | 'workspaces'
  | 'workspace_settings'
  | 'audit_log'
  | 'audit_logs'
  | 'template'
  | 'templates';

export type RbacPermission =
  | 'CAN_VIEW_WORKFLOWS'
  | 'CAN_CREATE_WORKFLOWS'
  | 'CAN_EDIT_WORKFLOWS'
  | 'CAN_RUN_WORKFLOWS'
  | 'CAN_PUBLISH_WORKFLOWS'
  | 'CAN_DELETE_WORKFLOWS'
  | 'CAN_MANAGE_INTEGRATIONS'
  | 'CAN_MANAGE_MEMBERS'
  | 'CAN_MANAGE_WORKSPACE_SETTINGS'
  | 'CAN_VIEW_AUDIT_LOGS';

export interface RbacPermissions {
  canViewWorkflows: boolean;
  canCreateWorkflows: boolean;
  canEditWorkflows: boolean;
  canRunWorkflows: boolean;
  canPublishWorkflows: boolean;
  canDeleteWorkflows: boolean;
  canManageIntegrations: boolean;
  canManageMembers: boolean;
  canManageWorkspaceSettings: boolean;
  canViewAuditLogs: boolean;
}

export const ROLE_PERMISSIONS: Record<UserRole, RbacPermissions> = {
  OWNER: {
    canViewWorkflows: true,
    canCreateWorkflows: true,
    canEditWorkflows: true,
    canRunWorkflows: true,
    canPublishWorkflows: true,
    canDeleteWorkflows: true,
    canManageIntegrations: true,
    canManageMembers: true,
    canManageWorkspaceSettings: true,
    canViewAuditLogs: true,
  },
  ADMIN: {
    canViewWorkflows: true,
    canCreateWorkflows: true,
    canEditWorkflows: true,
    canRunWorkflows: true,
    canPublishWorkflows: true,
    canDeleteWorkflows: true,
    canManageIntegrations: true,
    canManageMembers: true,
    canManageWorkspaceSettings: false,
    canViewAuditLogs: true,
  },
  EDITOR: {
    canViewWorkflows: true,
    canCreateWorkflows: true,
    canEditWorkflows: true,
    canRunWorkflows: true,
    canPublishWorkflows: false,
    canDeleteWorkflows: false,
    canManageIntegrations: false,
    canManageMembers: false,
    canManageWorkspaceSettings: false,
    canViewAuditLogs: false,
  },
  VIEWER: {
    canViewWorkflows: true,
    canCreateWorkflows: false,
    canEditWorkflows: false,
    canRunWorkflows: false,
    canPublishWorkflows: false,
    canDeleteWorkflows: false,
    canManageIntegrations: false,
    canManageMembers: false,
    canManageWorkspaceSettings: false,
    canViewAuditLogs: false,
  },
};

export interface ClerkUserRbac {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  role: UserRole;
  isClerkLive: boolean;
}
