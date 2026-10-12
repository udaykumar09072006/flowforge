import React, { useEffect, useState } from 'react';
import {
  Workflow as WorkflowIcon,
  Play,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  Plus,
  ArrowRight,
  TrendingUp,
  Cpu,
  Database,
  ExternalLink,
  Loader2,
  Radio,
} from 'lucide-react';
import { Workflow, WorkflowRun } from '../../types/workflow';

interface DashboardPageProps {
  onNavigateToEditor: (workflowId?: string) => void;
  onNavigateToExecutions: (runId?: string) => void;
  onNavigateToTemplates: () => void;
  onNavigateToIntegrations: () => void;
  onOpenAiModal: () => void;
  onRunWorkflowNow: (workflow: Workflow) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  onNavigateToEditor,
  onNavigateToExecutions,
  onNavigateToTemplates,
  onNavigateToIntegrations,
  onOpenAiModal,
  onRunWorkflowNow,
}) => {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboardData() {
      try {
        const [wfRes, runsRes, analyticsRes] = await Promise.all([
          fetch('/api/v1/workflows'),
          fetch('/api/v1/runs'),
          fetch('/api/v1/analytics'),
        ]);

        const wfData = await wfRes.json();
        const runsData = await runsRes.json();
        const analyticsData = await analyticsRes.json();

        setWorkflows(wfData.workflows || []);
        setRuns(runsData.runs || []);
        setAnalytics(analyticsData);
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadDashboardData();
  }, []);

  const totalRuns = analytics?.totalRuns ?? runs.length;
  const successRate = analytics?.successRate ?? 98;
  const avgDuration = analytics?.avgDurationMs ?? 210;
  const activeCount = workflows.filter((w) => w.status === 'published').length;

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-7xl mx-auto w-full">
      {/* Top Welcome & Quick Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800/80">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              Automation Command Center
            </h1>
            <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20">
              PostgreSQL • BullMQ
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Real-time pipeline orchestration, worker health telemetry, and execution SLA.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onOpenAiModal}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800/60 hover:bg-violet-100 rounded-lg transition-colors cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Generate with AI</span>
          </button>
          <button
            onClick={() => onNavigateToEditor()}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-violet-600 hover:bg-violet-500 text-white rounded-lg transition-all shadow-sm shadow-violet-600/30 cursor-pointer active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>New Workflow</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800/80 bg-white/80 dark:bg-[#0e1320]/80 backdrop-blur-md shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">Total Workflows</span>
          <span className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1 block tracking-tight">
            {workflows.length}
          </span>
          <span className="text-[10px] text-slate-400 mt-1 block">{activeCount} published</span>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800/80 bg-white/80 dark:bg-[#0e1320]/80 backdrop-blur-md shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">Active Pipelines</span>
          <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1 block tracking-tight">
            {activeCount}
          </span>
          <span className="text-[10px] text-emerald-500/80 mt-1 block flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Live triggers active
          </span>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800/80 bg-white/80 dark:bg-[#0e1320]/80 backdrop-blur-md shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">Total Executions</span>
          <span className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1 block tracking-tight">
            {totalRuns}
          </span>
          <span className="text-[10px] text-slate-400 mt-1 block">Historical runs</span>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800/80 bg-white/80 dark:bg-[#0e1320]/80 backdrop-blur-md shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">Success Rate</span>
          <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1 block tracking-tight">
            {successRate}%
          </span>
          <span className="text-[10px] text-slate-400 mt-1 block">Reliability index</span>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800/80 bg-white/80 dark:bg-[#0e1320]/80 backdrop-blur-md shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">Avg Duration</span>
          <span className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1 block tracking-tight font-mono">
            {avgDuration}ms
          </span>
          <span className="text-[10px] text-slate-400 mt-1 block">p50 execution SLA</span>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800/80 bg-white/80 dark:bg-[#0e1320]/80 backdrop-blur-md shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">Queue Status</span>
          <div className="flex items-center gap-1.5 mt-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-lg font-bold text-slate-900 dark:text-slate-100">Optimal</span>
          </div>
          <span className="text-[10px] text-slate-400 mt-1 block">5 concurrency limit</span>
        </div>
      </div>

      {/* Two Column Layout: Active Workflows & Recent Executions */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Workflows Fast-Launcher (5 Cols) */}
        <div className="lg:col-span-5 space-y-3.5">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              Workflows ({workflows.length})
            </h2>
            <button
              onClick={() => onNavigateToEditor()}
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>View All</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="space-y-2.5">
            {workflows.slice(0, 4).map((wf) => (
              <div
                key={wf.id}
                className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700 transition-all shadow-2xs flex items-center justify-between gap-3"
              >
                <div
                  onClick={() => onNavigateToEditor(wf.id)}
                  className="flex-1 min-w-0 cursor-pointer group"
                >
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-semibold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 truncate">
                      {wf.name}
                    </h3>
                    <span
                      className={`text-[9px] font-semibold uppercase px-1.5 py-0.2 rounded ${
                        wf.status === 'published'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                      }`}
                    >
                      {wf.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                    {wf.description}
                  </p>
                  <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-1">
                    <span>{wf.nodes.length} nodes</span>
                    <span>·</span>
                    <span>{wf.runCount} runs executed</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => onRunWorkflowNow(wf)}
                    title="Run Workflow"
                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900 border border-indigo-200 dark:border-indigo-800 transition-colors cursor-pointer"
                  >
                    <Play className="w-3 h-3 fill-current" />
                    <span>Run</span>
                  </button>
                  <button
                    onClick={() => onNavigateToEditor(wf.id)}
                    title="Open in Visual Editor"
                    className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Quick template jump */}
          <div
            onClick={onNavigateToTemplates}
            className="p-3 rounded-lg border border-dashed border-indigo-200 dark:border-indigo-800/80 bg-indigo-50/40 dark:bg-indigo-950/20 hover:bg-indigo-50/80 transition-colors flex items-center justify-between cursor-pointer"
          >
            <div className="flex items-center gap-2 text-xs font-medium text-indigo-700 dark:text-indigo-300">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>Explore Pre-Built Industry Templates</span>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-indigo-500" />
          </div>
        </div>

        {/* Right Column: Recent Executions Live Table (7 Cols) */}
        <div className="lg:col-span-7 space-y-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                Recent Executions
              </h2>
              <span className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Feed
              </span>
            </div>
            <button
              onClick={() => onNavigateToExecutions()}
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>View History</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/75 dark:bg-slate-800/50 text-[11px] font-semibold text-slate-500">
                    <th className="py-2.5 px-3.5">Status</th>
                    <th className="py-2.5 px-3.5">Workflow</th>
                    <th className="py-2.5 px-3.5">Trigger</th>
                    <th className="py-2.5 px-3.5">Duration</th>
                    <th className="py-2.5 px-3.5">Timestamp</th>
                    <th className="py-2.5 px-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {runs.slice(0, 7).map((run) => {
                    const isSucceeded = run.status === 'SUCCEEDED';
                    const isFailed = run.status === 'FAILED';
                    const isRunning = run.status === 'RUNNING';

                    return (
                      <tr
                        key={run.id}
                        onClick={() => onNavigateToExecutions(run.id)}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer group"
                      >
                        <td className="py-2.5 px-3.5 whitespace-nowrap">
                          {isSucceeded && (
                            <span className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Success
                            </span>
                          )}
                          {isFailed && (
                            <span className="flex items-center gap-1 text-[11px] text-red-600 dark:text-red-400 font-medium">
                              <AlertCircle className="w-3.5 h-3.5" />
                              Failed
                            </span>
                          )}
                          {isRunning && (
                            <span className="flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 font-medium">
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              Running
                            </span>
                          )}
                          {!isSucceeded && !isFailed && !isRunning && (
                            <span className="text-[11px] text-slate-500">
                              {run.status}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3.5 font-medium text-slate-900 dark:text-white truncate max-w-[160px]">
                          {run.workflowName}
                        </td>
                        <td className="py-2.5 px-3.5 capitalize text-slate-500">
                          {run.triggerType}
                        </td>
                        <td className="py-2.5 px-3.5 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                          {run.durationMs !== undefined ? `${run.durationMs}ms` : '—'}
                        </td>
                        <td className="py-2.5 px-3.5 text-slate-400 text-[11px] whitespace-nowrap">
                          {new Date(run.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </td>
                        <td className="py-2.5 px-3.5 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onNavigateToExecutions(run.id);
                            }}
                            className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400 group-hover:underline"
                          >
                            Inspect
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
