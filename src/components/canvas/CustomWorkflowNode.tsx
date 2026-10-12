import React from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import {
  PlayCircle,
  Webhook,
  Clock,
  GitFork,
  Split,
  Filter,
  GitMerge,
  Hourglass,
  Globe,
  Mail,
  Database,
  FileText,
  Variable,
  Shuffle,
  Code,
  Type,
  Calendar,
  CheckCircle,
  Loader2,
  AlertCircle,
  MinusCircle,
} from 'lucide-react';
import { FlowNodeData } from '../../types/workflow';
import { CATEGORY_COLORS } from '../../shared/nodeRegistry';

const ICON_MAP: Record<string, React.FC<{ className?: string }>> = {
  PlayCircle,
  Webhook,
  Clock,
  GitFork,
  Split,
  Filter,
  GitMerge,
  Hourglass,
  Globe,
  Mail,
  Database,
  FileText,
  Variable,
  Shuffle,
  Code,
  Type,
  Calendar,
  CheckCircle,
};

export const CustomWorkflowNode: React.FC<NodeProps> = ({ data, selected }) => {
  const nodeData = data as unknown as FlowNodeData;
  const colors = CATEGORY_COLORS[nodeData.category] || CATEGORY_COLORS.action;
  const isTrigger = nodeData.category === 'trigger';
  const isCondition = nodeData.nodeType === 'logic:condition';
  const isSwitch = nodeData.nodeType === 'logic:switch';

  const status = nodeData.status;

  // Status Styling
  let statusRing = '';
  let statusBadge = null;

  if (status === 'RUNNING') {
    statusRing = 'ring-2 ring-blue-500 shadow-lg shadow-blue-500/20';
    statusBadge = (
      <span className="flex items-center gap-1 text-[10px] text-blue-600 dark:text-blue-400 font-medium">
        <Loader2 className="w-3 h-3 animate-spin" />
        Running
      </span>
    );
  } else if (status === 'SUCCEEDED') {
    statusRing = 'ring-2 ring-emerald-500 shadow-md shadow-emerald-500/10';
    statusBadge = (
      <span className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
        <CheckCircle className="w-3 h-3" />
        {nodeData.executionDuration !== undefined ? `${nodeData.executionDuration}ms` : 'Success'}
      </span>
    );
  } else if (status === 'FAILED') {
    statusRing = 'ring-2 ring-red-500 shadow-md shadow-red-500/20';
    statusBadge = (
      <span className="flex items-center gap-1 text-[10px] text-red-600 dark:text-red-400 font-medium">
        <AlertCircle className="w-3 h-3" />
        Failed
      </span>
    );
  } else if (status === 'SKIPPED') {
    statusRing = 'opacity-60 grayscale';
    statusBadge = (
      <span className="flex items-center gap-1 text-[10px] text-slate-400 font-medium">
        <MinusCircle className="w-3 h-3" />
        Skipped
      </span>
    );
  }

  const IconComponent =
    (nodeData.nodeType &&
      nodeData.nodeType.split(':')[1] &&
      (nodeData.nodeType === 'trigger:manual'
        ? PlayCircle
        : nodeData.nodeType === 'trigger:webhook'
        ? Webhook
        : nodeData.nodeType === 'trigger:schedule'
        ? Clock
        : nodeData.nodeType === 'logic:condition'
        ? GitFork
        : nodeData.nodeType === 'logic:switch'
        ? Split
        : nodeData.nodeType === 'logic:filter'
        ? Filter
        : nodeData.nodeType === 'logic:merge'
        ? GitMerge
        : nodeData.nodeType === 'logic:delay'
        ? Hourglass
        : nodeData.nodeType === 'action:http_request'
        ? Globe
        : nodeData.nodeType === 'action:send_email'
        ? Mail
        : nodeData.nodeType === 'action:db_record'
        ? Database
        : nodeData.nodeType === 'action:log'
        ? FileText
        : nodeData.nodeType === 'utility:set_variable'
        ? Variable
        : nodeData.nodeType === 'utility:transform'
        ? Shuffle
        : nodeData.nodeType === 'utility:json_parse'
        ? Code
        : nodeData.nodeType === 'utility:string_util'
        ? Type
        : nodeData.nodeType === 'utility:date_util'
        ? Calendar
        : CheckCircle)) ||
    CheckCircle;

  return (
    <div
      className={`relative w-64 rounded-xl border bg-white/95 dark:bg-[#111827]/90 backdrop-blur-md shadow-sm transition-all duration-150 text-slate-900 dark:text-slate-100 ${
        selected
          ? 'border-violet-500 ring-2 ring-violet-500/30 shadow-lg shadow-violet-500/10'
          : 'border-slate-200/90 dark:border-slate-800/90 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md'
      } ${statusRing}`}
    >
      {/* Target input handle (unless trigger) */}
      {!isTrigger && (
        <Handle
          type="target"
          position={Position.Left}
          className="!bg-slate-400 dark:!bg-slate-500 hover:!bg-indigo-500"
        />
      )}

      {/* Node Header */}
      <div className="p-3 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg ${colors.bg} ${colors.text}`}>
            <IconComponent className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-semibold leading-tight text-slate-900 dark:text-slate-100 truncate max-w-[130px]">
              {nodeData.label}
            </h4>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 capitalize">
              {nodeData.category}
            </span>
          </div>
        </div>

        {statusBadge}
      </div>

      {/* Node Body */}
      <div className="p-3 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
        <p className="line-clamp-2">{nodeData.description || 'Configured automation step'}</p>

        {/* Small config preview if available */}
        {nodeData.config?.url && (
          <div className="mt-2 text-[10px] font-mono text-slate-600 dark:text-slate-300 truncate bg-slate-50 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200/60 dark:border-slate-700/60">
            {nodeData.config.method || 'POST'} {nodeData.config.url}
          </div>
        )}
        {nodeData.config?.operator && (
          <div className="mt-2 text-[10px] font-mono text-slate-600 dark:text-slate-300 truncate bg-slate-50 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200/60 dark:border-slate-700/60">
            {nodeData.config.field} {nodeData.config.operator} {nodeData.config.value}
          </div>
        )}
        {nodeData.config?.collection && (
          <div className="mt-2 text-[10px] font-mono text-slate-600 dark:text-slate-300 truncate bg-slate-50 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200/60 dark:border-slate-700/60">
            db.{nodeData.config.collection}.{nodeData.config.operation || 'insert'}()
          </div>
        )}
        {nodeData.config?.cronExpression && (
          <div className="mt-2 text-[10px] font-mono text-slate-600 dark:text-slate-300 truncate bg-slate-50 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200/60 dark:border-slate-700/60">
            cron: {nodeData.config.cronExpression}
          </div>
        )}
      </div>

      {/* Output Handles */}
      {isCondition ? (
        <div className="flex flex-col gap-2 pb-2 px-3 text-[10px] font-semibold border-t border-slate-100 dark:border-slate-800/80 pt-1.5">
          <div className="relative flex items-center justify-between text-emerald-600 dark:text-emerald-400">
            <span>True</span>
            <Handle
              type="source"
              position={Position.Right}
              id="true"
              className="!bg-emerald-500 !top-[32%] hover:!scale-125"
            />
          </div>
          <div className="relative flex items-center justify-between text-amber-600 dark:text-amber-400">
            <span>False</span>
            <Handle
              type="source"
              position={Position.Right}
              id="false"
              className="!bg-amber-500 !top-[78%] hover:!scale-125"
            />
          </div>
        </div>
      ) : isSwitch ? (
        <div className="flex flex-col gap-1 pb-2 px-3 text-[10px] font-medium border-t border-slate-100 dark:border-slate-800 pt-1.5">
          {(nodeData.config?.cases || ['pending', 'approved', 'rejected']).map(
            (caseVal: string, idx: number, arr: string[]) => (
              <div key={caseVal} className="relative flex items-center justify-between text-slate-600 dark:text-slate-400">
                <span>{caseVal}</span>
                <Handle
                  type="source"
                  position={Position.Right}
                  id={caseVal}
                  className="!bg-indigo-500"
                  style={{ top: `${((idx + 1) / (arr.length + 1)) * 100}%` }}
                />
              </div>
            )
          )}
          <div className="relative flex items-center justify-between text-slate-500">
            <span>default</span>
            <Handle
              type="source"
              position={Position.Right}
              id="default"
              className="!bg-slate-400"
              style={{ top: '92%' }}
            />
          </div>
        </div>
      ) : (
        <Handle
          type="source"
          position={Position.Right}
          id="output"
          className="!bg-slate-400 dark:!bg-slate-500 hover:!bg-indigo-500"
        />
      )}
    </div>
  );
};
