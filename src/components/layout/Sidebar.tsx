import React, { useState } from 'react';
import {
  Workflow as WorkflowIcon,
  LayoutDashboard,
  GitBranch,
  PlayCircle,
  Layers,
  Database,
  BarChart3,
  Users,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Command,
  Plus,
  CheckCircle2,
  ChevronsUpDown,
  Building,
  Radio,
  FileCode,
} from 'lucide-react';
import { ActiveTab } from './Header';
import { UserRole } from '../../types/workflow';
import { useClerkRbac } from '../../context/ClerkRbacContext';

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  activeWorkflowName?: string;
  isCollapsed: boolean;
  setIsCollapsed: (val: boolean) => void;
  onOpenAiModal: () => void;
  onOpenCommandPalette: () => void;
  currentUserRole: UserRole;
  setCurrentUserRole: (role: UserRole) => void;
  workflowsCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  activeWorkflowName,
  isCollapsed,
  setIsCollapsed,
  onOpenAiModal,
  onOpenCommandPalette,
  currentUserRole,
  setCurrentUserRole,
  workflowsCount,
}) => {
  const { user, role, setRole, isClerkLive, setIsAuthModalOpen } = useClerkRbac();
  const [workspaceName] = useState('Acme Flow Engineering');
  const [isWorkspaceMenuOpen, setIsWorkspaceMenuOpen] = useState(false);

  const navItems = [
    {
      id: 'dashboard' as ActiveTab,
      label: 'Dashboard',
      icon: LayoutDashboard,
      badge: undefined,
    },
    {
      id: 'workflows' as ActiveTab,
      label: 'Workflows',
      icon: GitBranch,
      badge: workflowsCount > 0 ? String(workflowsCount) : undefined,
    },
    {
      id: 'executions' as ActiveTab,
      label: 'Executions',
      icon: PlayCircle,
      badge: 'Live',
    },
    {
      id: 'templates' as ActiveTab,
      label: 'Templates',
      icon: Layers,
      badge: '12',
    },
    {
      id: 'integrations' as ActiveTab,
      label: 'Integrations & DB',
      icon: Database,
      badge: undefined,
    },
    {
      id: 'analytics' as ActiveTab,
      label: 'Analytics',
      icon: BarChart3,
      badge: undefined,
    },
    {
      id: 'workspace' as ActiveTab,
      label: 'Workspace & RBAC',
      icon: Users,
      badge: undefined,
    },
  ];

  return (
    <aside
      className={`relative flex flex-col shrink-0 border-r border-slate-200 dark:border-slate-800/80 bg-white/95 dark:bg-[#0b0f19] transition-all duration-200 ease-in-out select-none z-30 ${
        isCollapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Workspace Switcher / Brand Header */}
      <div className="h-14 border-b border-slate-200 dark:border-slate-800/80 px-3 flex items-center justify-between">
        <div
          onClick={() => !isCollapsed && setIsWorkspaceMenuOpen(!isWorkspaceMenuOpen)}
          className={`flex items-center gap-2.5 min-w-0 cursor-pointer p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors ${
            isCollapsed ? 'justify-center w-full' : ''
          }`}
          title={workspaceName}
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-violet-600 via-indigo-600 to-cyan-500 flex items-center justify-center text-white shadow-md shadow-violet-500/20 shrink-0">
            <WorkflowIcon className="w-4 h-4 stroke-[2.4]" />
          </div>

          {!isCollapsed && (
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-xs tracking-tight text-slate-900 dark:text-slate-100 truncate">
                  {workspaceName}
                </span>
                <ChevronsUpDown className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1" />
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                  Production • {currentUserRole}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quick Search / Command Palette Trigger */}
      <div className="px-3 pt-3">
        <button
          onClick={onOpenCommandPalette}
          className={`w-full flex items-center rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700 transition-colors text-xs ${
            isCollapsed ? 'justify-center p-2' : 'px-3 py-2 justify-between'
          }`}
          title="Command Palette (Cmd+K)"
        >
          <div className="flex items-center gap-2">
            <Command className="w-3.5 h-3.5 text-violet-500" />
            {!isCollapsed && <span>Quick search...</span>}
          </div>
          {!isCollapsed && (
            <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-300 dark:border-slate-700">
              ⌘K
            </kbd>
          )}
        </button>
      </div>

      {/* Primary Navigation List */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-2 py-1">
          {!isCollapsed && 'Platform'}
        </div>

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center rounded-lg text-xs font-medium transition-all group cursor-pointer ${
                isCollapsed ? 'justify-center p-2.5' : 'px-3 py-2 justify-between'
              } ${
                isActive
                  ? 'bg-violet-600 text-white shadow-sm shadow-violet-600/30'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/60'
              }`}
              title={isCollapsed ? item.label : undefined}
            >
              <div className="flex items-center gap-2.5">
                <Icon
                  className={`w-4 h-4 shrink-0 transition-colors ${
                    isActive ? 'text-white' : 'text-slate-500 dark:text-slate-400 group-hover:text-violet-500'
                  }`}
                />
                {!isCollapsed && <span>{item.label}</span>}
              </div>

              {!isCollapsed && item.badge && (
                <span
                  className={`text-[10px] font-semibold px-1.5 py-0.2 rounded-full ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : item.badge === 'Live'
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}

        {/* Active Canvas Editor Link (if a workflow is open) */}
        {activeWorkflowName && (
          <div className="pt-2">
            {!isCollapsed && (
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-2 py-1">
                Active Canvas
              </div>
            )}
            <button
              onClick={() => setActiveTab('editor')}
              className={`w-full flex items-center rounded-lg text-xs font-medium transition-all cursor-pointer ${
                isCollapsed ? 'justify-center p-2.5' : 'px-3 py-2 justify-between'
              } ${
                activeTab === 'editor'
                  ? 'bg-violet-600 text-white shadow-sm shadow-violet-600/30'
                  : 'border border-violet-500/30 bg-violet-500/5 text-violet-700 dark:text-violet-300 hover:bg-violet-500/10'
              }`}
              title={activeWorkflowName}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Radio className={`w-4 h-4 shrink-0 text-violet-500 animate-pulse ${activeTab === 'editor' ? 'text-white' : ''}`} />
                {!isCollapsed && <span className="truncate">{activeWorkflowName}</span>}
              </div>
            </button>
          </div>
        )}
      </div>

      {/* AI Assistant Banner / Button */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-800/80">
        <button
          onClick={onOpenAiModal}
          className={`w-full flex items-center justify-center gap-2 rounded-lg py-2 px-3 text-xs font-semibold bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-sm shadow-violet-500/20 transition-all cursor-pointer active:scale-98`}
          title="AI Workflow Architect"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse shrink-0" />
          {!isCollapsed && <span>AI Architect</span>}
        </button>
      </div>

      {/* Clerk User Profile & RBAC indicator */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-between gap-2 bg-slate-50/50 dark:bg-slate-900/40">
        <div
          onClick={() => setIsAuthModalOpen(true)}
          className={`flex items-center gap-2.5 min-w-0 cursor-pointer group hover:opacity-90 transition-opacity ${
            isCollapsed ? 'justify-center w-full' : ''
          }`}
          title="Manage Clerk Authentication & RBAC Role"
        >
          {user?.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user.name}
              className="w-7 h-7 rounded-full object-cover border border-violet-500/40 shrink-0 shadow-sm"
            />
          ) : (
            <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center text-[10px] font-bold text-white shrink-0 shadow-sm">
              {user?.name?.slice(0, 2).toUpperCase() || 'FF'}
            </div>
          )}

          {!isCollapsed && (
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
                  {user?.name || 'Clerk User'}
                </span>
                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20 shrink-0">
                  {role}
                </span>
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-violet-500 shrink-0" />
                <span>{isClerkLive ? 'Clerk Live' : 'Clerk RBAC'}</span>
              </div>
            </div>
          )}
        </div>

        {!isCollapsed && (
          <button
            onClick={() => setIsCollapsed(true)}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors shrink-0"
            title="Collapse sidebar"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Expand button when collapsed */}
      {isCollapsed && (
        <button
          onClick={() => setIsCollapsed(false)}
          className="absolute -right-3 top-16 w-6 h-6 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-md flex items-center justify-center text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-transform hover:scale-110 z-40"
          title="Expand sidebar"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      )}
    </aside>
  );
};
