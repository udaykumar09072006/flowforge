import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AuthUser, AuthSession, WorkspaceMembershipInfo } from '../types/auth';

interface AuthContextType {
  user: AuthUser | null;
  session: AuthSession | null;
  workspaces: WorkspaceMembershipInfo[];
  activeWorkspaceId: string;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signup: (
    name: string,
    email: string,
    password: string,
    confirmPassword: string
  ) => Promise<{ success: boolean; error?: string; verificationToken?: string }>;
  logout: () => Promise<void>;
  forgotPassword: (email: string) => Promise<{ success: boolean; message: string; debugResetToken?: string }>;
  resetPassword: (
    token: string,
    password: string,
    confirmPassword: string
  ) => Promise<{ success: boolean; error?: string; message?: string }>;
  verifyEmail: (token: string) => Promise<{ success: boolean; error?: string; message?: string }>;
  resendVerification: () => Promise<{ success: boolean; message: string; verificationToken?: string }>;
  switchWorkspace: (workspaceId: string) => void;
  quickDemoLogin: (email: string) => Promise<boolean>;
  refreshCurrentUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [workspaces, setWorkspaces] = useState<WorkspaceMembershipInfo[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>('ws_default');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Fetch current user from /api/v1/auth/me using credentials: 'include'
  const refreshCurrentUser = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/auth/me', {
        credentials: 'include',
        headers: { 'Accept': 'application/json' },
      });

      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setSession(data.session);
        setWorkspaces(data.workspaces || []);
        if (data.activeWorkspaceId) {
          setActiveWorkspaceId(data.activeWorkspaceId);
        }
      } else {
        setUser(null);
        setSession(null);
      }
    } catch (err) {
      console.error('Failed to restore authentication session:', err);
      setUser(null);
      setSession(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshCurrentUser();
  }, [refreshCurrentUser]);

  // Login
  const login = async (email: string, password: string) => {
    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Login failed.' };
      }

      await refreshCurrentUser();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error occurred.' };
    }
  };

  // Sign up
  const signup = async (
    name: string,
    email: string,
    password: string,
    confirmPassword: string
  ) => {
    try {
      const res = await fetch('/api/v1/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name, email, password, confirmPassword }),
      });

      const data = await res.json();
      if (!res.ok) {
        const errorMsg = data.details
          ? Object.values(data.details).flat().join(', ')
          : data.error || 'Sign up failed.';
        return { success: false, error: errorMsg };
      }

      await refreshCurrentUser();
      return {
        success: true,
        verificationToken: data.verificationToken,
      };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error occurred.' };
    }
  };

  // Logout
  const logout = async () => {
    try {
      await fetch('/api/v1/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch (err) {
      console.error('Error during logout:', err);
    } finally {
      setUser(null);
      setSession(null);
    }
  };

  // Forgot password
  const forgotPassword = async (email: string) => {
    try {
      const res = await fetch('/api/v1/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email }),
      });

      const data = await res.json();
      return {
        success: true,
        message:
          data.message ||
          'If an account exists with this email, password reset instructions have been dispatched.',
        debugResetToken: data.debugResetToken,
      };
    } catch (err: any) {
      return {
        success: false,
        message: err.message || 'Failed to dispatch password reset request.',
      };
    }
  };

  // Reset password
  const resetPassword = async (
    token: string,
    password: string,
    confirmPassword: string
  ) => {
    try {
      const res = await fetch('/api/v1/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ token, password, confirmPassword }),
      });

      const data = await res.json();
      if (!res.ok) {
        const errorMsg = data.details
          ? Object.values(data.details).flat().join(', ')
          : data.error || 'Password reset failed.';
        return { success: false, error: errorMsg };
      }

      return { success: true, message: data.message };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error occurred.' };
    }
  };

  // Verify email
  const verifyEmail = async (token: string) => {
    try {
      const res = await fetch('/api/v1/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ token }),
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Verification failed.' };
      }

      await refreshCurrentUser();
      return { success: true, message: data.message };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error occurred.' };
    }
  };

  // Resend verification
  const resendVerification = async () => {
    try {
      const res = await fetch('/api/v1/auth/resend-verification', {
        method: 'POST',
        credentials: 'include',
      });

      const data = await res.json();
      return {
        success: true,
        message: data.message || 'Verification email dispatched.',
        verificationToken: data.verificationToken,
      };
    } catch (err: any) {
      return {
        success: false,
        message: err.message || 'Failed to resend verification email.',
      };
    }
  };

  // Switch active workspace
  const switchWorkspace = (workspaceId: string) => {
    setActiveWorkspaceId(workspaceId);
  };

  // Quick Demo Login for instant testing
  const quickDemoLogin = async (email: string) => {
    const result = await login(email, 'Password123!');
    return result.success;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        workspaces,
        activeWorkspaceId,
        isLoading,
        isAuthenticated: !!user,
        login,
        signup,
        logout,
        forgotPassword,
        resetPassword,
        verifyEmail,
        resendVerification,
        switchWorkspace,
        quickDemoLogin,
        refreshCurrentUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
