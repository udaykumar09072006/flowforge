import React, { useState } from 'react';
import {
  Search,
  Sun,
  Moon,
  Sparkles,
  Command,
  Bell,
  CheckCircle2,
  AlertTriangle,
  Play,
  Layers,
  ChevronRight,
  Menu,
  Shield,
  HelpCircle,
  ExternalLink,
} from 'lucide-react';
import { ActiveTab } from './Header';
import { UserRole } from '../../types/workflow';
import { useClerkRbac } from '../../context/ClerkRbacContext';

interface TopNavbarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  activeWorkflowName?: string;
  isDarkMode: boolean;
  setIsDarkMode: (val: boolean) => void;
  onOpenAiModal: () => void;
  onOpenCommandPalette: () => void;
  currentUserRole: UserRole;
  setCurrentUserRole: (role: UserRole) => void;
  onToggleMobileSidebar: () => void;
}

const TAB_TITLES: Record<ActiveTab, { title: string; subtitle: string }> = {
  dashboard: { title: 'Dashboard', subtitle: 'Overview & Execution Telemetry' },
  workflows: { title: 'Workflows', subtitle: 'Pipeline Orchestration' },
  editor: { title: 'Visual Editor', subtitle: 'Graph Automation Canvas' },
  executions: { title: 'Executions', subtitle: 'Live Traces & Error Halos' },
  templates: { title: 'Templates', subtitle: 'Community & Blueprint Gallery' },
  integrations: { title: 'Integrations', subtitle: 'PostgreSQL, Webhooks & REST' },
  analytics: { title: 'Analytics', subtitle: 'p95 Latency & Throughput SLA' },
  workspace: { title: 'Workspace', subtitle: 'Role-Based Access Control' },
};

export const TopNavbar: React.FC<TopNavbarProps> = ({
  activeTab,
  setActiveTab,
  activeWorkflowName,
  isDarkMode,
  setIsDarkMode,
  onOpenAiModal,
  onOpenCommandPalette,
  currentUserRole,
  setCurrentUserRole,
  onToggleMobileSidebar,
}) => {
  const { role, setRole, isClerkLive, setIsAuthModalOpen } = useClerkRbac();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const currentMeta = TAB_TITLES[activeTab] || { title: 'FlowForge', subtitle: '' };

  return (
    <header className="h-14 border-b border-slate-200 dark:border-slate-800/80 bg-white/95 dark:bg-[#0b0f19]/95 backdrop-blur-md px-4 flex items-center justify-between z-20 shrink-0 select-none">
      {/* Left: Mobile Toggle & Breadcrumbs */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onToggleMobileSidebar}
          className="md:hidden p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title="Toggle Navigation"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Dynamic Breadcrumbs */}
        <div className="flex items-center gap-2 text-xs">
          <span
            onClick={() => setActiveTab('dashboard')}
            className="text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 cursor-pointer font-medium transition-colors"
          >
            FlowForge
          </span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400 dark:text-slate-600" />
          <span className="font-semibold text-slate-900 dark:text-slate-100">
            {currentMeta.title}
          </span>
          {activeTab === 'editor' && activeWorkflowName && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 dark:text-slate-600" />
              <span className="text-violet-600 dark:text-violet-400 font-medium truncate max-w-[200px]">
                {activeWorkflowName}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Center: Global Search Command Palette Button */}
      <div className="hidden lg:flex items-center justify-center flex-1 max-w-md mx-4">
        <button
          onClick={onOpenCommandPalette}
          className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700 transition-all text-xs group"
        >
          <div className="flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-slate-400 group-hover:text-violet-500 transition-colors" />
            <span>Search workflows, runs, actions...</span>
          </div>
          <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-700">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2">
        {/* System Health / SSE Live Indicator */}
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[11px] font-medium border border-emerald-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>Engine Online</span>
        </div>

        {/* AI Architect Action */}
        <button
          onClick={onOpenAiModal}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800/60 rounded-lg hover:bg-violet-100 dark:hover:bg-violet-900/40 transition-colors cursor-pointer"
          title="Open AI Workflow Assistant"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span className="hidden sm:inline">AI Architect</span>
        </button>

        {/* Clerk Auth & RBAC Status Pill */}
        <div
          onClick={() => setIsAuthModalOpen(true)}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-violet-500/30 bg-violet-500/10 hover:bg-violet-500/15 text-violet-700 dark:text-violet-300 transition-colors cursor-pointer text-xs group"
          title="Click to manage Clerk authentication and switch RBAC roles"
        >
          <Shield className="w-3.5 h-3.5 text-violet-500" />
          <span className="font-semibold text-[11px] hidden lg:inline">
            {isClerkLive ? 'Clerk Live' : 'Clerk RBAC'}:
          </span>
          <span className="font-mono text-[10px] uppercase font-bold bg-violet-600 text-white px-1.5 py-0.2 rounded">
            {role}
          </span>
        </div>

        {/* Quick Role Switcher Pill */}
        <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-xs">
          <select
            value={role}
            onChange={(e) => {
              const newRole = e.target.value as UserRole;
              setRole(newRole);
              setCurrentUserRole(newRole);
            }}
            className="bg-transparent text-slate-800 dark:text-slate-200 font-medium text-xs focus:outline-none cursor-pointer"
            aria-label="Select role"
          >
            <option value="OWNER" className="bg-white dark:bg-slate-900">Owner</option>
            <option value="ADMIN" className="bg-white dark:bg-slate-900">Admin</option>
            <option value="EDITOR" className="bg-white dark:bg-slate-900">Editor</option>
            <option value="VIEWER" className="bg-white dark:bg-slate-900">Viewer</option>
          </select>
        </div>

        {/* Notifications Popover Toggle */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 rounded-xl bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 shadow-xl p-3 z-50 text-xs text-slate-800 dark:text-slate-200">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                <span className="font-semibold text-xs">Execution Events</span>
                <span className="text-[10px] text-slate-400">Real-time SSE</span>
              </div>
              <div className="py-2 space-y-2">
                <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-[11px] flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">Workflow Run Succeeded</span>
                    <p className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 mt-0.5">
                      "Stripe Webhook to Postgres" completed in 184ms
                    </p>
                  </div>
                </div>
                <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 text-[11px] flex items-start gap-2">
                  <Play className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">Worker Node Ready</span>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      BullMQ queue active with concurrency 5
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Theme Toggle Button */}
        <button
          onClick={() => setIsDarkMode(!isDarkMode)}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          title={isDarkMode ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
        >
          {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
        </button>
      </div>
    </header>
  );
};
