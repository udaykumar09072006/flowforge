import React, { useEffect, useState } from 'react';
import { X, History, RotateCcw, Calendar, User, FileText, Check } from 'lucide-react';
import { Workflow, WorkflowVersion } from '../../types/workflow';

interface VersionHistoryModalProps {
  workflow: Workflow;
  isOpen: boolean;
  onClose: () => void;
  onRestoreVersion: (versionId: string) => Promise<void>;
}

export const VersionHistoryModal: React.FC<VersionHistoryModalProps> = ({
  workflow,
  isOpen,
  onClose,
  onRestoreVersion,
}) => {
  if (!isOpen) return null;

  const [versions, setVersions] = useState<WorkflowVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  useEffect(() => {
    async function loadVersions() {
      try {
        const res = await fetch(`/api/v1/workflows/${workflow.id}/versions`);
        const data = await res.json();
        setVersions(data.versions || []);
      } catch (err) {
        console.error('Failed to load version history:', err);
      } finally {
        setLoading(false);
      }
    }
    loadVersions();
  }, [workflow.id]);

  const handleRestore = async (versionId: string) => {
    setRestoringId(versionId);
    try {
      await onRestoreVersion(versionId);
      onClose();
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center">
              <History className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Version History
              </h3>
              <p className="text-[11px] text-slate-500">
                {workflow.name} · Current Draft v{workflow.version}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="py-8 text-center text-xs text-slate-400">Loading versions...</div>
          ) : versions.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              No immutable versions published yet. Click "Publish" in the toolbar to create version v1.
            </div>
          ) : (
            versions.map((ver) => (
              <div
                key={ver.id}
                className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:border-slate-300 dark:hover:border-slate-700 transition-colors flex items-start justify-between gap-3 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 dark:text-white">
                      Version v{ver.versionNumber}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {ver.nodes?.length || 0} nodes · {ver.edges?.length || 0} edges
                    </span>
                  </div>

                  <p className="text-slate-600 dark:text-slate-400 text-[11px]">
                    {ver.notes || 'Published release version'}
                  </p>

                  <div className="flex items-center gap-3 text-[10px] text-slate-400 pt-1">
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {ver.publishedBy || 'System'}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(ver.publishedAt).toLocaleDateString()} at{' '}
                      {new Date(ver.publishedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => handleRestore(ver.id)}
                  disabled={restoringId === ver.id}
                  className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shrink-0 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  Restore
                </button>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 flex justify-end">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
