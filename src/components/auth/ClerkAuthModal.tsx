import React, { useState } from 'react';
import {
  X,
  Shield,
  Key,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Eye,
  UserCheck,
  Crown,
  Sparkles,
  ExternalLink,
  RefreshCw,
  LogOut,
  Sliders,
  Check,
  Building,
  Users,
  Layers,
  ArrowRight,
  Info,
} from 'lucide-react';
import { useClerkRbac, DEMO_PERSONAS } from '../../context/ClerkRbacContext';
import { UserRole } from '../../types/workflow';
import { ROLE_PERMISSIONS } from '../../types/rbac';
import { CLERK_ROLE_MAPPING_MATRIX } from '../../utils/clerkOrgRoleMapper';

export const ClerkAuthModal: React.FC = () => {
  const {
    isAuthModalOpen,
    setIsAuthModalOpen,
    authModalMode,
    setAuthModalMode,
    isClerkLive,
    publishableKey,
    setPublishableKey,
    clearPublishableKey,
    role,
    setRole,
    user,
    signOut,
    isSignedIn,
    orgRole,
    formattedOrgRole,
    isOrgOwner,
    organization,
    simulationActive,
    resetToLiveRole,
  } = useClerkRbac();

  const [inputKey, setInputKey] = useState(publishableKey);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<'switcher' | 'mapping' | 'settings'>('switcher');

  if (!isAuthModalOpen) return null;

  const handleSaveKey = (e: React.FormEvent) => {
    e.preventDefault();
    setPublishableKey(inputKey);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const rolesList: { role: UserRole; title: string; desc: string; icon: any; color: string; clerkSlug: string }[] = [
    {
      role: 'OWNER',
      title: 'Owner',
      clerkSlug: 'org:owner',
      desc: 'Full workspace authority: billing, RBAC assignments, publish, and delete.',
      icon: Crown,
      color: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
    },
    {
      role: 'ADMIN',
      title: 'Admin',
      clerkSlug: 'org:admin',
      desc: 'Publish workflows, manage members, configure integrations, and review audit logs.',
      icon: Shield,
      color: 'text-violet-500 bg-violet-500/10 border-violet-500/20',
    },
    {
      role: 'EDITOR',
      title: 'Editor',
      clerkSlug: 'org:member',
      desc: 'Build workflows, edit canvas nodes, test runs, and manage test triggers.',
      icon: Sliders,
      color: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
    },
    {
      role: 'VIEWER',
      title: 'Viewer',
      clerkSlug: 'org:viewer',
      desc: 'Read-only inspection. Cannot edit canvas, trigger executions, or publish.',
      icon: Eye,
      color: 'text-slate-400 bg-slate-500/10 border-slate-500/20',
    },
  ];

  const currentPermissions = ROLE_PERMISSIONS[role];

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 select-none animate-in fade-in duration-200"
      onClick={() => setIsAuthModalOpen(false)}
    >
      <div
        className="w-full max-w-2xl bg-white dark:bg-[#0c101b] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800/80 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/40">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-violet-500/20">
              <Shield className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Clerk Authentication & RBAC
                </h2>
                {isClerkLive ? (
                  <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Live Clerk Connected
                  </span>
                ) : (
                  <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                    Clerk Sandbox Mode
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Clerk Organization roles dynamically mapped to FlowForge permissions
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsAuthModalOpen(false)}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-800/80 bg-slate-50/20 dark:bg-slate-900/20 px-4 sm:px-5">
          <button
            onClick={() => setActiveTab('switcher')}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === 'switcher'
                ? 'border-violet-600 text-violet-600 dark:text-violet-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            RBAC Role Switcher
          </button>
          <button
            onClick={() => setActiveTab('mapping')}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === 'mapping'
                ? 'border-violet-600 text-violet-600 dark:text-violet-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            Org Role Mapping Matrix
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === 'settings'
                ? 'border-violet-600 text-violet-600 dark:text-violet-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            Clerk API Key Settings
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {/* TAB 1: RBAC ROLE SWITCHER */}
          {activeTab === 'switcher' && (
            <div className="space-y-5">
              {/* Organization & Active User Header Card */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  {user?.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt={user.name}
                      className="w-11 h-11 rounded-full object-cover border-2 border-violet-500/30 shadow-sm"
                    />
                  ) : (
                    <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center text-white font-bold text-sm">
                      {user?.name?.slice(0, 2).toUpperCase() || 'FF'}
                    </div>
                  )}

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-slate-900 dark:text-white">
                        {user?.name || 'Guest User'}
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-violet-50 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800">
                        {role}
                      </span>
                      {isOrgOwner && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center gap-1">
                          <Crown className="w-2.5 h-2.5" /> Org Creator
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                      <span>{user?.email || 'unauthenticated'}</span>
                      {organization && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1 text-slate-600 dark:text-slate-400 font-medium">
                            <Building className="w-3 h-3 text-violet-500" />
                            {organization.name}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {simulationActive && (
                    <button
                      onClick={resetToLiveRole}
                      className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20 hover:bg-violet-500/20 transition-colors"
                      title="Reset simulation to actual Clerk role"
                    >
                      Restore Live Role ({formattedOrgRole})
                    </button>
                  )}
                  {isSignedIn && (
                    <button
                      onClick={() => signOut()}
                      className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-rose-500 hover:border-rose-500/30 transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      Sign Out
                    </button>
                  )}
                </div>
              </div>

              {/* Role Selection Grid */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Select Active Persona / Role
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Maps directly to Clerk Organization Claims
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {rolesList.map((item) => {
                    const isCurrent = role === item.role;
                    const Icon = item.icon;

                    return (
                      <div
                        key={item.role}
                        onClick={() => setRole(item.role)}
                        className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                          isCurrent
                            ? 'border-violet-600 bg-violet-50/50 dark:bg-violet-950/20 shadow-xs'
                            : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900/60'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className={`p-1.5 rounded-lg border ${item.color}`}>
                              <Icon className="w-4 h-4" />
                            </div>
                            <div>
                              <span className="font-bold text-xs text-slate-900 dark:text-white block">
                                {item.title}
                              </span>
                              <span className="text-[10px] font-mono text-slate-400">
                                maps {item.clerkSlug}
                              </span>
                            </div>
                          </div>

                          {isCurrent && (
                            <div className="w-5 h-5 rounded-full bg-violet-600 flex items-center justify-center text-white">
                              <Check className="w-3 h-3 stroke-[2.5]" />
                            </div>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 line-clamp-2">
                          {item.desc}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Live Permission Matrix for selected role */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/30">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Enforced Permissions for <span className="text-violet-600 dark:text-violet-400">{role}</span>:
                  </span>
                  <span className="text-[10px] text-slate-500">Enforced by Clerk RBAC</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-2 text-[11px]">
                    {currentPermissions.canViewWorkflows ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    ) : (
                      <Lock className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                    )}
                    <span className={currentPermissions.canViewWorkflows ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400'}>
                      View Workflows & Canvas
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-[11px]">
                    {currentPermissions.canEditWorkflows ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    ) : (
                      <Lock className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                    )}
                    <span className={currentPermissions.canEditWorkflows ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400'}>
                      Create & Edit Workflows
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-[11px]">
                    {currentPermissions.canRunWorkflows ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    ) : (
                      <Lock className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                    )}
                    <span className={currentPermissions.canRunWorkflows ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400'}>
                      Trigger Manual Runs
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-[11px]">
                    {currentPermissions.canPublishWorkflows ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    ) : (
                      <Lock className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                    )}
                    <span className={currentPermissions.canPublishWorkflows ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400'}>
                      Publish Production Workflows
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-[11px]">
                    {currentPermissions.canManageIntegrations ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    ) : (
                      <Lock className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                    )}
                    <span className={currentPermissions.canManageIntegrations ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400'}>
                      Manage Integrations & Secrets
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-[11px]">
                    {currentPermissions.canManageMembers ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    ) : (
                      <Lock className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                    )}
                    <span className={currentPermissions.canManageMembers ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400'}>
                      Assign Roles & Team Members
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CLERK ORG ROLE MAPPING MATRIX */}
          {activeTab === 'mapping' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-violet-500/20 bg-violet-500/5 text-xs text-slate-700 dark:text-slate-300 flex items-start gap-3">
                <Info className="w-4 h-4 text-violet-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-slate-900 dark:text-white block">
                    Automatic Clerk Organization Role Translation
                  </span>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                    FlowForge inspects the authenticated user’s active Clerk organization membership, organization creator ID, and JWT claims to map standard Clerk roles directly into the internal <code className="text-violet-500 font-mono">UserRole</code> enum.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {CLERK_ROLE_MAPPING_MATRIX.map((item) => (
                  <div
                    key={item.flowForgeRole}
                    className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-2xs space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                          {item.clerkOrgRole}
                        </span>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-md border ${item.badgeColor}`}>
                          {item.flowForgeRole} ({item.title})
                        </span>
                      </div>
                      {role === item.flowForgeRole && (
                        <span className="text-[10px] font-semibold text-violet-600 dark:text-violet-400 flex items-center gap-1">
                          <Check className="w-3 h-3" /> Active Role
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {item.description}
                    </p>

                    <div className="pt-1">
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-1.5">
                        Allowed Capabilities:
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[11px]">
                        {item.capabilities.map((cap, idx) => (
                          <div key={idx} className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-violet-500 shrink-0" />
                            <span>{cap}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: CLERK API KEY SETTINGS */}
          {activeTab === 'settings' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-violet-50 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400 shrink-0">
                    <Key className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                      Clerk Publishable Key
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Enter your Clerk project Publishable Key (<code className="text-violet-500 font-mono">pk_test_...</code> or <code className="text-violet-500 font-mono">pk_live_...</code>) from your Clerk Dashboard to activate live OAuth, multi-tenant organizations, and SSO.
                    </p>
                  </div>
                </div>

                <form onSubmit={handleSaveKey} className="mt-4 space-y-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Publishable Key (VITE_CLERK_PUBLISHABLE_KEY)
                    </label>
                    <input
                      type="text"
                      value={inputKey}
                      onChange={(e) => setInputKey(e.target.value)}
                      placeholder="pk_test_y2xlcms..."
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-mono focus:outline-none focus:ring-2 focus:ring-violet-500"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-2">
                      <button
                        type="submit"
                        className="px-4 py-2 text-xs font-semibold rounded-lg bg-violet-600 hover:bg-violet-500 text-white shadow-sm shadow-violet-500/20 transition-all cursor-pointer"
                      >
                        Save & Connect Clerk
                      </button>
                      {publishableKey && (
                        <button
                          type="button"
                          onClick={() => {
                            clearPublishableKey();
                            setInputKey('');
                          }}
                          className="px-3 py-2 text-xs font-semibold rounded-lg border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                        >
                          Disconnect Key
                        </button>
                      )}
                    </div>

                    {saveSuccess && (
                      <span className="text-xs text-emerald-500 font-medium flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> Key saved successfully!
                      </span>
                    )}
                  </div>
                </form>
              </div>

              {/* Instructions on how Clerk RBAC operates */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800/80 bg-slate-50/30 dark:bg-slate-900/20 text-xs space-y-2">
                <span className="font-bold text-slate-800 dark:text-slate-200 block">
                  How Clerk Organization Roles Work in FlowForge:
                </span>
                <ul className="list-disc list-inside space-y-1 text-slate-500 dark:text-slate-400 text-[11px]">
                  <li>
                    Clerk passes the user's role via <code className="font-mono text-violet-500">organization.membership.role</code> or <code className="font-mono text-violet-500">auth.orgRole</code>.
                  </li>
                  <li>
                    Supported roles: <strong className="text-slate-700 dark:text-slate-300">OWNER</strong>, <strong className="text-slate-700 dark:text-slate-300">ADMIN</strong>, <strong className="text-slate-700 dark:text-slate-300">EDITOR</strong>, and <strong className="text-slate-700 dark:text-slate-300">VIEWER</strong>.
                  </li>
                  <li>
                    FlowForge enforces these roles across canvas editing, workflow publishing, API execution triggers, and team administration.
                  </li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/40 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-slate-500">
            <Shield className="w-4 h-4 text-violet-500" />
            <span>Active Role: <strong className="text-slate-800 dark:text-slate-200">{role}</strong></span>
            {orgRole && (
              <span className="text-[10px] text-slate-400 font-mono">({orgRole})</span>
            )}
          </div>
          <button
            onClick={() => setIsAuthModalOpen(false)}
            className="px-4 py-1.5 font-semibold rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
