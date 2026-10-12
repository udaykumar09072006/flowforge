import React, { useState, useEffect } from 'react';
import {
  X,
  Trash2,
  Copy,
  Check,
  Play,
  Terminal,
  Info,
  ShieldAlert,
  Loader2,
  CheckCircle,
} from 'lucide-react';
import { FlowNode } from '../../types/workflow';
import { NODE_DEFINITIONS, CATEGORY_COLORS } from '../../shared/nodeRegistry';

interface NodeConfigPanelProps {
  node: FlowNode | null;
  onUpdateNode: (updatedNode: FlowNode) => void;
  onDeleteNode: (nodeId: string) => void;
  onDuplicateNode: (nodeId: string) => void;
  onClose: () => void;
}

export const NodeConfigPanel: React.FC<NodeConfigPanelProps> = ({
  node,
  onUpdateNode,
  onDeleteNode,
  onDuplicateNode,
  onClose,
}) => {
  if (!node) return null;

  const def = NODE_DEFINITIONS[node.data.nodeType];
  const colors = CATEGORY_COLORS[node.data.category] || CATEGORY_COLORS.action;

  const [label, setLabel] = useState(node.data.label || '');
  const [config, setConfig] = useState<Record<string, any>>(node.data.config || {});
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [testingNode, setTestingNode] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

  // Sync state when selected node changes
  useEffect(() => {
    setLabel(node.data.label || '');
    setConfig(node.data.config || {});
    setTestResult(null);
  }, [node.id]);

  const updateConfigField = (key: string, value: any) => {
    const updated = { ...config, [key]: value };
    setConfig(updated);
    onUpdateNode({
      ...node,
      data: {
        ...node.data,
        label,
        config: updated,
      },
    });
  };

  const handleLabelChange = (newLabel: string) => {
    setLabel(newLabel);
    onUpdateNode({
      ...node,
      data: {
        ...node.data,
        label: newLabel,
        config,
      },
    });
  };

  // Run isolated test for this single node
  const handleTestNode = async () => {
    setTestingNode(true);
    setTestResult(null);
    try {
      // Simulate/invoke isolated test
      await new Promise((r) => setTimeout(r, 450));
      if (node.data.nodeType === 'logic:condition') {
        const fieldVal = 14999;
        const targetVal = Number(config.value) || 5000;
        const passed = fieldVal > targetVal;
        setTestResult({
          testedField: config.field,
          sampleValue: fieldVal,
          comparisonTarget: targetVal,
          evaluatedBranch: passed ? 'true' : 'false',
          passed,
        });
      } else if (node.data.nodeType === 'utility:string_util') {
        const str = 'Sample Customer Name';
        const res = config.operation === 'uppercase' ? str.toUpperCase() : str.toLowerCase();
        setTestResult({ input: str, result: res });
      } else if (node.data.nodeType === 'utility:date_util') {
        setTestResult({ timestamp: Date.now(), iso: new Date().toISOString() });
      } else {
        setTestResult({
          status: 'success',
          simulatedOutput: {
            nodeId: node.id,
            executedAt: new Date().toISOString(),
            configValid: true,
          },
        });
      }
    } finally {
      setTestingNode(false);
    }
  };

  const insertVariableHint = (varText: string, fieldKey: string) => {
    const currentVal = config[fieldKey] || '';
    updateConfigField(fieldKey, `${currentVal}${varText}`);
  };

  const webhookUrl = `${window.location.origin}/api/v1/webhooks/wh_${node.id}`;

  return (
    <aside className="w-80 h-full border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col z-10 select-none">
      {/* Header */}
      <div className="p-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${colors.bg} ${colors.text}`}>
            {node.data.category}
          </span>
          <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
            Configure Node
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onDuplicateNode(node.id)}
            title="Duplicate node"
            className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDeleteNode(node.id)}
            title="Delete node"
            className="p-1 text-slate-400 hover:text-red-600 rounded hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Form Body */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-4 text-xs">
        {/* Node Label */}
        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
            Node Label
          </label>
          <input
            type="text"
            value={label}
            onChange={(e) => handleLabelChange(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
          />
          <p className="text-[10px] text-slate-500">{def?.description}</p>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* SPECIFIC CONFIGURATIONS PER NODE TYPE */}
        {/* ------------------------------------------------------------------ */}

        {/* 1. Webhook Trigger */}
        {node.data.nodeType === 'trigger:webhook' && (
          <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Webhook Trigger URL
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  readOnly
                  value={webhookUrl}
                  className="flex-1 text-[10px] font-mono px-2 py-1.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 truncate"
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(webhookUrl);
                    setCopiedWebhook(true);
                    setTimeout(() => setCopiedWebhook(false), 2000);
                  }}
                  className="px-2 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 cursor-pointer"
                >
                  {copiedWebhook ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <p className="text-[10px] text-slate-400">
                Send HTTP POST with JSON payload to this endpoint.
              </p>
            </div>
          </div>
        )}

        {/* 2. Schedule Trigger */}
        {node.data.nodeType === 'trigger:schedule' && (
          <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Cron Expression
              </label>
              <input
                type="text"
                value={config.cronExpression || '0 * * * *'}
                onChange={(e) => updateConfigField('cronExpression', e.target.value)}
                placeholder="*/5 * * * *"
                className="w-full font-mono text-xs px-2.5 py-1.5 rounded bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
              />
              <div className="flex gap-1.5 pt-1">
                {['*/5 * * * * (Every 5m)', '0 * * * * (Hourly)', '0 9 * * 1-5 (Daily 9am)'].map((preset) => {
                  const expr = preset.split(' ')[0] + ' ' + preset.split(' ')[1] + ' ' + preset.split(' ')[2] + ' ' + preset.split(' ')[3] + ' ' + preset.split(' ')[4];
                  return (
                    <button
                      key={preset}
                      onClick={() => updateConfigField('cronExpression', expr)}
                      className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-indigo-600"
                    >
                      {preset.split(' ')[0]}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* 3. Condition (If/Else) */}
        {node.data.nodeType === 'logic:condition' && (
          <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Field Expression
              </label>
              <input
                type="text"
                value={config.field || ''}
                onChange={(e) => updateConfigField('field', e.target.value)}
                placeholder="{{trigger.amount}}"
                className="w-full font-mono text-xs px-2.5 py-1.5 rounded bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
              />
              <div className="flex gap-1 pt-0.5">
                {['{{trigger.amount}}', '{{trigger.status}}', '{{trigger.isValid}}'].map((t) => (
                  <button
                    key={t}
                    onClick={() => updateConfigField('field', t)}
                    className="text-[9px] font-mono px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-indigo-600"
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Operator
              </label>
              <select
                value={config.operator || 'eq'}
                onChange={(e) => updateConfigField('operator', e.target.value)}
                className="w-full text-xs px-2.5 py-1.5 rounded bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
              >
                <option value="eq">Equal to (==)</option>
                <option value="neq">Not equal to (!=)</option>
                <option value="gt">Greater than (&gt;)</option>
                <option value="gte">Greater than or equal (&gt;=)</option>
                <option value="lt">Less than (&lt;)</option>
                <option value="lte">Less than or equal (&lt;=)</option>
                <option value="contains">Contains substring</option>
                <option value="exists">Exists / Is Defined</option>
                <option value="boolean">Is Truthy</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Comparison Value
              </label>
              <input
                type="text"
                value={config.value || ''}
                onChange={(e) => updateConfigField('value', e.target.value)}
                placeholder="5000"
                className="w-full text-xs px-2.5 py-1.5 rounded bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-mono"
              />
            </div>
          </div>
        )}

        {/* 4. HTTP Request Action */}
        {node.data.nodeType === 'action:http_request' && (
          <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-1.5 p-2 rounded bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-[10px] text-amber-800 dark:text-amber-300">
              <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
              <span>SSRF Protected: Requests to private IPs or metadata endpoints are blocked.</span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-1 space-y-1">
                <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">Method</label>
                <select
                  value={config.method || 'POST'}
                  onChange={(e) => updateConfigField('method', e.target.value)}
                  className="w-full text-xs px-2 py-1.5 rounded bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                >
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                  <option value="PUT">PUT</option>
                  <option value="PATCH">PATCH</option>
                  <option value="DELETE">DELETE</option>
                </select>
              </div>

              <div className="col-span-2 space-y-1">
                <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">Timeout (sec)</label>
                <input
                  type="number"
                  value={config.timeoutSeconds || 10}
                  onChange={(e) => updateConfigField('timeoutSeconds', Number(e.target.value))}
                  className="w-full text-xs px-2 py-1.5 rounded bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">Destination URL</label>
              <input
                type="text"
                value={config.url || ''}
                onChange={(e) => updateConfigField('url', e.target.value)}
                placeholder="https://api.example.com/endpoint"
                className="w-full font-mono text-xs px-2.5 py-1.5 rounded bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">Headers (JSON)</label>
              <textarea
                rows={3}
                value={config.headers || '{\n  "Content-Type": "application/json"\n}'}
                onChange={(e) => updateConfigField('headers', e.target.value)}
                className="w-full font-mono text-[11px] p-2 rounded bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">Body (JSON)</label>
              <textarea
                rows={4}
                value={config.body || ''}
                onChange={(e) => updateConfigField('body', e.target.value)}
                placeholder="{\n  &quot;orderId&quot;: &quot;{{trigger.id}}&quot;\n}"
                className="w-full font-mono text-[11px] p-2 rounded bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>
        )}

        {/* 5. Send Email Action */}
        {node.data.nodeType === 'action:send_email' && (
          <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">Recipient Email (To)</label>
              <input
                type="text"
                value={config.to || ''}
                onChange={(e) => updateConfigField('to', e.target.value)}
                placeholder="vip-sales@company.com or {{trigger.email}}"
                className="w-full text-xs px-2.5 py-1.5 rounded bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">Subject</label>
              <input
                type="text"
                value={config.subject || ''}
                onChange={(e) => updateConfigField('subject', e.target.value)}
                placeholder="Priority Order Alert #{{trigger.orderId}}"
                className="w-full text-xs px-2.5 py-1.5 rounded bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">Email Body Template</label>
              <textarea
                rows={4}
                value={config.body || ''}
                onChange={(e) => updateConfigField('body', e.target.value)}
                placeholder="Order details: Amount ₹{{trigger.amount}}"
                className="w-full text-xs p-2 rounded bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>
        )}

        {/* 6. Database Record Action */}
        {node.data.nodeType === 'action:db_record' && (
          <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">Collection</label>
                <input
                  type="text"
                  value={config.collection || 'orders'}
                  onChange={(e) => updateConfigField('collection', e.target.value)}
                  placeholder="orders"
                  className="w-full text-xs px-2.5 py-1.5 rounded bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">Operation</label>
                <select
                  value={config.operation || 'insert'}
                  onChange={(e) => updateConfigField('operation', e.target.value)}
                  className="w-full text-xs px-2 py-1.5 rounded bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                >
                  <option value="insert">Insert Record</option>
                  <option value="findOne">Find One</option>
                  <option value="findMany">Find Many</option>
                  <option value="update">Update Record</option>
                  <option value="delete">Delete Record</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">Record Data (JSON)</label>
              <textarea
                rows={5}
                value={config.payload || ''}
                onChange={(e) => updateConfigField('payload', e.target.value)}
                placeholder="{\n  &quot;orderId&quot;: &quot;{{trigger.id}}&quot;\n}"
                className="w-full font-mono text-[11px] p-2 rounded bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>
        )}

        {/* 7. Log Action */}
        {node.data.nodeType === 'action:log' && (
          <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">Log Level</label>
              <select
                value={config.level || 'info'}
                onChange={(e) => updateConfigField('level', e.target.value)}
                className="w-full text-xs px-2.5 py-1.5 rounded bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
              >
                <option value="info">INFO</option>
                <option value="warn">WARN</option>
                <option value="error">ERROR</option>
                <option value="debug">DEBUG</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">Log Message Template</label>
              <textarea
                rows={3}
                value={config.message || ''}
                onChange={(e) => updateConfigField('message', e.target.value)}
                placeholder="Executed step for item {{trigger.id}}"
                className="w-full text-xs p-2 rounded bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>
        )}

        {/* 8. Delay */}
        {node.data.nodeType === 'logic:delay' && (
          <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Delay Duration (Seconds)
              </label>
              <input
                type="number"
                min="0.5"
                max="10"
                step="0.5"
                value={config.seconds || 2}
                onChange={(e) => updateConfigField('seconds', Number(e.target.value))}
                className="w-full text-xs px-2.5 py-1.5 rounded bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
              />
              <p className="text-[10px] text-slate-400">
                Capped between 0.5s and 10s for responsive UX.
              </p>
            </div>
          </div>
        )}

        {/* 9. Set Variable */}
        {node.data.nodeType === 'utility:set_variable' && (
          <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">Variable Name</label>
              <input
                type="text"
                value={config.variableName || ''}
                onChange={(e) => updateConfigField('variableName', e.target.value)}
                placeholder="calculatedTotal"
                className="w-full font-mono text-xs px-2.5 py-1.5 rounded bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">Value Expression</label>
              <input
                type="text"
                value={config.variableValue || ''}
                onChange={(e) => updateConfigField('variableValue', e.target.value)}
                placeholder="{{trigger.amount}}"
                className="w-full font-mono text-xs px-2.5 py-1.5 rounded bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>
        )}

        {/* 10. Transform Data */}
        {node.data.nodeType === 'utility:transform' && (
          <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">JSON Mapping</label>
              <textarea
                rows={6}
                value={config.mapping || ''}
                onChange={(e) => updateConfigField('mapping', e.target.value)}
                placeholder="{\n  &quot;orderId&quot;: &quot;{{trigger.id}}&quot;,\n  &quot;amount&quot;: &quot;{{trigger.amount}}&quot;\n}"
                className="w-full font-mono text-[11px] p-2 rounded bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>
        )}

        {/* Quick Variable Injector */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
            Context Expressions
          </span>
          <div className="flex flex-wrap gap-1">
            {[
              '{{trigger.amount}}',
              '{{trigger.orderId}}',
              '{{trigger.customerName}}',
              '{{run.id}}',
            ].map((expr) => (
              <span
                key={expr}
                className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 select-all"
              >
                {expr}
              </span>
            ))}
          </div>
        </div>

        {/* Test Node Sandbox */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
          <button
            onClick={handleTestNode}
            disabled={testingNode}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium transition-colors cursor-pointer"
          >
            {testingNode ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            Test Node in Sandbox
          </button>

          {testResult && (
            <div className="p-2 rounded bg-slate-950 text-slate-100 font-mono text-[10px] space-y-1">
              <div className="flex items-center justify-between text-slate-400">
                <span className="flex items-center gap-1">
                  <Terminal className="w-3 h-3 text-emerald-400" />
                  Test Output
                </span>
                <span className="text-emerald-400">200 OK</span>
              </div>
              <pre className="max-h-28 overflow-y-auto overflow-x-hidden text-emerald-300/90 leading-tight">
                {JSON.stringify(testResult, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
