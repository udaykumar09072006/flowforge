import React, { useEffect, useState } from 'react';
import {
  Search,
  Command,
  GitBranch,
  Play,
  Sparkles,
  LayoutDashboard,
  Layers,
  Database,
  BarChart3,
  Users,
  Settings,
  ArrowRight,
  Plus,
  Radio,
  FileCode,
  X,
} from 'lucide-react';
import { ActiveTab } from './Header';
import { Workflow } from '../../types/workflow';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTab: (tab: ActiveTab) => void;
  workflows: Workflow[];
  onOpenWorkflow: (workflowId?: string) => void;
  onOpenAiModal: () => void;
  onRunWorkflow?: (workflow: Workflow) => void;
}

interface CommandItem {
  id: string;
  title: string;
  subtitle?: string;
  category: 'Navigation' | 'Workflows' | 'Actions';
  icon: React.ReactNode;
  badge?: string;
  action: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onSelectTab,
  workflows,
  onOpenWorkflow,
  onOpenAiModal,
  onRunWorkflow,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Keyboard shortcut listener for Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) {
          onClose();
        }
      } else if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Reset search when opening
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const commands: CommandItem[] = [
    // Navigation
    {
      id: 'nav-dashboard',
      title: 'Go to Dashboard',
      subtitle: 'System metrics, execution stream, pipeline health',
      category: 'Navigation',
      icon: <LayoutDashboard className="w-4 h-4 text-violet-400" />,
      action: () => {
        onSelectTab('dashboard');
        onClose();
      },
    },
    {
      id: 'nav-workflows',
      title: 'Browse Workflows',
      subtitle: 'View, filter, and organize automation pipelines',
      category: 'Navigation',
      icon: <GitBranch className="w-4 h-4 text-sky-400" />,
      action: () => {
        onSelectTab('workflows');
        onClose();
      },
    },
    {
      id: 'nav-executions',
      title: 'Executions & Live Halos',
      subtitle: 'Inspect run traces, node I/O, error summaries',
      category: 'Navigation',
      icon: <Play className="w-4 h-4 text-emerald-400" />,
      action: () => {
        onSelectTab('executions');
        onClose();
      },
    },
    {
      id: 'nav-templates',
      title: 'Pre-built Templates Gallery',
      subtitle: 'Clone enterprise webhooks, sync pipelines, AI flows',
      category: 'Navigation',
      icon: <Layers className="w-4 h-4 text-amber-400" />,
      action: () => {
        onSelectTab('templates');
        onClose();
      },
    },
    {
      id: 'nav-integrations',
      title: 'Integrations & External APIs',
      subtitle: 'Configure credentials, webhooks, and REST endpoints',
      category: 'Navigation',
      icon: <Database className="w-4 h-4 text-pink-400" />,
      action: () => {
        onSelectTab('integrations');
        onClose();
      },
    },
    {
      id: 'nav-analytics',
      title: 'Observability & Analytics',
      subtitle: 'Latency percentiles, p95 execution time, success SLA',
      category: 'Navigation',
      icon: <BarChart3 className="w-4 h-4 text-violet-400" />,
      action: () => {
        onSelectTab('analytics');
        onClose();
      },
    },
    {
      id: 'nav-workspace',
      title: 'Workspace Settings & Team RBAC',
      subtitle: 'Manage members, role policies, and workspace audit logs',
      category: 'Navigation',
      icon: <Users className="w-4 h-4 text-teal-400" />,
      action: () => {
        onSelectTab('workspace');
        onClose();
      },
    },
    // Actions
    {
      id: 'act-new-workflow',
      title: 'Create Blank Workflow',
      subtitle: 'Start with an empty canvas and trigger node',
      category: 'Actions',
      badge: 'Enter',
      icon: <Plus className="w-4 h-4 text-emerald-400" />,
      action: () => {
        onOpenWorkflow();
        onClose();
      },
    },
    {
      id: 'act-ai-architect',
      title: 'Generate Workflow with AI',
      subtitle: 'Prompt Gemini to synthesize a validated visual pipeline',
      category: 'Actions',
      badge: 'AI',
      icon: <Sparkles className="w-4 h-4 text-amber-400" />,
      action: () => {
        onOpenAiModal();
        onClose();
      },
    },
    // Workflows list
    ...(workflows || []).map((wf) => ({
      id: `wf-${wf.id}`,
      title: wf.name || 'Untitled Workflow',
      subtitle: wf.description || `Nodes: ${wf.nodes?.length || 0} • Status: ${wf.status || 'draft'}`,
      category: 'Workflows' as const,
      badge: wf.status?.toUpperCase() || 'DRAFT',
      icon: <FileCode className="w-4 h-4 text-violet-400" />,
      action: () => {
        onOpenWorkflow(wf.id);
        onClose();
      },
    })),
  ];

  const filteredCommands = commands.filter((c) => {
    const q = query.toLowerCase().trim();
    if (!q) return true;
    return (
      c.title.toLowerCase().includes(q) ||
      (c.subtitle && c.subtitle.toLowerCase().includes(q)) ||
      c.category.toLowerCase().includes(q)
    );
  });

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (filteredCommands.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % filteredCommands.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % filteredCommands.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const selected = filteredCommands[selectedIndex];
      if (selected) {
        selected.action();
      }
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-start justify-center pt-20 px-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-white dark:bg-[#0f172a] rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800/80 overflow-hidden text-slate-900 dark:text-slate-100 flex flex-col max-h-[75vh]"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search Input Bar */}
        <div className="relative flex items-center px-4 py-3.5 border-b border-slate-200 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50">
          <Search className="w-5 h-5 text-slate-400 mr-3 shrink-0" />
          <input
            type="text"
            autoFocus
            placeholder="Type a command, search workflows, or jump to route..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            className="w-full bg-transparent border-0 outline-none text-sm placeholder-slate-400 text-slate-900 dark:text-slate-100 font-medium"
          />
          <kbd className="hidden sm:inline-flex items-center gap-1 text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-700">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredCommands.length === 0 ? (
            <div className="py-12 text-center text-slate-500 dark:text-slate-400">
              <Search className="w-8 h-8 mx-auto mb-2 text-slate-400/60" />
              <p className="text-sm font-medium">No commands or workflows found</p>
              <p className="text-xs text-slate-400 mt-1">Try another search term or type "AI" to generate</p>
            </div>
          ) : (
            filteredCommands.map((cmd, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={cmd.id}
                  onClick={cmd.action}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-violet-600 text-white shadow-sm'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`p-1.5 rounded-md shrink-0 ${
                        isSelected
                          ? 'bg-white/20 text-white'
                          : 'bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {cmd.icon}
                    </div>
                    <div className="truncate">
                      <div className="font-medium truncate flex items-center gap-2">
                        <span>{cmd.title}</span>
                        {cmd.badge && (
                          <span
                            className={`text-[9px] font-mono px-1.5 py-0.2 rounded uppercase ${
                              isSelected
                                ? 'bg-white/20 text-white'
                                : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                            }`}
                          >
                            {cmd.badge}
                          </span>
                        )}
                      </div>
                      {cmd.subtitle && (
                        <div
                          className={`text-[11px] truncate mt-0.5 ${
                            isSelected ? 'text-violet-100' : 'text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          {cmd.subtitle}
                        </div>
                      )}
                    </div>
                  </div>

                  <ArrowRight
                    className={`w-3.5 h-3.5 shrink-0 ml-3 transition-transform ${
                      isSelected ? 'translate-x-0.5 opacity-100' : 'opacity-0'
                    }`}
                  />
                </div>
              );
            })
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="px-4 py-2 border-t border-slate-200 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-900/50 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 font-mono text-[10px]">↑↓</kbd>{' '}
              Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 font-mono text-[10px]">↵</kbd>{' '}
              Select
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 font-mono text-[10px]">ESC</kbd>{' '}
              Dismiss
            </span>
          </div>
          <span className="font-mono text-[10px] text-violet-500 dark:text-violet-400 font-medium">FlowForge Quick Engine</span>
        </div>
      </div>
    </div>
  );
};
