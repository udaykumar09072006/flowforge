import { useCallback, useMemo } from 'react';
import { useClerkRbac } from '../context/ClerkRbacContext';
import { UserRole } from '../types/workflow';
import {
  RbacAction,
  RbacResource,
  RbacPermission,
  RbacPermissions,
  ClerkUserRbac,
} from '../types/rbac';

export interface UseFlowForgeRbacReturn {
  /** Internal FlowForge UserRole enum (OWNER, ADMIN, EDITOR, VIEWER) */
  role: UserRole;
  /** Granular permissions map from ClerkRbacContext */
  permissions: RbacPermissions;
  /** Current authenticated user profile or null */
  user: ClerkUserRbac | null;
  /** Primary RBAC gatekeeper: checks whether the current user can perform an action on a resource */
  can: (action: RbacAction, resource: RbacResource) => boolean;
  /** Inverted gatekeeper: true if user is forbidden from performing the action */
  cannot: (action: RbacAction, resource: RbacResource) => boolean;
  /** Explains why an action is blocked (ideal for disabled button tooltips) */
  getRestrictionReason: (action: RbacAction, resource: RbacResource) => string | null;
  /** Hierarchical role checker: true if user's role is at least minimumRole */
  hasRole: (minimumRole: UserRole) => boolean;
  /** Verifies a raw RbacPermission key */
  hasPermission: (permission: RbacPermission) => boolean;

  // Role shortcut flags
  isOwner: boolean;
  isAdmin: boolean;
  isEditor: boolean;
  isViewer: boolean;

  // Key capability shortcut flags
  canEdit: boolean;
  canPublish: boolean;
  canRun: boolean;
  canManageMembers: boolean;
  canManageIntegrations: boolean;
  canManageSettings: boolean;

  // Authentication & Clerk status
  isSignedIn: boolean;
  isClerkLive: boolean;
  publishableKey: string;
  simulationActive: boolean;
  orgRole: string | null;
  formattedOrgRole: string;
  isOrgOwner: boolean;
  organization: {
    id: string;
    name: string;
    slug?: string | null;
    imageUrl?: string;
    membersCount?: number;
  } | null;

  // Context controls
  setRole: (role: UserRole) => void;
  resetToLiveRole: () => void;
  setIsAuthModalOpen: (open: boolean) => void;
  signOut: () => Promise<void>;
}

const ROLE_RANK: Record<UserRole, number> = {
  OWNER: 4,
  ADMIN: 3,
  EDITOR: 2,
  VIEWER: 1,
};

/**
 * Normalizes actions and resources to standard canonical forms.
 */
function normalizeAction(action: RbacAction): string {
  switch (action) {
    case 'read':
      return 'view';
    case 'update':
      return 'edit';
    case 'execute':
      return 'run';
    case 'archive':
      return 'delete';
    default:
      return action;
  }
}

function normalizeResource(resource: RbacResource): string {
  switch (resource) {
    case 'workflows':
      return 'workflow';
    case 'executions':
      return 'execution';
    case 'integrations':
      return 'integration';
    case 'members':
      return 'member';
    case 'workspaces':
    case 'workspace_settings':
      return 'workspace';
    case 'audit_logs':
      return 'audit_log';
    case 'templates':
      return 'template';
    default:
      return resource;
  }
}

/**
 * Hook that maps ClerkRbacContext user permissions to internal FlowForge UserRole
 * (OWNER, ADMIN, EDITOR, VIEWER) and exposes helper methods like can(action, resource)
 * to determine UI element visibility, accessibility, and disabled states.
 */
export function useFlowForgeRbac(): UseFlowForgeRbacReturn {
  const clerkContext = useClerkRbac();
  const {
    role,
    permissions,
    user,
    isSignedIn,
    isClerkLive,
    simulationActive,
    orgRole,
    formattedOrgRole,
    isOrgOwner,
    organization,
    setRole,
    resetToLiveRole,
    setIsAuthModalOpen,
    signOut,
  } = clerkContext;

  /**
   * Deterministic permission evaluator: can(action, resource)
   */
  const can = useCallback(
    (action: RbacAction, resource: RbacResource): boolean => {
      const act = normalizeAction(action);
      const res = normalizeResource(resource);

      // Unauthenticated visitors are strictly limited to read-only views
      if (!isSignedIn) {
        return act === 'view';
      }

      switch (res) {
        case 'workflow': {
          if (act === 'view' || act === 'export') return permissions.canViewWorkflows;
          if (act === 'create') return permissions.canCreateWorkflows;
          if (act === 'edit') return permissions.canEditWorkflows;
          if (act === 'run') return permissions.canRunWorkflows;
          if (act === 'publish') return permissions.canPublishWorkflows;
          if (act === 'delete') return permissions.canDeleteWorkflows;
          if (act === 'manage') return permissions.canPublishWorkflows && permissions.canDeleteWorkflows;
          return false;
        }

        case 'execution': {
          if (act === 'view' || act === 'export') return permissions.canViewWorkflows;
          if (act === 'run') return permissions.canRunWorkflows;
          if (act === 'delete') return permissions.canDeleteWorkflows;
          return false;
        }

        case 'integration': {
          if (act === 'view') return true;
          if (act === 'create' || act === 'edit' || act === 'manage' || act === 'delete') {
            return permissions.canManageIntegrations;
          }
          return false;
        }

        case 'member': {
          if (act === 'view') return true;
          if (act === 'invite' || act === 'manage' || act === 'edit' || act === 'delete') {
            return permissions.canManageMembers;
          }
          return false;
        }

        case 'workspace': {
          if (act === 'view') return true;
          if (act === 'edit' || act === 'manage' || act === 'delete') {
            return permissions.canManageWorkspaceSettings;
          }
          return false;
        }

        case 'audit_log': {
          if (act === 'view' || act === 'export') return permissions.canViewAuditLogs;
          // Audit logs are tamper-proof and immutable
          return false;
        }

        case 'template': {
          if (act === 'view') return true;
          if (act === 'create' || act === 'run') return permissions.canCreateWorkflows;
          return false;
        }

        default:
          return false;
      }
    },
    [isSignedIn, permissions]
  );

  /**
   * Inverted check for UI disabled / forbidden states
   */
  const cannot = useCallback(
    (action: RbacAction, resource: RbacResource): boolean => {
      return !can(action, resource);
    },
    [can]
  );

  /**
   * Human-friendly message explaining why an action is restricted
   */
  const getRestrictionReason = useCallback(
    (action: RbacAction, resource: RbacResource): string | null => {
      if (can(action, resource)) return null;

      if (!isSignedIn) {
        return 'Please sign in with Clerk to perform this action.';
      }

      const act = normalizeAction(action);
      const res = normalizeResource(resource);

      if (res === 'workflow') {
        if (act === 'publish') return 'Publishing workflows to production requires Admin or Owner role.';
        if (act === 'delete') return 'Deleting workflows is restricted to Workspace Admins and Owners.';
        if (act === 'edit' || act === 'create') return 'Editing workflows requires Editor, Admin, or Owner permissions.';
        if (act === 'run') return 'Executing workflows requires Editor, Admin, or Owner permissions.';
      }

      if (res === 'member' && (act === 'invite' || act === 'manage')) {
        return 'Managing workspace members requires Admin or Owner role.';
      }

      if (res === 'integration') {
        return 'Configuring integration credentials and webhooks requires Admin or Owner role.';
      }

      if (res === 'workspace') {
        return 'Modifying workspace settings and billing requires Workspace Owner role.';
      }

      if (res === 'audit_log') {
        return 'Accessing the security audit log requires Admin or Owner role.';
      }

      return `Your active role (${role}) does not have permission to ${action} ${resource}.`;
    },
    [can, isSignedIn, role]
  );

  /**
   * Hierarchical role check
   */
  const hasRole = useCallback(
    (minimumRole: UserRole): boolean => {
      return ROLE_RANK[role] >= ROLE_RANK[minimumRole];
    },
    [role]
  );

  const hasPermission = useCallback(
    (permission: RbacPermission): boolean => {
      return clerkContext.hasPermission(permission);
    },
    [clerkContext]
  );

  return useMemo(
    () => ({
      role,
      permissions,
      user,
      can,
      cannot,
      getRestrictionReason,
      hasRole,
      hasPermission,

      isOwner: role === 'OWNER',
      isAdmin: role === 'ADMIN',
      isEditor: role === 'EDITOR',
      isViewer: role === 'VIEWER',

      canEdit: permissions.canEditWorkflows,
      canPublish: permissions.canPublishWorkflows,
      canRun: permissions.canRunWorkflows,
      canManageMembers: permissions.canManageMembers,
      canManageIntegrations: permissions.canManageIntegrations,
      canManageSettings: permissions.canManageWorkspaceSettings,

      isSignedIn,
      isClerkLive,
      publishableKey: clerkContext.publishableKey,
      simulationActive,
      orgRole,
      formattedOrgRole,
      isOrgOwner,
      organization,

      setRole,
      resetToLiveRole,
      setIsAuthModalOpen,
      signOut,
    }),
    [
      role,
      permissions,
      user,
      can,
      cannot,
      getRestrictionReason,
      hasRole,
      hasPermission,
      isSignedIn,
      isClerkLive,
      clerkContext.publishableKey,
      simulationActive,
      orgRole,
      formattedOrgRole,
      isOrgOwner,
      organization,
      setRole,
      resetToLiveRole,
      setIsAuthModalOpen,
      signOut,
    ]
  );
}
