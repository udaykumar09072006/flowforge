import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import {
  ClerkProvider,
  useUser,
  useClerk,
  useAuth as useClerkAuthHook,
  useOrganization,
} from '@clerk/clerk-react';
import { UserRole } from '../types/workflow';
import { ClerkUserRbac, RbacPermissions, RbacPermission, ROLE_PERMISSIONS } from '../types/rbac';
import {
  mapClerkOrgRoleToUserRole,
  formatClerkOrgRoleName,
  checkRolePermission,
} from '../utils/clerkOrgRoleMapper';

export interface ClerkOrganizationSummary {
  id: string;
  name: string;
  slug?: string | null;
  imageUrl?: string;
  membersCount?: number;
}

export interface ClerkRbacContextType {
  /** Effective FlowForge UserRole enum (OWNER, ADMIN, EDITOR, VIEWER) */
  role: UserRole;
  /** Granular permissions bundle strictly derived from active role */
  permissions: RbacPermissions;
  /** Authenticated user details or null if signed out */
  user: ClerkUserRbac | null;
  /** True if connected to live Clerk SDK (pk_test_* / pk_live_*) */
  isClerkLive: boolean;
  /** Clerk Publishable key currently configured */
  publishableKey: string;
  setPublishableKey: (key: string) => void;
  clearPublishableKey: () => void;
  /** Set or simulate a role */
  setRole: (role: UserRole) => void;
  /** Modal controls */
  isAuthModalOpen: boolean;
  setIsAuthModalOpen: (open: boolean) => void;
  authModalMode: 'signin' | 'signup' | 'settings';
  setAuthModalMode: (mode: 'signin' | 'signup' | 'settings') => void;
  signOut: () => Promise<void>;
  isSignedIn: boolean;
  /** Raw Clerk Organization role slug (e.g. 'org:admin', 'org:member') */
  orgRole: string | null;
  /** Formatted human-readable role name (e.g. 'Admin', 'Workspace Owner') */
  formattedOrgRole: string;
  /** True if the active user created or owns the active Clerk organization */
  isOrgOwner: boolean;
  /** Active Clerk organization details */
  organization: ClerkOrganizationSummary | null;
  /** Helper to verify a specific RbacPermission against active role */
  hasPermission: (permission: RbacPermission) => boolean;
  /** True if a manual simulation override is actively applied */
  simulationActive: boolean;
  /** Clears any local simulation override and restores true Clerk role */
  resetToLiveRole: () => void;
}

const ClerkRbacContext = createContext<ClerkRbacContextType | undefined>(undefined);

const CLERK_STORAGE_KEY = 'flowforge_clerk_pubkey';
const CLERK_SIMULATED_ROLE_KEY = 'flowforge_clerk_role';

// Simulated personas for demo / sandbox without live API key
export const DEMO_PERSONAS: Record<UserRole, ClerkUserRbac> = {
  OWNER: {
    id: 'user_clerk_owner_alex',
    name: 'Alex Rivera',
    email: 'alex@flowforge.dev',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
    role: 'OWNER',
    isClerkLive: false,
  },
  ADMIN: {
    id: 'user_clerk_admin_sarah',
    name: 'Sarah Chen',
    email: 'sarah.c@flowforge.dev',
    avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80',
    role: 'ADMIN',
    isClerkLive: false,
  },
  EDITOR: {
    id: 'user_clerk_editor_devon',
    name: 'Devon Patel',
    email: 'devon@flowforge.dev',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80',
    role: 'EDITOR',
    isClerkLive: false,
  },
  VIEWER: {
    id: 'user_clerk_viewer_maya',
    name: 'Maya Lin',
    email: 'maya@flowforge.dev',
    avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&auto=format&fit=crop&q=80',
    role: 'VIEWER',
    isClerkLive: false,
  },
};

/**
 * Internal bridge mounted inside ClerkProvider when a live Publishable Key is present.
 * Inspects Clerk authentication, organization roles, and metadata, mapping them to FlowForge RBAC.
 */
const LiveClerkBridge: React.FC<{
  children: React.ReactNode;
  publishableKey: string;
  setPublishableKey: (key: string) => void;
  clearPublishableKey: () => void;
  isAuthModalOpen: boolean;
  setIsAuthModalOpen: (open: boolean) => void;
  authModalMode: 'signin' | 'signup' | 'settings';
  setAuthModalMode: (mode: 'signin' | 'signup' | 'settings') => void;
}> = ({
  children,
  publishableKey,
  setPublishableKey,
  clearPublishableKey,
  isAuthModalOpen,
  setIsAuthModalOpen,
  authModalMode,
  setAuthModalMode,
}) => {
  const { user: clerkUser } = useUser();
  const { signOut: clerkSignOut } = useClerk();
  const auth = useClerkAuthHook();
  const { isSignedIn, orgRole } = auth;
  const orgPermissions = (auth as any)?.orgPermissions || (auth as any)?.sessionClaims?.org_permissions;
  const { organization, membership } = useOrganization();

  const [overrideRole, setOverrideRole] = useState<UserRole | null>(() => {
    return (localStorage.getItem(CLERK_SIMULATED_ROLE_KEY) as UserRole) || null;
  });

  const rawOrgRole = (orgRole as string) || (membership?.role as string) || null;

  // Determine whether user is the creator or explicit owner of the active organization
  const isOrgOwner = Boolean(
    (organization && clerkUser && (organization as any).createdBy === clerkUser.id) ||
      rawOrgRole === 'org:owner' ||
      rawOrgRole === 'owner'
  );

  // Compute live role from Clerk organization role, metadata, and permissions
  const clerkLiveRole: UserRole = useMemo(() => {
    // Security check: Unauthenticated guests are strictly restricted to VIEWER
    if (!isSignedIn) {
      return 'VIEWER';
    }

    return mapClerkOrgRoleToUserRole({
      orgRole: rawOrgRole,
      orgPermissions: (orgPermissions as string[]) || (membership?.permissions as string[]),
      isOrgCreator: isOrgOwner,
      userMetadataRole: (clerkUser?.publicMetadata?.role as string) || (clerkUser?.unsafeMetadata?.role as string),
      membershipMetadataRole: (membership?.publicMetadata?.role as string),
      fallbackRole: organization ? 'EDITOR' : 'OWNER', // Personal workspace defaults to OWNER, org defaults to EDITOR
      isSignedIn: true,
    });
  }, [isSignedIn, rawOrgRole, orgPermissions, membership, isOrgOwner, clerkUser, organization]);

  // If testing with simulation override, use override; otherwise use live Clerk role
  const computedRole: UserRole = overrideRole || clerkLiveRole;
  const simulationActive = Boolean(overrideRole && overrideRole !== clerkLiveRole);

  const permissions = useMemo(() => ROLE_PERMISSIONS[computedRole], [computedRole]);

  const activeUser: ClerkUserRbac | null = useMemo(() => {
    if (!isSignedIn || !clerkUser) {
      return null;
    }
    return {
      id: clerkUser.id,
      name: clerkUser.fullName || clerkUser.username || clerkUser.primaryEmailAddress?.emailAddress || 'Clerk User',
      email: clerkUser.primaryEmailAddress?.emailAddress || '',
      avatarUrl: clerkUser.imageUrl,
      role: computedRole,
      isClerkLive: true,
    };
  }, [isSignedIn, clerkUser, computedRole]);

  const setRole = useCallback(
    async (newRole: UserRole) => {
      setOverrideRole(newRole);
      localStorage.setItem(CLERK_SIMULATED_ROLE_KEY, newRole);
      try {
        if (clerkUser) {
          await clerkUser.update({
            // @ts-ignore
            unsafeMetadata: { role: newRole },
          });
        }
      } catch (e) {
        // Safe ignore
      }
    },
    [clerkUser]
  );

  const resetToLiveRole = useCallback(() => {
    setOverrideRole(null);
    localStorage.removeItem(CLERK_SIMULATED_ROLE_KEY);
  }, []);

  const handleSignOut = useCallback(async () => {
    await clerkSignOut();
  }, [clerkSignOut]);

  const organizationSummary: ClerkOrganizationSummary | null = useMemo(() => {
    if (!organization) return null;
    return {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      imageUrl: organization.imageUrl,
      membersCount: organization.membersCount,
    };
  }, [organization]);

  const hasPermission = useCallback(
    (permission: RbacPermission) => checkRolePermission(computedRole, permission),
    [computedRole]
  );

  return (
    <ClerkRbacContext.Provider
      value={{
        role: computedRole,
        permissions,
        user: activeUser,
        isClerkLive: true,
        publishableKey,
        setPublishableKey,
        clearPublishableKey,
        setRole,
        isAuthModalOpen,
        setIsAuthModalOpen,
        authModalMode,
        setAuthModalMode,
        signOut: handleSignOut,
        isSignedIn: !!isSignedIn,
        orgRole: rawOrgRole,
        formattedOrgRole: formatClerkOrgRoleName(rawOrgRole),
        isOrgOwner,
        organization: organizationSummary,
        hasPermission,
        simulationActive,
        resetToLiveRole,
      }}
    >
      {children}
    </ClerkRbacContext.Provider>
  );
};

/**
 * Fallback Provider when no live Publishable Key is entered or when testing in sandbox.
 * Accurately models Clerk organization roles and permissions.
 */
const FallbackClerkProvider: React.FC<{
  children: React.ReactNode;
  publishableKey: string;
  setPublishableKey: (key: string) => void;
  clearPublishableKey: () => void;
  isAuthModalOpen: boolean;
  setIsAuthModalOpen: (open: boolean) => void;
  authModalMode: 'signin' | 'signup' | 'settings';
  setAuthModalMode: (mode: 'signin' | 'signup' | 'settings') => void;
}> = ({
  children,
  publishableKey,
  setPublishableKey,
  clearPublishableKey,
  isAuthModalOpen,
  setIsAuthModalOpen,
  authModalMode,
  setAuthModalMode,
}) => {
  const [role, setRoleState] = useState<UserRole>(() => {
    return (localStorage.getItem(CLERK_SIMULATED_ROLE_KEY) as UserRole) || 'OWNER';
  });

  const [isSignedIn, setIsSignedIn] = useState<boolean>(true);

  const setRole = useCallback((newRole: UserRole) => {
    setRoleState(newRole);
    localStorage.setItem(CLERK_SIMULATED_ROLE_KEY, newRole);
  }, []);

  const resetToLiveRole = useCallback(() => {
    setRoleState('OWNER');
    localStorage.removeItem(CLERK_SIMULATED_ROLE_KEY);
  }, []);

  // When unauthenticated, strictly restrict to VIEWER
  const effectiveRole: UserRole = isSignedIn ? role : 'VIEWER';
  const permissions = useMemo(() => ROLE_PERMISSIONS[effectiveRole], [effectiveRole]);

  const activeUser = useMemo(() => {
    if (!isSignedIn) return null;
    return DEMO_PERSONAS[effectiveRole];
  }, [isSignedIn, effectiveRole]);

  const rawOrgRole = useMemo(() => {
    switch (effectiveRole) {
      case 'OWNER':
        return 'org:owner';
      case 'ADMIN':
        return 'org:admin';
      case 'EDITOR':
        return 'org:member';
      case 'VIEWER':
        return 'org:viewer';
      default:
        return 'org:member';
    }
  }, [effectiveRole]);

  const orgSummary: ClerkOrganizationSummary = useMemo(
    () => ({
      id: 'org_flowforge_dev',
      name: 'FlowForge Engineering (Sandbox)',
      slug: 'flowforge-engineering',
      membersCount: 4,
    }),
    []
  );

  const hasPermission = useCallback(
    (permission: RbacPermission) => checkRolePermission(effectiveRole, permission),
    [effectiveRole]
  );

  const handleSignOut = useCallback(async () => {
    setIsSignedIn(false);
  }, []);

  return (
    <ClerkRbacContext.Provider
      value={{
        role: effectiveRole,
        permissions,
        user: activeUser,
        isClerkLive: false,
        publishableKey,
        setPublishableKey,
        clearPublishableKey,
        setRole,
        isAuthModalOpen,
        setIsAuthModalOpen,
        authModalMode,
        setAuthModalMode,
        signOut: handleSignOut,
        isSignedIn,
        orgRole: rawOrgRole,
        formattedOrgRole: formatClerkOrgRoleName(rawOrgRole),
        isOrgOwner: effectiveRole === 'OWNER',
        organization: orgSummary,
        hasPermission,
        simulationActive: false,
        resetToLiveRole,
      }}
    >
      {children}
    </ClerkRbacContext.Provider>
  );
};

/**
 * Main ClerkRbacProvider wrapper. Mounts LiveClerkBridge inside ClerkProvider
 * if a valid publishableKey is available, or FallbackClerkProvider otherwise.
 */
export const ClerkRbacProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const envKey = (import.meta as any).env?.VITE_CLERK_PUBLISHABLE_KEY || '';
  const [publishableKey, setPublishableKeyState] = useState<string>(() => {
    return localStorage.getItem(CLERK_STORAGE_KEY) || envKey || '';
  });

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'signin' | 'signup' | 'settings'>('signin');

  const setPublishableKey = useCallback((key: string) => {
    const trimmed = key.trim();
    setPublishableKeyState(trimmed);
    localStorage.setItem(CLERK_STORAGE_KEY, trimmed);
  }, []);

  const clearPublishableKey = useCallback(() => {
    setPublishableKeyState('');
    localStorage.removeItem(CLERK_STORAGE_KEY);
  }, []);

  // Validate if the key looks like a valid Clerk key: pk_test_... or pk_live_...
  const isValidClerkKey = useMemo(() => {
    return (
      publishableKey.startsWith('pk_test_') ||
      publishableKey.startsWith('pk_live_')
    );
  }, [publishableKey]);

  if (isValidClerkKey) {
    return (
      <ClerkProvider publishableKey={publishableKey}>
        <LiveClerkBridge
          publishableKey={publishableKey}
          setPublishableKey={setPublishableKey}
          clearPublishableKey={clearPublishableKey}
          isAuthModalOpen={isAuthModalOpen}
          setIsAuthModalOpen={setIsAuthModalOpen}
          authModalMode={authModalMode}
          setAuthModalMode={setAuthModalMode}
        >
          {children}
        </LiveClerkBridge>
      </ClerkProvider>
    );
  }

  return (
    <FallbackClerkProvider
      publishableKey={publishableKey}
      setPublishableKey={setPublishableKey}
      clearPublishableKey={clearPublishableKey}
      isAuthModalOpen={isAuthModalOpen}
      setIsAuthModalOpen={setIsAuthModalOpen}
      authModalMode={authModalMode}
      setAuthModalMode={setAuthModalMode}
    >
      {children}
    </FallbackClerkProvider>
  );
};

export const useClerkRbac = () => {
  const context = useContext(ClerkRbacContext);
  if (!context) {
    throw new Error('useClerkRbac must be used within a ClerkRbacProvider');
  }
  return context;
};
