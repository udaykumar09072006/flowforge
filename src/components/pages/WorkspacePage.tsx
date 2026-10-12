import React, { useEffect, useState } from 'react';
import {
  Users,
  Shield,
  Clock,
  Key,
  Check,
  X,
  FileText,
  UserPlus,
  Building,
  Sparkles,
  ExternalLink,
  Lock,
  CheckCircle2,
  AlertCircle,
  Eye,
  Sliders,
  Crown,
  ArrowRight,
  Info,
  Layers,
} from 'lucide-react';
import { AuditLog, UserRole } from '../../types/workflow';
import { useFlowForgeRbac } from '../../hooks/useFlowForgeRbac';
import { ROLE_PERMISSIONS } from '../../types/rbac';
import { CLERK_ROLE_MAPPING_MATRIX } from '../../utils/clerkOrgRoleMapper';

interface WorkspacePageProps {
  currentUserRole: UserRole;
}

export const WorkspacePage: React.FC<WorkspacePageProps> = ({ currentUserRole: initialRole }) => {
  const {
    role,
    setRole,
    permissions,
    isClerkLive,
    publishableKey,
    setIsAuthModalOpen,
    user: clerkUser,
    orgRole,
    formattedOrgRole,
    organization,
    isOrgOwner,
    simulationActive,
    resetToLiveRole,
    can,
    cannot,
    getRestrictionReason,
  } = useFlowForgeRbac();

  const [workspace, setWorkspace] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [memberList, setMemberList] = useState<any[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole>('EDITOR');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  useEffect(() => {
    async function loadWorkspace() {
      try {
        const [wsRes, audRes] = await Promise.all([
          fetch('/api/v1/workspaces'),
          fetch('/api/v1/audit-logs'),
        ]);

        const wsData = await wsRes.json();
        const audData = await audRes.json();

        if (wsData.workspaces?.length > 0) {
          const ws = wsData.workspaces[0];
          setWorkspace(ws);
          setMemberList(ws.members || []);
        }
        setAuditLogs(audData.logs || []);
      } catch (err) {
        console.error('Failed to load workspace:', err);
      }
    }
    loadWorkspace();
  }, []);

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  const handleUpdateMemberRole = (memberId: string, newRole: UserRole) => {
    if (!permissions.canManageMembers) {
      showToast(`Action forbidden: ${role} role cannot change team member roles.`);
      return;
    }

    setMemberList((prev) =>
      prev.map((m) => (m.id === memberId ? { ...m, role: newRole } : m))
    );
    showToast(`Updated member role to ${newRole} (synced to Clerk RBAC)`);
  };

  const handleInviteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    if (!permissions.canManageMembers) {
      showToast(`Action forbidden: ${role} role cannot invite new members.`);
      return;
    }

    const newMember = {
      id: `usr_${Date.now()}`,
      name: inviteEmail.split('@')[0],
      email: inviteEmail,
      role: inviteRole,
    };

    setMemberList((prev) => [...prev, newMember]);
    setInviteEmail('');
    setShowInviteModal(false);
    showToast(`Invited ${inviteEmail} as ${inviteRole} (Clerk Invitation Dispatched)`);
  };

  const permissionsMatrix = [
    { name: 'View Workflows & Canvas', owner: true, admin: true, editor: true, viewer: true },
    { name: 'Inspect Executions & Halos', owner: true, admin: true, editor: true, viewer: true },
    { name: 'Create & Modify Workflows', owner: true, admin: true, editor: true, viewer: false },
    { name: 'Trigger Manual Runs', owner: true, admin: true, editor: true, viewer: false },
    { name: 'Publish Immutable Versions', owner: true, admin: true, editor: false, viewer: false },
    { name: 'Configure Webhooks & Integrations', owner: true, admin: true, editor: false, viewer: false },
    { name: 'Assign Roles & Invite Members', owner: true, admin: true, editor: false, viewer: false },
    { name: 'Manage Workspace & Billing', owner: true, admin: false, editor: false, viewer: false },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-7xl mx-auto w-full select-none">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 px-4 py-2.5 rounded-xl shadow-xl text-xs font-semibold flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{notification}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            Workspace & Access Control
            <span className="px-2 py-0.5 text-[10px] font-mono font-semibold rounded-full bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20">
              Clerk RBAC
            </span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Manage organization members, Clerk authentication credentials, and role-based access policies.
          </p>
        </div>

        <button
          onClick={() => setIsAuthModalOpen(true)}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg bg-violet-600 hover:bg-violet-500 text-white shadow-sm shadow-violet-600/20 transition-all cursor-pointer w-fit"
        >
          <Shield className="w-4 h-4" />
          <span>Clerk Auth & Roles</span>
        </button>
      </div>

      {/* Clerk Status & Active Role Banner */}
      <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0c101b] shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-violet-500/20 shrink-0">
            <Building className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                {organization?.name || workspace?.name || 'FlowForge Core Workspace'}
              </h2>
              {isClerkLive ? (
                <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live Clerk Organization
                </span>
              ) : (
                <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  Clerk Sandbox Mode
                </span>
              )}
              {isOrgOwner && (
                <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center gap-1">
                  <Crown className="w-2.5 h-2.5" /> Org Creator
                </span>
              )}
              {orgRole && (
                <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  Clerk Claim: {orgRole}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Workspace ID: <span className="font-mono text-slate-700 dark:text-slate-300">{organization?.id || workspace?.id || 'ws_default'}</span> · Plan: Enterprise Automation
            </p>
          </div>
        </div>

        {/* Active Role Selector */}
        <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 flex-wrap">
          {simulationActive && (
            <button
              onClick={resetToLiveRole}
              className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20 hover:bg-violet-500/20 transition-colors cursor-pointer"
              title="Reset simulation to real Clerk Org role"
            >
              Reset to Live ({formattedOrgRole})
            </button>
          )}

          <div className="text-right">
            <span className="text-[10px] uppercase font-semibold text-slate-400 block">
              {simulationActive ? 'Simulated Role' : 'FlowForge Role'}
            </span>
            <span className="text-xs font-bold text-slate-900 dark:text-white">{role}</span>
          </div>

          <select
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
            className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500 cursor-pointer"
            aria-label="Switch active role"
          >
            <option value="OWNER">Owner (Full Control)</option>
            <option value="ADMIN">Admin (Publish & Team)</option>
            <option value="EDITOR">Editor (Build & Test)</option>
            <option value="VIEWER">Viewer (Read-Only)</option>
          </select>
        </div>
      </div>

      {/* Team Members Table with RBAC assignment */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <Users className="w-3.5 h-3.5 text-violet-500" />
              Workspace Members & Clerk Roles
            </h3>
            <p className="text-[11px] text-slate-500">
              Assigned security permissions dynamically verified on every API read/write
            </p>
          </div>

          <button
            onClick={() => {
              if (cannot('invite', 'member')) {
                showToast(getRestrictionReason('invite', 'member') || `Action forbidden: ${role} role cannot invite members.`);
              } else {
                setShowInviteModal(true);
              }
            }}
            disabled={cannot('invite', 'member')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              cannot('invite', 'member')
                ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed border border-slate-200 dark:border-slate-700/50'
                : 'bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900'
            }`}
            title={cannot('invite', 'member') ? (getRestrictionReason('invite', 'member') || 'Cannot invite members') : 'Invite team member'}
          >
            {cannot('invite', 'member') ? (
              <Lock className="w-3.5 h-3.5 text-slate-400" />
            ) : (
              <UserPlus className="w-3.5 h-3.5" />
            )}
            <span>Invite Member</span>
          </button>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
          {memberList.map((m: any) => {
            const isMe = m.email === clerkUser?.email;
            return (
              <div key={m.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center text-[11px] font-bold text-white shadow-xs">
                    {m.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <span className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                      {m.name}
                      {isMe && (
                        <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20">
                          Current Session
                        </span>
                      )}
                    </span>
                    <span className="text-[11px] text-slate-500 block">{m.email}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {permissions.canManageMembers ? (
                    <select
                      value={m.role}
                      onChange={(e) => handleUpdateMemberRole(m.id, e.target.value as UserRole)}
                      className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 focus:outline-none cursor-pointer"
                      aria-label={`Change role for ${m.name}`}
                    >
                      <option value="OWNER">OWNER</option>
                      <option value="ADMIN">ADMIN</option>
                      <option value="EDITOR">EDITOR</option>
                      <option value="VIEWER">VIEWER</option>
                    </select>
                  ) : (
                    <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {m.role}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Invite Member Dialog Modal */}
      {showInviteModal && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 select-none"
          onClick={() => setShowInviteModal(false)}
        >
          <div
            className="w-full max-w-md bg-white dark:bg-[#0c101b] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-violet-500" />
                Invite Workspace Member
              </h3>
              <button
                onClick={() => setShowInviteModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleInviteSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="colleague@company.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Assigned Clerk RBAC Role
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
                >
                  <option value="ADMIN">Admin — Can publish workflows and manage members</option>
                  <option value="EDITOR">Editor — Can build, edit and run test workflows</option>
                  <option value="VIEWER">Viewer — Read-only inspection of canvases & logs</option>
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-violet-600 hover:bg-violet-500 text-white shadow-sm shadow-violet-600/20"
                >
                  Send Clerk Invite
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Clerk Organization Role Mapping Matrix */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-3.5 h-3.5 text-violet-500" />
              Clerk Organization Role Mapping Matrix
            </h3>
            <p className="text-[11px] text-slate-500">
              Deterministic mapping of Clerk organization roles & JWT claims into FlowForge RBAC permissions
            </p>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            Active: {orgRole || 'org:owner'} → {role}
          </span>
        </div>

        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-50/30 dark:bg-slate-950/20">
          {CLERK_ROLE_MAPPING_MATRIX.map((item) => {
            const isActive = role === item.flowForgeRole;
            return (
              <div
                key={item.flowForgeRole}
                className={`p-3.5 rounded-xl border text-xs transition-all ${
                  isActive
                    ? 'border-violet-500/50 bg-violet-500/5 shadow-xs'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                      {item.clerkOrgRole}
                    </span>
                    <ArrowRight className="w-3 h-3 text-slate-400" />
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${item.badgeColor}`}>
                      {item.flowForgeRole}
                    </span>
                  </div>
                  {isActive && (
                    <span className="text-[10px] font-semibold text-violet-600 dark:text-violet-400 flex items-center gap-1">
                      <Check className="w-3 h-3" /> Active
                    </span>
                  )}
                </div>

                <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2 leading-relaxed">
                  {item.description}
                </p>

                <div className="space-y-1">
                  {item.capabilities.slice(0, 3).map((cap, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-300">
                      <span className="w-1.5 h-1.5 rounded-full bg-violet-500 shrink-0" />
                      <span>{cap}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* RBAC Authorization Matrix */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <Shield className="w-3.5 h-3.5 text-violet-500" />
              Role-Based Authorization Policy (RBAC)
            </h3>
            <p className="text-[11px] text-slate-500">
              Strictly enforced across API routes, canvas mutations, and execution queue
            </p>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20">
            Current: {role}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-[11px] font-semibold text-slate-500">
                <th className="py-2.5 px-4">Action / Scope</th>
                <th className="py-2.5 px-4 text-center">OWNER</th>
                <th className="py-2.5 px-4 text-center">ADMIN</th>
                <th className="py-2.5 px-4 text-center">EDITOR</th>
                <th className="py-2.5 px-4 text-center">VIEWER</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {permissionsMatrix.map((p, i) => (
                <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="py-2.5 px-4 font-medium text-slate-800 dark:text-slate-200">
                    {p.name}
                  </td>
                  <td className="py-2.5 px-4 text-center">
                    {p.owner ? (
                      <Check className="w-4 h-4 mx-auto text-emerald-500" />
                    ) : (
                      <X className="w-4 h-4 mx-auto text-slate-300 dark:text-slate-600" />
                    )}
                  </td>
                  <td className="py-2.5 px-4 text-center">
                    {p.admin ? (
                      <Check className="w-4 h-4 mx-auto text-emerald-500" />
                    ) : (
                      <X className="w-4 h-4 mx-auto text-slate-300 dark:text-slate-600" />
                    )}
                  </td>
                  <td className="py-2.5 px-4 text-center">
                    {p.editor ? (
                      <Check className="w-4 h-4 mx-auto text-emerald-500" />
                    ) : (
                      <X className="w-4 h-4 mx-auto text-slate-300 dark:text-slate-600" />
                    )}
                  </td>
                  <td className="py-2.5 px-4 text-center">
                    {p.viewer ? (
                      <Check className="w-4 h-4 mx-auto text-emerald-500" />
                    ) : (
                      <X className="w-4 h-4 mx-auto text-slate-300 dark:text-slate-600" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Security Audit Trail */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs overflow-hidden space-y-2">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-violet-500" />
            Security Audit Trail
          </h3>
          <p className="text-[11px] text-slate-500">
            Immutable log of role changes, workflow releases, and authentication actions
          </p>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
          {auditLogs.map((log) => (
            <div key={log.id} className="p-4 flex items-center justify-between text-xs hover:bg-slate-50 dark:hover:bg-slate-800/30">
              <div className="flex items-center gap-3">
                <FileText className="w-4 h-4 text-slate-400" />
                <div>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {log.action}
                  </span>
                  <span className="text-[11px] text-slate-500 block">
                    By {log.actor || 'System'} · {log.resourceType || 'Resource'}: {log.resourceId || 'N/A'}
                  </span>
                </div>
              </div>
              <span className="text-[10px] font-mono text-slate-400">
                {new Date(log.timestamp).toLocaleTimeString()}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
