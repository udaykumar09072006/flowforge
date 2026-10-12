import React, { useState } from 'react';
import {
  X,
  Sparkles,
  Loader2,
  ArrowRight,
  CheckCircle2,
  Workflow as WorkflowIcon,
  Bot,
  Lightbulb,
} from 'lucide-react';
import { FlowEdge, FlowNode } from '../../types/workflow';

interface AiWorkflowModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyGraph: (workflowData: {
    name: string;
    description: string;
    nodes: FlowNode[];
    edges: FlowEdge[];
  }) => void;
}

export const AiWorkflowModal: React.FC<AiWorkflowModalProps> = ({
  isOpen,
  onClose,
  onApplyGraph,
}) => {
  if (!isOpen) return null;

  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedResult, setGeneratedResult] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const samplePrompts = [
    'When an order arrives via webhook, check if amount exceeds ₹5,000. If true, send VIP sales alert email and record in database; otherwise just store the record and log audit.',
    'Every 15 minutes, ping our external API health endpoint. If status is not 200, dispatch incident email to DevOps; otherwise log heartbeat.',
    'Receive new lead registration, format customer name to uppercase, assign Enterprise tier, and insert into CRM leads database.',
  ];

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    setErrorMessage(null);
    setGeneratedResult(null);

    try {
      const res = await fetch('/api/v1/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to generate workflow');
      }

      const data = await res.json();
      setGeneratedResult(data);
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApply = () => {
    if (!generatedResult) return;
    onApplyGraph({
      name: generatedResult.name,
      description: generatedResult.description,
      nodes: generatedResult.nodes,
      edges: generatedResult.edges,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-600 to-amber-500 text-white flex items-center justify-center shadow-sm">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <span>AI Workflow Architect</span>
                <span className="text-[10px] font-normal px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  Powered by Gemini 3.8 Flash
                </span>
              </h3>
              <p className="text-[11px] text-slate-500">
                Describe your desired automation in plain English
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

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
          {/* Prompt input */}
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-700 dark:text-slate-300">
              What process would you like to automate?
            </label>
            <textarea
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. When an order arrives, check if amount > 5000, send an email notification, and save to database..."
              className="w-full p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 leading-relaxed text-xs"
            />
          </div>

          {/* Quick example prompts */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
              <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
              Example Ideas:
            </span>
            <div className="space-y-1">
              {samplePrompts.map((p, i) => (
                <div
                  key={i}
                  onClick={() => setPrompt(p)}
                  className="p-2 rounded bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 text-[11px] text-slate-600 dark:text-slate-400 cursor-pointer transition-colors"
                >
                  "{p}"
                </div>
              ))}
            </div>
          </div>

          {/* Generate Action Button */}
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !prompt.trim()}
            className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors shadow-sm cursor-pointer disabled:opacity-50"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Designing Visual Workflow Graph...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>Generate Graph Architecture</span>
              </>
            )}
          </button>

          {errorMessage && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-xs">
              {errorMessage}
            </div>
          )}

          {/* Generated Result Preview */}
          {generatedResult && (
            <div className="p-3.5 rounded-lg border border-indigo-200 dark:border-indigo-800/80 bg-indigo-50/40 dark:bg-indigo-950/20 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white text-xs">
                    {generatedResult.name}
                  </h4>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                    {generatedResult.description}
                  </p>
                </div>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                  {generatedResult.isAiGenerated ? 'Gemini 3.8 Flash' : 'Template Pipeline'}
                </span>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                  Proposed Graph Topology ({generatedResult.nodes?.length} nodes, {generatedResult.edges?.length} edges)
                </span>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {generatedResult.nodes?.map((n: any, idx: number) => (
                    <span
                      key={n.id || idx}
                      className="px-2 py-1 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] font-medium text-slate-800 dark:text-slate-200 shadow-2xs"
                    >
                      {idx + 1}. {n.data?.label || n.data?.nodeType}
                    </span>
                  ))}
                </div>
              </div>

              {generatedResult.explanation && (
                <p className="text-[11px] text-slate-500 italic border-t border-indigo-100 dark:border-indigo-900/60 pt-2">
                  💡 {generatedResult.explanation}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 flex items-center justify-between">
          <span className="text-[11px] text-slate-400">
            You can modify every node and configuration on canvas after applying.
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              disabled={!generatedResult}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-md transition-colors shadow-sm cursor-pointer disabled:opacity-40"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Apply to Canvas</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
