import React, { useState } from 'react';
import {
  Plus,
  Search,
  GitBranch,
  Play,
  Copy,
  Trash2,
  ExternalLink,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Clock,
  Send,
  MoreVertical,
  Lock,
} from 'lucide-react';
import { Workflow } from '../../types/workflow';
import { useFlowForgeRbac } from '../../hooks/useFlowForgeRbac';

interface WorkflowsListPageProps {
  workflows: Workflow[];
  onOpenEditor: (workflowId?: string) => void;
  onRunWorkflow: (workflow: Workflow) => void;
  onDuplicateWorkflow: (workflowId: string) => Promise<void>;
  onDeleteWorkflow: (workflowId: string) => Promise<void>;
  onOpenAiModal: () => void;
  onViewExecutions: (workflowId: string) => void;
}

export const WorkflowsListPage: React.FC<WorkflowsListPageProps> = ({
  workflows,
  onOpenEditor,
  onRunWorkflow,
  onDuplicateWorkflow,
  onDeleteWorkflow,
  onOpenAiModal,
  onViewExecutions,
}) => {
  const { role, can, cannot, getRestrictionReason } = useFlowForgeRbac();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'updated' | 'name' | 'runs'>('updated');

  const filtered = (workflows || [])
    .filter((wf) => {
      if (!wf) return false;
      const searchLower = (search || '').toLowerCase().trim();
      const wfName = (wf.name || '').toLowerCase();
      const wfDesc = (wf.description || '').toLowerCase();
      const matchSearch =
        !searchLower ||
        wfName.includes(searchLower) ||
        wfDesc.includes(searchLower);
      const matchStatus = filterStatus === 'all' || (wf.status || '').toLowerCase() === filterStatus.toLowerCase();
      return matchSearch && matchStatus;
    })
    .sort((a, b) => {
      if (sortBy === 'name') return (a.name || '').localeCompare(b.name || '');
      if (sortBy === 'runs') return (b.runCount || 0) - (a.runCount || 0);
      return new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime();
    });

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-7xl mx-auto w-full select-none">
      {/* Header and Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            Workflows
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Manage your visual graph automation pipelines, versions, and execution triggers.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={can('create', 'workflow') ? onOpenAiModal : undefined}
            disabled={cannot('create', 'workflow')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              cannot('create', 'workflow')
                ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed opacity-60'
                : 'bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800/60 hover:bg-violet-100 cursor-pointer'
            }`}
            title={cannot('create', 'workflow') ? (getRestrictionReason('create', 'workflow') || `🔒 ${role} role cannot generate workflows.`) : 'Generate workflow with AI'}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>AI Architect</span>
          </button>
          <button
            onClick={can('create', 'workflow') ? () => onOpenEditor() : undefined}
            disabled={cannot('create', 'workflow')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all shadow-sm ${
              cannot('create', 'workflow')
                ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed border border-slate-200 dark:border-slate-700 opacity-60'
                : 'bg-violet-600 hover:bg-violet-500 text-white shadow-violet-600/30 cursor-pointer active:scale-95'
            }`}
            title={cannot('create', 'workflow') ? (getRestrictionReason('create', 'workflow') || `🔒 ${role} role cannot create workflows.`) : 'Create a new workflow'}
          >
            {cannot('create', 'workflow') ? (
              <Lock className="w-3.5 h-3.5 text-slate-400" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            <span>Create Workflow</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Search Input */}
          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search workflows by title or keywords..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full text-xs pl-8 pr-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Status Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg">
            {['all', 'published', 'draft'].map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-2.5 py-1 text-xs font-medium rounded capitalize transition-colors cursor-pointer ${
                  filterStatus === status
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        {/* Sort Select */}
        <div className="flex items-center gap-2 self-end sm:self-auto text-xs text-slate-500">
          <span>Sort:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2 py-1 text-slate-800 dark:text-slate-200 focus:outline-none"
          >
            <option value="updated">Recently Updated</option>
            <option value="name">Name (A-Z)</option>
            <option value="runs">Most Runs</option>
          </select>
        </div>
      </div>

      {/* Workflows Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.length === 0 ? (
          <div className="col-span-full py-12 text-center text-slate-400 space-y-2">
            <GitBranch className="w-8 h-8 mx-auto stroke-1" />
            <p className="text-xs">No matching workflows found.</p>
          </div>
        ) : (
          filtered.map((wf) => (
            <div
              key={wf.id}
              className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between space-y-3.5 group"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div
                    onClick={() => onOpenEditor(wf.id)}
                    className="cursor-pointer flex-1 min-w-0"
                  >
                    <h3 className="font-semibold text-sm text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors truncate">
                      {wf.name}
                    </h3>
                  </div>
                  <span
                    className={`text-[9px] font-semibold uppercase px-2 py-0.5 rounded shrink-0 ${
                      wf.status === 'published'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                    }`}
                  >
                    {wf.status} v{wf.version}
                  </span>
                </div>

                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                  {wf.description || 'No description provided'}
                </p>
              </div>

              {/* Workflow Metadata */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                <div className="flex items-center gap-2">
                  <span>{(wf.nodes || []).length} nodes</span>
                  <span>·</span>
                  <span>{wf.runCount || 0} runs</span>
                </div>

                {wf.lastRunStatus && (
                  <div className="flex items-center gap-1 font-medium">
                    {wf.lastRunStatus === 'SUCCEEDED' ? (
                      <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Success
                      </span>
                    ) : (
                      <span className="text-red-500 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        Failed
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Bottom Actions */}
              <div className="flex items-center justify-between gap-2 pt-1">
                <button
                  onClick={can('run', 'workflow') ? () => onRunWorkflow(wf) : undefined}
                  disabled={cannot('run', 'workflow')}
                  className={`flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-md border transition-colors ${
                    cannot('run', 'workflow')
                      ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700/50 cursor-not-allowed opacity-60'
                      : 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900 border-indigo-200 dark:border-indigo-800 cursor-pointer'
                  }`}
                  title={cannot('run', 'workflow') ? (getRestrictionReason('run', 'workflow') || `🔒 ${role} role cannot run workflows.`) : 'Run workflow'}
                >
                  {cannot('run', 'workflow') ? (
                    <Lock className="w-3 h-3 text-slate-400" />
                  ) : (
                    <Play className="w-3 h-3 fill-current" />
                  )}
                  <span>Run</span>
                </button>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onViewExecutions(wf.id)}
                    title="View Execution History"
                    className="p-1.5 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    <Clock className="w-3.5 h-3.5" />
                  </button>

                  {can('create', 'workflow') && (
                    <button
                      onClick={() => onDuplicateWorkflow(wf.id)}
                      title="Duplicate Workflow"
                      className="p-1.5 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {can('delete', 'workflow') && (
                    <button
                      onClick={() => onDeleteWorkflow(wf.id)}
                      title="Delete Workflow"
                      className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => onOpenEditor(wf.id)}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-md bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 transition-colors cursor-pointer"
                  >
                    <span>Open</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
