import React, { useState } from 'react';
import {
  Save,
  CheckCircle2,
  AlertTriangle,
  Play,
  Square,
  Upload,
  Download,
  History,
  Sparkles,
  ChevronRight,
  Send,
  Loader2,
  Lock,
  Shield,
  Eye,
  Zap,
  Check,
} from 'lucide-react';
import { Workflow } from '../../types/workflow';
import { useFlowForgeRbac } from '../../hooks/useFlowForgeRbac';

interface EditorToolbarProps {
  workflow: Workflow;
  onUpdateName: (name: string) => void;
  onSaveDraft: () => Promise<void>;
  onValidate: () => Promise<void>;
  onOpenRunModal: () => void;
  onCancelRun?: () => void;
  onOpenPublishModal: () => void;
  onOpenVersionModal: () => void;
  onOpenAiModal: () => void;
  isSaving: boolean;
  isRunning: boolean;
  hasUnsavedChanges: boolean;
  validationStatus: { isValid: boolean; errorCount: number; warningCount: number } | null;
  isAutosaveEnabled?: boolean;
  onToggleAutosave?: (enabled: boolean) => void;
  autosaveCountdown?: number | null;
  lastSavedAt?: Date | null;
}

export const EditorToolbar: React.FC<EditorToolbarProps> = ({
  workflow,
  onUpdateName,
  onSaveDraft,
  onValidate,
  onOpenRunModal,
  onCancelRun,
  onOpenPublishModal,
  onOpenVersionModal,
  onOpenAiModal,
  isSaving,
  isRunning,
  hasUnsavedChanges,
  validationStatus,
  isAutosaveEnabled = true,
  onToggleAutosave,
  autosaveCountdown = null,
  lastSavedAt = null,
}) => {
  const { role, can, cannot, getRestrictionReason, setIsAuthModalOpen } = useFlowForgeRbac();
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState(workflow.name);

  const handleTitleSubmit = () => {
    setIsEditingTitle(false);
    if (titleInput.trim() && titleInput !== workflow.name) {
      onUpdateName(titleInput.trim());
    } else {
      setTitleInput(workflow.name);
    }
  };

  return (
    <div className="h-12 border-b border-slate-200 dark:border-slate-800/80 bg-white/95 dark:bg-[#0e1320]/95 backdrop-blur-md px-4 flex items-center justify-between z-20 select-none">
      {/* Left: Workflow Name & Version Status */}
      <div className="flex items-center gap-3 min-w-0">
        {isEditingTitle ? (
          <input
            type="text"
            autoFocus
            value={titleInput}
            onChange={(e) => setTitleInput(e.target.value)}
            onBlur={handleTitleSubmit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleTitleSubmit();
              if (e.key === 'Escape') {
                setTitleInput(workflow.name);
                setIsEditingTitle(false);
              }
            }}
            className="text-xs font-semibold px-2 py-1 rounded-md border border-violet-500 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-violet-500"
          />
        ) : (
          <div
            onClick={() => setIsEditingTitle(true)}
            className="flex items-center gap-1.5 group cursor-pointer"
            title="Click to rename workflow"
          >
            <h2 className="text-xs font-bold text-slate-900 dark:text-slate-100 group-hover:text-violet-500 dark:group-hover:text-violet-400 transition-colors truncate max-w-[260px]">
              {workflow.name}
            </h2>
            <span className="text-[10px] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
              ✎
            </span>
          </div>
        )}

        {/* Status indicator */}
        <div className="flex items-center gap-1.5 text-xs">
          <span
            className={`text-[10px] font-mono font-medium uppercase px-2 py-0.5 rounded-full border ${
              workflow.status === 'published'
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
            }`}
          >
            {workflow.status} v{workflow.version}
          </span>

          {hasUnsavedChanges ? (
            <span className="flex items-center gap-1 text-[11px] text-amber-500 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              {isAutosaveEnabled && autosaveCountdown !== null ? (
                <span>Autosaving in {autosaveCountdown}s...</span>
              ) : (
                <span>Unsaved</span>
              )}
            </span>
          ) : (
            <span className="hidden sm:flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
              <Check className="w-3 h-3 stroke-[2.5]" />
              <span>
                {lastSavedAt
                  ? `Saved at ${lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
                  : 'All changes saved'}
              </span>
            </span>
          )}
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2">
        {/* Validate Graph Button */}
        <button
          onClick={onValidate}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors cursor-pointer"
        >
          {validationStatus ? (
            validationStatus.isValid ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            ) : (
              <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
            )
          ) : (
            <CheckCircle2 className="w-3.5 h-3.5 text-slate-400" />
          )}
          <span className="hidden sm:inline">Validate</span>
        </button>

        {/* Version History Button */}
        <button
          onClick={onOpenVersionModal}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors cursor-pointer"
        >
          <History className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Versions</span>
        </button>

        {/* Clerk RBAC Role Badge */}
        <div
          onClick={() => setIsAuthModalOpen(true)}
          className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[11px] font-medium cursor-pointer transition-colors ${
            cannot('edit', 'workflow')
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400'
              : 'bg-violet-500/10 border-violet-500/20 text-violet-600 dark:text-violet-300 hover:bg-violet-500/20'
          }`}
          title="Click to manage Clerk authentication or switch roles"
        >
          {cannot('edit', 'workflow') ? (
            <Eye className="w-3.5 h-3.5 text-amber-500" />
          ) : (
            <Shield className="w-3.5 h-3.5 text-violet-500" />
          )}
          <span className="hidden md:inline font-mono text-[10px] uppercase font-bold">{role}</span>
        </div>

        {/* Autosave Feature Toggle */}
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs transition-colors ${
            isAutosaveEnabled
              ? 'border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300'
              : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400'
          }`}
          title={
            isAutosaveEnabled
              ? 'Autosave is enabled: triggers automatically after 5 seconds of canvas inactivity'
              : 'Autosave is disabled: click to enable automatic saving'
          }
        >
          <Zap
            className={`w-3.5 h-3.5 transition-colors ${
              isAutosaveEnabled
                ? 'text-amber-500 fill-amber-500/20'
                : 'text-slate-400'
            }`}
          />
          <span className="font-semibold text-[11px] hidden md:inline">
            Autosave
          </span>

          <button
            type="button"
            role="switch"
            aria-checked={isAutosaveEnabled}
            aria-label="Toggle autosave"
            onClick={() => onToggleAutosave?.(!isAutosaveEnabled)}
            className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-1 focus:ring-violet-500 ${
              isAutosaveEnabled ? 'bg-violet-600' : 'bg-slate-300 dark:bg-slate-700'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                isAutosaveEnabled ? 'translate-x-3' : 'translate-x-0'
              }`}
            />
          </button>

          {isAutosaveEnabled && hasUnsavedChanges && autosaveCountdown !== null && (
            <span className="text-[10px] font-mono font-bold text-amber-500 bg-amber-500/15 border border-amber-500/30 px-1 py-0.2 rounded animate-pulse hidden xl:inline">
              {autosaveCountdown}s
            </span>
          )}
        </div>

        {/* Save Draft Button */}
        <button
          onClick={can('edit', 'workflow') ? onSaveDraft : undefined}
          disabled={isSaving || cannot('edit', 'workflow')}
          className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-lg border transition-colors shadow-xs ${
            cannot('edit', 'workflow')
              ? 'border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 text-slate-400 dark:text-slate-600 cursor-not-allowed opacity-60'
              : 'border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800/60 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer'
          }`}
          title={
            cannot('edit', 'workflow')
              ? (getRestrictionReason('edit', 'workflow') || `🔒 Read-only access: ${role} role cannot save changes.`)
              : 'Save current workflow draft'
          }
        >
          {isSaving ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : cannot('edit', 'workflow') ? (
            <Lock className="w-3.5 h-3.5 text-amber-500" />
          ) : (
            <Save className="w-3.5 h-3.5" />
          )}
          <span>Save</span>
        </button>

        {/* Publish Button */}
        <button
          onClick={can('publish', 'workflow') ? onOpenPublishModal : undefined}
          disabled={cannot('publish', 'workflow')}
          className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-lg transition-colors shadow-sm ${
            cannot('publish', 'workflow')
              ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed border border-slate-200 dark:border-slate-700/50 opacity-60'
              : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20 cursor-pointer'
          }`}
          title={
            cannot('publish', 'workflow')
              ? (getRestrictionReason('publish', 'workflow') || `🔒 RBAC Restricted: Publishing requires Admin or Owner role.`)
              : 'Publish immutable production version'
          }
        >
          {cannot('publish', 'workflow') ? (
            <Lock className="w-3.5 h-3.5 text-slate-400" />
          ) : (
            <Send className="w-3.5 h-3.5" />
          )}
          <span>Publish</span>
        </button>

        {/* Execution Run / Stop Button */}
        {isRunning ? (
          <button
            onClick={onCancelRun}
            className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg bg-rose-600 hover:bg-rose-500 text-white transition-colors shadow-sm cursor-pointer animate-pulse"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
            <span>Cancel</span>
          </button>
        ) : (
          <button
            onClick={can('run', 'workflow') ? onOpenRunModal : undefined}
            disabled={cannot('run', 'workflow')}
            className={`flex items-center gap-1.5 px-3.5 py-1 text-xs font-semibold rounded-lg transition-colors shadow-sm ${
              cannot('run', 'workflow')
                ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed border border-slate-200 dark:border-slate-700/50 opacity-60'
                : 'bg-violet-600 hover:bg-violet-500 text-white shadow-violet-600/30 cursor-pointer active:scale-95'
            }`}
            title={
              cannot('run', 'workflow')
                ? (getRestrictionReason('run', 'workflow') || `🔒 RBAC Restricted: Cannot run workflows in current role.`)
                : 'Test and trigger execution run'
            }
          >
            {cannot('run', 'workflow') ? (
              <Lock className="w-3.5 h-3.5 text-slate-400" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current" />
            )}
            <span>Run Flow</span>
          </button>
        )}
      </div>
    </div>
  );
};
