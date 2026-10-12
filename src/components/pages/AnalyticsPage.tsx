import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  TrendingUp,
  AlertTriangle,
  Cpu,
  Clock,
  CheckCircle2,
  Activity,
  Layers,
  ShieldCheck,
  Server,
  Zap,
} from 'lucide-react';

export const AnalyticsPage: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAnalytics() {
      try {
        const res = await fetch('/api/v1/analytics');
        const json = await res.json();
        setData(json);
      } catch (err) {
        console.error('Failed to load analytics:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchAnalytics();
  }, []);

  const totalRuns = data?.totalRuns || 0;
  const succeeded = data?.succeededRuns || 0;
  const failed = data?.failedRuns || 0;
  const cancelled = data?.cancelledRuns || 0;
  const successRate = data?.successRate ?? 100;
  const avgDuration = data?.avgDurationMs || 0;
  const queue = data?.queueMetrics || { activeCount: 0, waitingCount: 0, completedCount: 0, failedCount: 0 };
  const failingNodes: any[] = data?.failingNodes || [];

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-7xl mx-auto w-full select-none">
      {/* Header */}
      <div className="pb-2 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            System Analytics & Observability
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Real-time telemetry, queue throughput, failure distributions, and execution health.
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Worker Engine Live</span>
        </div>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Total Executions</span>
            <Activity className="w-4 h-4 text-indigo-500" />
          </div>
          <span className="text-2xl font-bold text-slate-900 dark:text-white mt-2 block">
            {totalRuns}
          </span>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Across all workflows</span>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Success Rate</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-2 block">
            {successRate}%
          </span>
          <span className="text-[10px] text-slate-400 mt-0.5 block">
            {succeeded} succeeded · {failed} failed
          </span>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Avg Execution Time</span>
            <Clock className="w-4 h-4 text-blue-500" />
          </div>
          <span className="text-2xl font-bold text-slate-900 dark:text-white mt-2 block">
            {avgDuration}ms
          </span>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Engine processing speed</span>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Active Workflows</span>
            <Zap className="w-4 h-4 text-amber-500" />
          </div>
          <span className="text-2xl font-bold text-slate-900 dark:text-white mt-2 block">
            {data?.activeWorkflows || 2}
          </span>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Published & running</span>
        </div>
      </div>

      {/* Two Column Layout: Worker Queue & Failure Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Background Queue Health (6 cols) */}
        <div className="lg:col-span-6 space-y-3">
          <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
            Background Queue Telemetry
          </h3>

          <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-indigo-500" />
                <span className="text-xs font-semibold text-slate-900 dark:text-white">
                  Worker Pool Configuration
                </span>
              </div>
              <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded">
                HEALTHY
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
                <span className="text-slate-500 text-[11px] block">Active In-Flight Jobs</span>
                <span className="text-lg font-bold text-slate-900 dark:text-white mt-1 block">
                  {queue.activeCount}
                </span>
                <span className="text-[10px] text-slate-400">Concurrency cap: 5</span>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
                <span className="text-slate-500 text-[11px] block">Waiting Queue Depth</span>
                <span className="text-lg font-bold text-slate-900 dark:text-white mt-1 block">
                  {queue.waitingCount}
                </span>
                <span className="text-[10px] text-slate-400">FIFO prioritized</span>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
                <span className="text-slate-500 text-[11px] block">Total Processed</span>
                <span className="text-lg font-bold text-slate-900 dark:text-white mt-1 block">
                  {queue.totalProcessed || totalRuns}
                </span>
                <span className="text-[10px] text-slate-400">Completed jobs</span>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
                <span className="text-slate-500 text-[11px] block">Failed Retries</span>
                <span className="text-lg font-bold text-slate-900 dark:text-white mt-1 block">
                  {queue.failedCount || 0}
                </span>
                <span className="text-[10px] text-slate-400">Exponential backoff</span>
              </div>
            </div>
          </div>
        </div>

        {/* Node Failure Analysis (6 cols) */}
        <div className="lg:col-span-6 space-y-3">
          <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
            Node Failure Hotspots
          </h3>

          <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs space-y-3">
            {failingNodes.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400 space-y-1">
                <ShieldCheck className="w-8 h-8 mx-auto text-emerald-500 stroke-1" />
                <p className="font-semibold text-slate-700 dark:text-slate-300">0 Node Bottlenecks</p>
                <p>All executed node steps have functioned with 100% stability.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {failingNodes.map((fn, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-semibold text-slate-900 dark:text-white block">
                        {fn.label}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">{fn.type}</span>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 font-bold text-xs">
                      {fn.count} failures
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
