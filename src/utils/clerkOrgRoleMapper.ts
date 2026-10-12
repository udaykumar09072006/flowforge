import { UserRole } from '../types/workflow';
import { RbacPermission, RbacPermissions, ROLE_PERMISSIONS } from '../types/rbac';

export interface ClerkOrgRoleMapOptions {
  /** The raw organization role string from Clerk (e.g., 'org:admin', 'org:member', 'org:owner') */
  orgRole?: string | null;
  /** List of explicit organization permissions from Clerk JWT or auth object */
  orgPermissions?: string[] | null;
  /** Whether the authenticated user is the creator or owner of the active organization */
  isOrgCreator?: boolean;
  /** Role string explicitly assigned in Clerk user publicMetadata or unsafeMetadata */
  userMetadataRole?: string | null;
  /** Role string explicitly assigned in Clerk organization membership metadata */
  membershipMetadataRole?: string | null;
  /** Fallback role if no matching role is discovered. Defaults to 'VIEWER' for security. */
  fallbackRole?: UserRole;
  /** Whether the user is signed in. If false, strictly forces VIEWER. */
  isSignedIn?: boolean;
}

/**
 * Standard Clerk organization role mappings to FlowForge UserRole enum:
 * - org:owner / creator / sysadmin -> OWNER
 * - org:admin / admin / manager   -> ADMIN
 * - org:member / editor / builder -> EDITOR
 * - org:viewer / guest / readonly -> VIEWER
 */
const CLERK_ORG_ROLE_MAP: Record<string, UserRole> = {
  // Owner level
  'org:owner': 'OWNER',
  'owner': 'OWNER',
  'org:creator': 'OWNER',
  'creator': 'OWNER',
  'org:sysadmin': 'OWNER',
  'sysadmin': 'OWNER',
  'superadmin': 'OWNER',
  'org:superadmin': 'OWNER',

  // Admin level
  'org:admin': 'ADMIN',
  'admin': 'ADMIN',
  'administrator': 'ADMIN',
  'org:administrator': 'ADMIN',
  'org:manager': 'ADMIN',
  'manager': 'ADMIN',
  'billing_admin': 'ADMIN',

  // Editor level
  'org:member': 'EDITOR',
  'member': 'EDITOR',
  'org:editor': 'EDITOR',
  'editor': 'EDITOR',
  'builder': 'EDITOR',
  'org:builder': 'EDITOR',
  'developer': 'EDITOR',
  'org:developer': 'EDITOR',
  'contributor': 'EDITOR',
  'org:contributor': 'EDITOR',
  'writer': 'EDITOR',

  // Viewer level
  'org:viewer': 'VIEWER',
  'viewer': 'VIEWER',
  'guest': 'VIEWER',
  'org:guest': 'VIEWER',
  'readonly': 'VIEWER',
  'read_only': 'VIEWER',
  'reader': 'VIEWER',
  'auditor': 'VIEWER',
};

/**
 * Normalizes a role string for key lookup (lowercased, trimmed, hyphens preserved).
 */
export function normalizeClerkRole(role: string): string {
  return role.trim().toLowerCase().replace(/[\s_]+/g, '_');
}

/**
 * Maps Clerk organization roles and permissions to FlowForge UserRole (OWNER, ADMIN, EDITOR, VIEWER).
 *
 * Security Model:
 * 1. If user is NOT signed in, strictly returns 'VIEWER'.
 * 2. If user is the creator/owner of the organization, grants 'OWNER'.
 * 3. Inspects membershipMetadataRole or userMetadataRole if explicitly set to a valid UserRole.
 * 4. Checks Clerk orgRole against normalized map (e.g. 'org:admin' -> 'ADMIN', 'org:member' -> 'EDITOR').
 * 5. Evaluates explicit orgPermissions array (e.g. admin or editor permissions).
 * 6. Falls back to fallbackRole (defaulting to 'VIEWER' for secure default-deny principle).
 */
export function mapClerkOrgRoleToUserRole(
  optionsOrRole?: ClerkOrgRoleMapOptions | string | null,
  maybePermissions?: string[] | null
): UserRole {
  // Support overload where first parameter is a plain role string
  let options: ClerkOrgRoleMapOptions;
  if (typeof optionsOrRole === 'string' || optionsOrRole === null || optionsOrRole === undefined) {
    options = {
      orgRole: optionsOrRole ?? undefined,
      orgPermissions: maybePermissions ?? undefined,
    };
  } else {
    options = optionsOrRole;
  }

  const {
    orgRole,
    orgPermissions,
    isOrgCreator = false,
    userMetadataRole,
    membershipMetadataRole,
    fallbackRole = 'VIEWER',
    isSignedIn = true,
  } = options;

  // 1. Strict Unauthenticated check: Guests always get VIEWER
  if (!isSignedIn) {
    return 'VIEWER';
  }

  // 2. Organization Creator check
  if (isOrgCreator) {
    return 'OWNER';
  }

  // 3. Explicit Organization Membership Metadata Role check
  if (membershipMetadataRole) {
    const candidate = String(membershipMetadataRole).trim().toUpperCase();
    if (candidate === 'OWNER' || candidate === 'ADMIN' || candidate === 'EDITOR' || candidate === 'VIEWER') {
      return candidate as UserRole;
    }
  }

  // 4. Explicit User Public/Unsafe Metadata Role check
  if (userMetadataRole) {
    const candidate = String(userMetadataRole).trim().toUpperCase();
    if (candidate === 'OWNER' || candidate === 'ADMIN' || candidate === 'EDITOR' || candidate === 'VIEWER') {
      return candidate as UserRole;
    }
  }

  // 5. Clerk Organization Role matching
  if (orgRole) {
    const raw = String(orgRole).trim();
    // Direct uppercase check
    const upper = raw.toUpperCase();
    if (upper === 'OWNER' || upper === 'ADMIN' || upper === 'EDITOR' || upper === 'VIEWER') {
      return upper as UserRole;
    }

    // Lookup in normalized dictionary
    const normalized = normalizeClerkRole(raw);
    if (CLERK_ORG_ROLE_MAP[normalized]) {
      return CLERK_ORG_ROLE_MAP[normalized];
    }

    // Handle prefixed or suffix variants like 'org:admin_role'
    if (normalized.includes('admin') || normalized.includes('manager')) {
      return 'ADMIN';
    }
    if (normalized.includes('owner') || normalized.includes('creator')) {
      return 'OWNER';
    }
    if (normalized.includes('edit') || normalized.includes('write') || normalized.includes('build')) {
      return 'EDITOR';
    }
    if (normalized.includes('view') || normalized.includes('read') || normalized.includes('guest')) {
      return 'VIEWER';
    }
    if (normalized.includes('member')) {
      return 'EDITOR';
    }
  }

  // 6. Explicit Clerk Org Permissions evaluation
  if (orgPermissions && orgPermissions.length > 0) {
    const permStrings = orgPermissions.map((p) => p.toLowerCase());

    const hasOwnerPerms = permStrings.some(
      (p) =>
        p.includes('owner') ||
        p.includes('billing:manage') ||
        p.includes('workspace:destroy') ||
        p.includes('org:sys:all')
    );
    if (hasOwnerPerms) return 'OWNER';

    const hasAdminPerms = permStrings.some(
      (p) =>
        p.includes('admin') ||
        p.includes('members:manage') ||
        p.includes('workflows:publish') ||
        p.includes('workflows:delete') ||
        p.includes('integrations:manage')
    );
    if (hasAdminPerms) return 'ADMIN';

    const hasEditorPerms = permStrings.some(
      (p) =>
        p.includes('edit') ||
        p.includes('workflows:create') ||
        p.includes('workflows:edit') ||
        p.includes('workflows:run')
    );
    if (hasEditorPerms) return 'EDITOR';
  }

  // 7. Secure fallback
  return fallbackRole;
}

/**
 * Returns the verified permissions bundle for a given UserRole.
 */
export function getRolePermissions(role: UserRole): RbacPermissions {
  return ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.VIEWER;
}

/**
 * Checks whether a given role holds a specific RbacPermission.
 */
export function checkRolePermission(role: UserRole, permission: RbacPermission): boolean {
  const perms = getRolePermissions(role);
  switch (permission) {
    case 'CAN_VIEW_WORKFLOWS':
      return perms.canViewWorkflows;
    case 'CAN_CREATE_WORKFLOWS':
      return perms.canCreateWorkflows;
    case 'CAN_EDIT_WORKFLOWS':
      return perms.canEditWorkflows;
    case 'CAN_RUN_WORKFLOWS':
      return perms.canRunWorkflows;
    case 'CAN_PUBLISH_WORKFLOWS':
      return perms.canPublishWorkflows;
    case 'CAN_DELETE_WORKFLOWS':
      return perms.canDeleteWorkflows;
    case 'CAN_MANAGE_INTEGRATIONS':
      return perms.canManageIntegrations;
    case 'CAN_MANAGE_MEMBERS':
      return perms.canManageMembers;
    case 'CAN_MANAGE_WORKSPACE_SETTINGS':
      return perms.canManageWorkspaceSettings;
    case 'CAN_VIEW_AUDIT_LOGS':
      return perms.canViewAuditLogs;
    default:
      return false;
  }
}

/**
 * User-friendly display title for Clerk org roles.
 */
export function formatClerkOrgRoleName(clerkRole?: string | null): string {
  if (!clerkRole) return 'No Organization';
  const cleaned = clerkRole.replace(/^org:/i, '');
  return cleaned
    .split(/[-_]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Comprehensive mapping table documentation for displaying in UI, settings, and documentation.
 */
export interface ClerkRoleMappingDocumentation {
  clerkOrgRole: string;
  flowForgeRole: UserRole;
  title: string;
  badgeColor: string;
  description: string;
  capabilities: string[];
}

export const CLERK_ROLE_MAPPING_MATRIX: ClerkRoleMappingDocumentation[] = [
  {
    clerkOrgRole: 'org:owner / Org Creator',
    flowForgeRole: 'OWNER',
    title: 'Workspace Owner',
    badgeColor: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
    description: 'Creator of the Clerk organization or explicitly assigned owner.',
    capabilities: [
      'Full administrative authority',
      'Manage billing and workspace settings',
      'Assign & revoke RBAC roles',
      'Publish, edit, run, and delete any workflow',
      'Manage all integrations & audit logs',
    ],
  },
  {
    clerkOrgRole: 'org:admin',
    flowForgeRole: 'ADMIN',
    title: 'Administrator',
    badgeColor: 'text-violet-500 bg-violet-500/10 border-violet-500/20',
    description: 'Members with Clerk org:admin role or administrative management permissions.',
    capabilities: [
      'Publish workflows to production',
      'Invite & manage workspace members',
      'Configure integrations & secrets',
      'Review complete audit trail logs',
      'Create, edit, and test workflows',
    ],
  },
  {
    clerkOrgRole: 'org:member (default)',
    flowForgeRole: 'EDITOR',
    title: 'Editor / Workflow Builder',
    badgeColor: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
    description: 'Standard Clerk organization members who build and test automation pipelines.',
    capabilities: [
      'Create new workflows & canvas graphs',
      'Edit draft nodes & configurations',
      'Trigger test workflow executions',
      'View execution history and logs',
      'Restricted: Cannot publish or delete production workflows',
    ],
  },
  {
    clerkOrgRole: 'org:viewer / Guest',
    flowForgeRole: 'VIEWER',
    title: 'Viewer (Read-Only)',
    badgeColor: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
    description: 'Read-only stakeholders, auditors, and unauthenticated preview users.',
    capabilities: [
      'Inspect canvas workflows and node configs',
      'View execution summaries & metrics',
      'Audit log read-only access',
      'Restricted: Cannot run, edit, save, or publish workflows',
    ],
  },
];
