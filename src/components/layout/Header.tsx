import React from 'react';
import {
  Workflow as WorkflowIcon,
  LayoutDashboard,
  GitBranch,
  PlayCircle,
  FolderKanban,
  Database,
  BarChart3,
  Sparkles,
  Users,
  Sun,
  Moon,
  Radio,
} from 'lucide-react';
import { UserRole } from '../../types/workflow';

export type ActiveTab =
  | 'dashboard'
  | 'workflows'
  | 'editor'
  | 'executions'
  | 'templates'
  | 'integrations'
  | 'analytics'
  | 'workspace';

interface HeaderProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  activeWorkflowName?: string;
  isDarkMode: boolean;
  setIsDarkMode: (val: boolean) => void;
  onOpenAiModal: () => void;
  currentUserRole: UserRole;
  setCurrentUserRole: (role: UserRole) => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  activeWorkflowName,
  isDarkMode,
  setIsDarkMode,
  onOpenAiModal,
  currentUserRole,
  setCurrentUserRole,
}) => {
  return (
    <header className="h-14 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-4 flex items-center justify-between z-30 sticky top-0 select-none">
      {/* Brand & Workspace Info */}
      <div className="flex items-center gap-6">
        <div
          onClick={() => setActiveTab('dashboard')}
          className="flex items-center gap-2.5 cursor-pointer group"
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-600 via-indigo-500 to-amber-500 flex items-center justify-center text-white shadow-sm shadow-indigo-500/20 group-hover:scale-105 transition-transform">
            <WorkflowIcon className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-sm tracking-tight text-slate-900 dark:text-white">
                FlowForge
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.2 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-400 rounded border border-indigo-200 dark:border-indigo-800/60">
                PRO
              </span>
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 hidden sm:block leading-none">
              Visual Workflow Automation
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="hidden md:flex items-center gap-1">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
              activeTab === 'dashboard'
                ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/50'
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            Dashboard
          </button>

          <button
            onClick={() => setActiveTab('workflows')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
              activeTab === 'workflows'
                ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/50'
            }`}
          >
            <GitBranch className="w-3.5 h-3.5" />
            Workflows
          </button>

          {activeWorkflowName && (
            <button
              onClick={() => setActiveTab('editor')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
                activeTab === 'editor'
                  ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 font-semibold border border-indigo-200 dark:border-indigo-800'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/50'
              }`}
            >
              <Radio className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 animate-pulse" />
              Editor: {activeWorkflowName.length > 18 ? `${activeWorkflowName.slice(0, 18)}...` : activeWorkflowName}
            </button>
          )}

          <button
            onClick={() => setActiveTab('executions')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
              activeTab === 'executions'
                ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/50'
            }`}
          >
            <PlayCircle className="w-3.5 h-3.5" />
            Executions
          </button>

          <button
            onClick={() => setActiveTab('templates')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
              activeTab === 'templates'
                ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/50'
            }`}
          >
            <FolderKanban className="w-3.5 h-3.5" />
            Templates
          </button>

          <button
            onClick={() => setActiveTab('integrations')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
              activeTab === 'integrations'
                ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/50'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            Integrations & DB
          </button>

          <button
            onClick={() => setActiveTab('analytics')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
              activeTab === 'analytics'
                ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/50'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            Analytics
          </button>

          <button
            onClick={() => setActiveTab('workspace')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
              activeTab === 'workspace'
                ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/50'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Workspace
          </button>
        </nav>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-2.5">
        {/* AI Architect Action */}
        <button
          onClick={onOpenAiModal}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-600 text-white rounded-md shadow-sm transition-all shadow-indigo-500/20 active:scale-95 cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5 animate-pulse text-amber-300" />
          <span>AI Architect</span>
        </button>

        {/* Role Switcher for Demo */}
        <div className="hidden lg:flex items-center gap-1.5 pl-2 border-l border-slate-200 dark:border-slate-800">
          <span className="text-[11px] text-slate-500">Role:</span>
          <select
            value={currentUserRole}
            onChange={(e) => setCurrentUserRole(e.target.value as UserRole)}
            className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 focus:outline-none cursor-pointer"
          >
            <option value="OWNER">Owner</option>
            <option value="ADMIN">Admin</option>
            <option value="EDITOR">Editor</option>
            <option value="VIEWER">Viewer</option>
          </select>
        </div>

        {/* Theme Toggle */}
        <button
          onClick={() => setIsDarkMode(!isDarkMode)}
          aria-label="Toggle theme"
          className="w-8 h-8 rounded-md flex items-center justify-center text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        >
          {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>
    </header>
  );
};
