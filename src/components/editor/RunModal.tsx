import React, { useState } from 'react';
import { X, Play, Loader2, Sparkles, Terminal } from 'lucide-react';
import { Workflow } from '../../types/workflow';

interface RunModalProps {
  workflow: Workflow;
  isOpen: boolean;
  onClose: () => void;
  onExecute: (payload: any) => Promise<void>;
}

export const RunModal: React.FC<RunModalProps> = ({
  workflow,
  isOpen,
  onClose,
  onExecute,
}) => {
  if (!isOpen) return null;

  // Find trigger node default config if any
  const triggerNode = workflow.nodes.find((n) => n.data.nodeType?.startsWith('trigger:'));
  const initialPayload =
    triggerNode?.data?.config?.defaultPayload ||
    JSON.stringify(
      {
        orderId: 'ORD-9912',
        customerName: 'Aarav Sharma',
        customerEmail: 'aarav.sharma@example.com',
        amount: 8500,
        items: [{ id: 'item_1', name: 'Premium Cloud Subscription', price: 8500 }],
      },
      null,
      2
    );

  const [payloadText, setPayloadText] = useState(initialPayload);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [jsonError, setJsonError] = useState<string | null>(null);

  const handleRun = async () => {
    setJsonError(null);
    let parsed: any = {};
    try {
      parsed = JSON.parse(payloadText);
    } catch (err: any) {
      setJsonError(`Invalid JSON format: ${err.message}`);
      return;
    }

    setIsSubmitting(true);
    try {
      await onExecute(parsed);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const samplePresets = [
    {
      name: 'High-Value Order (₹14,999)',
      payload: {
        orderId: 'ORD-VIP-88',
        customerName: 'Priya Sundaram',
        customerEmail: 'priya@acme.com',
        amount: 14999,
        items: [{ id: 'p1', name: 'Enterprise Bundle', price: 14999 }],
      },
    },
    {
      name: 'Standard Order (₹2,200)',
      payload: {
        orderId: 'ORD-STD-12',
        customerName: 'Devon Patel',
        customerEmail: 'devon@company.org',
        amount: 2200,
        items: [{ id: 'p2', name: 'Basic Tier', price: 2200 }],
      },
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Play className="w-4 h-4 fill-current" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Execute Workflow Run
              </h3>
              <p className="text-[11px] text-slate-500">
                {workflow.name} ({workflow.nodes.length} nodes)
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
        <div className="p-4 space-y-3.5">
          {/* Preset Buttons */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
              Quick Test Payloads
            </label>
            <div className="flex items-center gap-2">
              {samplePresets.map((preset) => (
                <button
                  key={preset.name}
                  onClick={() => {
                    setPayloadText(JSON.stringify(preset.payload, null, 2));
                    setJsonError(null);
                  }}
                  className="px-2.5 py-1 text-[11px] rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>

          {/* JSON Payload Editor */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Trigger Payload (JSON)
              </label>
              <span className="text-[10px] text-slate-400">Available as {`{{trigger.key}}`}</span>
            </div>
            <textarea
              rows={8}
              value={payloadText}
              onChange={(e) => {
                setPayloadText(e.target.value);
                setJsonError(null);
              }}
              className="w-full font-mono text-xs p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            {jsonError && (
              <p className="text-[11px] text-red-500 font-medium">{jsonError}</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleRun}
            disabled={isSubmitting}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-md transition-colors shadow-sm cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current" />
            )}
            <span>Execute Now</span>
          </button>
        </div>
      </div>
    </div>
  );
};
