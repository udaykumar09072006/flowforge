import React, { useState } from 'react';
import { X, Send, Loader2, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';
import { Workflow } from '../../types/workflow';

interface PublishModalProps {
  workflow: Workflow;
  isOpen: boolean;
  onClose: () => void;
  onPublish: (notes: string) => Promise<void>;
}

export const PublishModal: React.FC<PublishModalProps> = ({
  workflow,
  isOpen,
  onClose,
  onPublish,
}) => {
  if (!isOpen) return null;

  const [notes, setNotes] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
  const nextVersion = (workflow.version || 1) + 1;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPublishing(true);
    try {
      await onPublish(notes || `Release version ${nextVersion}`);
      onClose();
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Send className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Publish Workflow Version
              </h3>
              <p className="text-[11px] text-slate-500">
                Target release: Version v{nextVersion}
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 space-y-3.5 text-xs">
          <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-1">
            <div className="flex items-center gap-1.5 font-medium text-slate-800 dark:text-slate-200">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span>Immutable Snapshot</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Publishing validates all connections, locks the current graph into an immutable version snapshot, and activates triggers.
            </p>
          </div>

          <div className="space-y-1">
            <label className="font-semibold text-slate-700 dark:text-slate-300">
              Release Notes & Changelog
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., Added ₹5,000 threshold VIP email notification and database persistence."
              className="w-full p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPublishing}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-md transition-colors shadow-sm cursor-pointer disabled:opacity-50"
            >
              {isPublishing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              <span>Publish v{nextVersion}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
