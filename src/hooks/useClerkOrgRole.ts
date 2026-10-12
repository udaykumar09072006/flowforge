import { useMemo } from 'react';
import { useAuth, useUser, useOrganization } from '@clerk/clerk-react';
import { UserRole } from '../types/workflow';
import { RbacPermission, RbacPermissions } from '../types/rbac';
import {
  mapClerkOrgRoleToUserRole,
  getRolePermissions,
  checkRolePermission,
  formatClerkOrgRoleName,
} from '../utils/clerkOrgRoleMapper';

export interface UseClerkOrgRoleResult {
  /** The mapped FlowForge UserRole enum (OWNER, ADMIN, EDITOR, VIEWER) */
  role: UserRole;
  /** Raw Clerk Organization role slug (e.g. 'org:admin', 'org:member', 'org:owner') */
  rawOrgRole: string | null;
  /** Human-formatted name of the Clerk organization role */
  formattedOrgRole: string;
  /** Explicit permissions granted by Clerk organization or session claims */
  orgPermissions: string[];
  /** Whether the user is the creator / primary owner of the active organization */
  isOrgOwner: boolean;
  /** Details of the active Clerk organization, if any */
  organization: {
    id: string;
    name: string;
    slug: string | null;
    imageUrl?: string;
    membersCount?: number;
  } | null;
  /** The computed FlowForge RBAC permissions bundle */
  permissions: RbacPermissions;
  /** Helper to verify a specific RBAC permission */
  hasPermission: (permission: RbacPermission) => boolean;
  /** Whether Clerk user and organization state are loaded */
  isLoaded: boolean;
  /** Whether user is actively signed in */
  isSignedIn: boolean;
}

/**
 * Hook to inspect the authenticated Clerk user's active organization membership,
 * map their Clerk organization role (org:admin, org:member, custom roles) to
 * FlowForge UserRole (OWNER, ADMIN, EDITOR, VIEWER), and secure RBAC access.
 */
export function useClerkOrgRole(): UseClerkOrgRoleResult {
  let authResult: ReturnType<typeof useAuth> | null = null;
  let userResult: ReturnType<typeof useUser> | null = null;
  let orgResult: ReturnType<typeof useOrganization> | null = null;

  try {
    authResult = useAuth();
  } catch {
    // If called outside ClerkProvider
  }

  try {
    userResult = useUser();
  } catch {
    // If called outside ClerkProvider
  }

  try {
    orgResult = useOrganization();
  } catch {
    // If called outside ClerkProvider
  }

  const isSignedIn = !!authResult?.isSignedIn;
  const isLoaded = !!(authResult?.isLoaded && userResult?.isLoaded);

  const clerkUser = userResult?.user;
  const activeOrg = orgResult?.organization;
  const membership = orgResult?.membership;

  // Raw role from active org or auth claim
  const rawOrgRole = (authResult?.orgRole as string) || (membership?.role as string) || null;

  // Organization creator check
  const isOrgCreator = Boolean(
    (activeOrg && clerkUser && (activeOrg as any).createdBy === clerkUser.id) ||
      rawOrgRole === 'org:owner' ||
      rawOrgRole === 'owner'
  );

  // Extract explicit permissions from org
  const orgPermissions = useMemo<string[]>(() => {
    const customPerms = (authResult as any)?.orgPermissions || (authResult as any)?.sessionClaims?.org_permissions;
    if (customPerms && Array.isArray(customPerms)) {
      return customPerms as string[];
    }
    if (membership?.permissions && Array.isArray(membership.permissions)) {
      return membership.permissions as string[];
    }
    return [];
  }, [authResult, membership?.permissions]);

  // Map to FlowForge UserRole with secure default-deny
  const mappedRole = useMemo<UserRole>(() => {
    if (!isSignedIn) {
      return 'VIEWER';
    }

    return mapClerkOrgRoleToUserRole({
      orgRole: rawOrgRole,
      orgPermissions,
      isOrgCreator,
      userMetadataRole: (clerkUser?.publicMetadata?.role as string) || (clerkUser?.unsafeMetadata?.role as string),
      membershipMetadataRole: (membership?.publicMetadata?.role as string),
      fallbackRole: activeOrg ? 'EDITOR' : 'OWNER', // Personal workspace defaults to OWNER, org defaults to EDITOR
      isSignedIn,
    });
  }, [isSignedIn, rawOrgRole, orgPermissions, isOrgCreator, clerkUser, membership, activeOrg]);

  const permissions = useMemo(() => getRolePermissions(mappedRole), [mappedRole]);

  const organizationDetails = useMemo(() => {
    if (!activeOrg) return null;
    return {
      id: activeOrg.id,
      name: activeOrg.name,
      slug: activeOrg.slug,
      imageUrl: activeOrg.imageUrl,
      membersCount: activeOrg.membersCount,
    };
  }, [activeOrg]);

  const hasPermission = useMemo(
    () => (permission: RbacPermission) => checkRolePermission(mappedRole, permission),
    [mappedRole]
  );

  return {
    role: mappedRole,
    rawOrgRole,
    formattedOrgRole: formatClerkOrgRoleName(rawOrgRole),
    orgPermissions,
    isOrgOwner: isOrgCreator,
    organization: organizationDetails,
    permissions,
    hasPermission,
    isLoaded,
    isSignedIn,
  };
}
