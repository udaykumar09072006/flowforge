import React, { useEffect, useState } from 'react';
import {
  PlayCircle,
  CheckCircle2,
  AlertCircle,
  Clock,
  RotateCcw,
  Square,
  Terminal,
  ChevronRight,
  Filter,
  Search,
  Eye,
  Loader2,
  Calendar,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { NodeExecution, WorkflowRun } from '../../types/workflow';

interface ExecutionsPageProps {
  initialRunId?: string | null;
  onNavigateToWorkflow: (workflowId: string) => void;
}

export const ExecutionsPage: React.FC<ExecutionsPageProps> = ({
  initialRunId,
  onNavigateToWorkflow,
}) => {
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<WorkflowRun | null>(null);
  const [selectedNodeExec, setSelectedNodeExec] = useState<NodeExecution | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  useEffect(() => {
    async function fetchRuns() {
      try {
        const res = await fetch('/api/v1/runs');
        const data = await res.json();
        const runList: WorkflowRun[] = data.runs || [];
        setRuns(runList);

        if (initialRunId) {
          const match = runList.find((r) => r.id === initialRunId);
          if (match) setSelectedRun(match);
        } else if (runList.length > 0 && !selectedRun) {
          setSelectedRun(runList[0]);
        }
      } catch (err) {
        console.error('Failed to fetch runs:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchRuns();

    // Listen to real-time events via SSE
    const eventSource = new EventSource('/api/v1/events');
    eventSource.addEventListener('run:updated', (e) => {
      const updatedRun: WorkflowRun = JSON.parse(e.data);
      setRuns((prev) => {
        const idx = prev.findIndex((r) => r.id === updatedRun.id);
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = updatedRun;
          return copy;
        }
        return [updatedRun, ...prev];
      });

      setSelectedRun((curr) => (curr && curr.id === updatedRun.id ? updatedRun : curr));
    });

    eventSource.addEventListener('node:updated', (e) => {
      const { runId, nodeExec } = JSON.parse(e.data);
      setSelectedRun((curr) => {
        if (!curr || curr.id !== runId) return curr;
        const executions = [...curr.nodeExecutions];
        const idx = executions.findIndex((ne) => ne.nodeId === nodeExec.nodeId);
        if (idx >= 0) executions[idx] = nodeExec;
        else executions.push(nodeExec);
        return { ...curr, nodeExecutions: executions };
      });
    });

    return () => {
      eventSource.close();
    };
  }, [initialRunId]);

  // Set default selected node execution when selectedRun changes
  useEffect(() => {
    if (selectedRun && selectedRun.nodeExecutions.length > 0) {
      // Pick first or first failed/running node
      const active =
        selectedRun.nodeExecutions.find((ne) => ne.status === 'FAILED') ||
        selectedRun.nodeExecutions.find((ne) => ne.status === 'RUNNING') ||
        selectedRun.nodeExecutions[0];
      setSelectedNodeExec(active);
    } else {
      setSelectedNodeExec(null);
    }
  }, [selectedRun?.id]);

  const handleCancelRun = async () => {
    if (!selectedRun) return;
    setIsCancelling(true);
    try {
      await fetch(`/api/v1/runs/${selectedRun.id}/cancel`, { method: 'POST' });
    } finally {
      setIsCancelling(false);
    }
  };

  const handleRetryRun = async () => {
    if (!selectedRun) return;
    setIsRetrying(true);
    try {
      const res = await fetch(`/api/v1/runs/${selectedRun.id}/retry`, { method: 'POST' });
      const data = await res.json();
      if (data.newRunId) {
        // Poll new run
        setTimeout(async () => {
          const rRes = await fetch(`/api/v1/runs/${data.newRunId}`);
          const rData = await rRes.json();
          if (rData.run) setSelectedRun(rData.run);
        }, 300);
      }
    } finally {
      setIsRetrying(false);
    }
  };

  const filteredRuns = (runs || []).filter((r) => {
    if (!r) return false;
    const searchLower = (search || '').toLowerCase().trim();
    const matchStatus =
      filterStatus === 'all' ||
      (r.status || '').toLowerCase() === (filterStatus || '').toLowerCase();
    const wfName = (r.workflowName || '').toLowerCase();
    const runId = (r.id || '').toLowerCase();
    const matchSearch =
      !searchLower ||
      wfName.includes(searchLower) ||
      runId.includes(searchLower);
    return matchStatus && matchSearch;
  });

  return (
    <div className="flex-1 overflow-hidden flex flex-col md:flex-row max-w-7xl mx-auto w-full select-none">
      {/* Left List Pane: Runs Filter and Index */}
      <div className="w-full md:w-80 md:border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col h-full shrink-0">
        {/* Search & Status Filter */}
        <div className="p-3 border-b border-slate-200 dark:border-slate-800 space-y-2.5">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              Executions ({runs.length})
            </h2>
            <span className="text-[10px] text-slate-400">Live Auto-Sync</span>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by workflow name or run ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full text-xs pl-8 pr-3 py-1.5 rounded-md bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-1 overflow-x-auto pb-0.5 no-scrollbar">
            {['all', 'succeeded', 'failed', 'running', 'cancelled'].map((st) => (
              <button
                key={st}
                onClick={() => setFilterStatus(st)}
                className={`px-2 py-0.5 text-[11px] font-medium rounded capitalize whitespace-nowrap cursor-pointer ${
                  filterStatus === st
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {/* Runs List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60">
          {filteredRuns.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              No matching execution runs found.
            </div>
          ) : (
            filteredRuns.map((r) => {
              const isSelected = selectedRun?.id === r.id;
              const isSuccess = r.status === 'SUCCEEDED';
              const isFail = r.status === 'FAILED';
              const isRunning = r.status === 'RUNNING';

              return (
                <div
                  key={r.id}
                  onClick={() => setSelectedRun(r)}
                  className={`p-3 cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-indigo-50/70 dark:bg-indigo-950/40 border-l-2 border-indigo-600'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="font-semibold text-xs text-slate-900 dark:text-white truncate max-w-[170px]">
                      {r.workflowName}
                    </span>
                    {isSuccess && (
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-0.5">
                        <CheckCircle2 className="w-3 h-3" />
                        Success
                      </span>
                    )}
                    {isFail && (
                      <span className="text-[10px] text-red-500 font-medium flex items-center gap-0.5">
                        <AlertCircle className="w-3 h-3" />
                        Failed
                      </span>
                    )}
                    {isRunning && (
                      <span className="text-[10px] text-blue-500 font-medium flex items-center gap-0.5">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Running
                      </span>
                    )}
                    {!isSuccess && !isFail && !isRunning && (
                      <span className="text-[10px] text-slate-400">{r.status}</span>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                    <span className="truncate max-w-[110px]">{r.id}</span>
                    <span className="capitalize">{r.triggerType}</span>
                    <span>{r.durationMs !== undefined ? `${r.durationMs}ms` : '—'}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right Details Pane: Deep Execution Inspector */}
      {selectedRun ? (
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50 dark:bg-slate-950">
          {/* Run Header Bar */}
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  {selectedRun.workflowName}
                </h2>
                <span
                  className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                    selectedRun.status === 'SUCCEEDED'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                      : selectedRun.status === 'FAILED'
                      ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                      : selectedRun.status === 'RUNNING'
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                      : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  {selectedRun.status}
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  {selectedRun.id}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-3">
                <span>Trigger: <strong className="capitalize">{selectedRun.triggerType}</strong></span>
                <span>·</span>
                <span>Version: <strong className="font-mono">{selectedRun.versionId}</strong></span>
                <span>·</span>
                <span>Started: {new Date(selectedRun.startedAt).toLocaleTimeString()}</span>
                {selectedRun.durationMs !== undefined && (
                  <>
                    <span>·</span>
                    <span>Duration: <strong>{selectedRun.durationMs}ms</strong></span>
                  </>
                )}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {selectedRun.status === 'RUNNING' && (
                <button
                  onClick={handleCancelRun}
                  disabled={isCancelling}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-red-600 hover:bg-red-500 text-white shadow-sm cursor-pointer"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                  <span>Cancel Run</span>
                </button>
              )}

              {selectedRun.status === 'FAILED' && (
                <button
                  onClick={handleRetryRun}
                  disabled={isRetrying}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Retry Workflow</span>
                </button>
              )}

              <button
                onClick={() => onNavigateToWorkflow(selectedRun.workflowId)}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 cursor-pointer"
              >
                <span>Open in Canvas</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Inspector Body: Timeline & Node Details */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Error banner if failed */}
            {selectedRun.errorSummary && (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold">Execution Failure:</h4>
                  <p className="mt-0.5 leading-relaxed">{selectedRun.errorSummary}</p>
                </div>
              </div>
            )}

            {/* Step 1: Visual Node Executions Sequence */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 shadow-2xs space-y-2.5">
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center justify-between">
                <span>Execution Steps Timeline ({selectedRun.nodeExecutions.length} nodes)</span>
                <span className="text-[10px] font-normal text-slate-400">Click a node step to inspect payload</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {selectedRun.nodeExecutions.map((ne, idx) => {
                  const isNodeSelected = selectedNodeExec?.nodeId === ne.nodeId;
                  const isSucceeded = ne.status === 'SUCCEEDED';
                  const isFailed = ne.status === 'FAILED';
                  const isRunning = ne.status === 'RUNNING';
                  const isSkipped = ne.status === 'SKIPPED';

                  return (
                    <div
                      key={ne.id || idx}
                      onClick={() => setSelectedNodeExec(ne)}
                      className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-all flex items-center justify-between gap-2 ${
                        isNodeSelected
                          ? 'border-indigo-500 ring-1 ring-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/30'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {isSucceeded && <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />}
                        {isFailed && <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />}
                        {isRunning && <Loader2 className="w-4 h-4 text-blue-500 animate-spin shrink-0" />}
                        {isSkipped && <span className="w-3.5 h-3.5 rounded-full border border-slate-400 inline-block shrink-0" />}
                        {!isSucceeded && !isFailed && !isRunning && !isSkipped && (
                          <span className="w-3.5 h-3.5 rounded-full border border-slate-300 inline-block shrink-0" />
                        )}

                        <div className="truncate">
                          <h4 className="font-semibold text-slate-900 dark:text-white truncate">
                            {idx + 1}. {ne.nodeLabel}
                          </h4>
                          <span className="text-[10px] text-slate-500 block truncate">
                            {ne.nodeType}
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="font-mono text-[10px] text-slate-500 block">
                          {ne.durationMs !== undefined ? `${ne.durationMs}ms` : '—'}
                        </span>
                        <span className="text-[9px] uppercase font-bold text-slate-400 block">
                          {ne.status}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Step 2: Selected Node Deep Payload Inspector */}
            {selectedNodeExec && (
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-slate-900 dark:text-white">
                      Node Inspector: {selectedNodeExec.nodeLabel}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                      {selectedNodeExec.nodeType}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    Attempt {selectedNodeExec.attempt} · Duration: {selectedNodeExec.durationMs || 0}ms
                  </span>
                </div>

                {selectedNodeExec.errorDetails && (
                  <div className="p-2.5 rounded bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-xs">
                    {selectedNodeExec.errorDetails}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  {/* Inputs Snapshot */}
                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 block">
                      Input Snapshot
                    </span>
                    <pre className="p-2.5 rounded-lg bg-slate-950 text-slate-100 font-mono text-[11px] max-h-48 overflow-auto leading-tight">
                      {JSON.stringify(selectedNodeExec.inputSnapshot || {}, null, 2)}
                    </pre>
                  </div>

                  {/* Outputs Snapshot */}
                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 block">
                      Output Snapshot
                    </span>
                    <pre className="p-2.5 rounded-lg bg-slate-950 text-emerald-300/90 font-mono text-[11px] max-h-48 overflow-auto leading-tight">
                      {JSON.stringify(selectedNodeExec.outputSnapshot || {}, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Real-Time Execution Logs Console */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-indigo-500" />
                  Execution Logs ({selectedRun.logs?.length || 0})
                </span>
                <span className="text-[10px] text-slate-400">Structured Log Stream</span>
              </div>

              <div className="p-3 rounded-lg bg-slate-950 font-mono text-[11px] max-h-60 overflow-y-auto space-y-1.5 text-slate-200">
                {selectedRun.logs?.length === 0 ? (
                  <div className="text-slate-500">No logs emitted yet.</div>
                ) : (
                  selectedRun.logs?.map((l, i) => {
                    const isError = l.level === 'error';
                    const isWarn = l.level === 'warn';

                    return (
                      <div key={i} className="flex items-start gap-2 leading-relaxed">
                        <span className="text-slate-500 text-[10px] shrink-0">
                          {new Date(l.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                        <span
                          className={`uppercase text-[9px] font-bold px-1 rounded shrink-0 ${
                            isError
                              ? 'bg-red-950 text-red-400'
                              : isWarn
                              ? 'bg-amber-950 text-amber-400'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {l.level}
                        </span>
                        <span className={isError ? 'text-red-300' : isWarn ? 'text-amber-200' : 'text-slate-300'}>
                          {l.message}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-slate-400 text-xs">
          Select an execution run to inspect its node tree and debug logs.
        </div>
      )}
    </div>
  );
};
