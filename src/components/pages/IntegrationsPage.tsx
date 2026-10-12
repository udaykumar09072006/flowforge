import React, { useEffect, useState } from 'react';
import {
  Database,
  Webhook,
  Mail,
  Send,
  Play,
  Copy,
  Check,
  Search,
  ExternalLink,
  Loader2,
  CheckCircle2,
  RefreshCw,
  Terminal,
} from 'lucide-react';
import { DatabaseRecord, DispatchedEmail, WebhookEndpoint } from '../../types/workflow';

interface IntegrationsPageProps {
  onNavigateToRun: (runId: string) => void;
}

export const IntegrationsPage: React.FC<IntegrationsPageProps> = ({ onNavigateToRun }) => {
  const [activeTab, setActiveTab] = useState<'webhook' | 'database' | 'emails'>('webhook');

  // Webhook Playground State
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([]);
  const [selectedEndpointId, setSelectedEndpointId] = useState<string>('');
  const [webhookPayload, setWebhookPayload] = useState<string>(
    JSON.stringify(
      {
        orderId: 'ORD-9844',
        customerName: 'Kavita Rao',
        customerEmail: 'kavita@techsol.co',
        amount: 14999,
        items: [{ id: 'prod_1', name: 'Enterprise License', price: 14999 }],
      },
      null,
      2
    )
  );
  const [sendingWebhook, setSendingWebhook] = useState(false);
  const [webhookResponse, setWebhookResponse] = useState<any>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);

  // Database Browser State
  const [collections, setCollections] = useState<{ name: string; count: number }[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<string>('orders');
  const [records, setRecords] = useState<DatabaseRecord[]>([]);
  const [recordSearch, setRecordSearch] = useState('');

  // Email Outbox State
  const [emails, setEmails] = useState<DispatchedEmail[]>([]);

  // Load initial data
  const loadData = async () => {
    try {
      const [whRes, colRes, emRes] = await Promise.all([
        fetch('/api/v1/webhooks'),
        fetch('/api/v1/database-collections'),
        fetch('/api/v1/emails'),
      ]);

      const whData = await whRes.json();
      const colData = await colRes.json();
      const emData = await emRes.json();

      setEndpoints(whData.endpoints || []);
      if (whData.endpoints?.length > 0 && !selectedEndpointId) {
        setSelectedEndpointId(whData.endpoints[0].id);
      }

      setCollections(colData.collections || []);
      setEmails(emData.emails || []);

      if (colData.collections?.length > 0) {
        loadCollectionRecords(colData.collections[0].name);
      }
    } catch (err) {
      console.error('Failed to load integrations data:', err);
    }
  };

  const loadCollectionRecords = async (col: string) => {
    setSelectedCollection(col);
    try {
      const res = await fetch(`/api/v1/database/${col}`);
      const data = await res.json();
      setRecords(data.records || []);
    } catch (err) {
      console.error('Failed to load collection records:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSendWebhook = async () => {
    if (!selectedEndpointId) return;
    setSendingWebhook(true);
    setWebhookResponse(null);

    let parsed = {};
    try {
      parsed = JSON.parse(webhookPayload);
    } catch (err: any) {
      setWebhookResponse({ error: `Invalid JSON syntax: ${err.message}` });
      setSendingWebhook(false);
      return;
    }

    try {
      const res = await fetch(`/api/v1/webhooks/${selectedEndpointId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed),
      });
      const data = await res.json();
      setWebhookResponse(data);
      // Reload emails and db records
      setTimeout(loadData, 500);
    } catch (err: any) {
      setWebhookResponse({ error: err.message });
    } finally {
      setSendingWebhook(false);
    }
  };

  const activeWebhook = endpoints.find((e) => e.id === selectedEndpointId);
  const activeWebhookUrl = activeWebhook
    ? `${window.location.origin}/api/v1/webhooks/${activeWebhook.id}`
    : '';

  const filteredRecords = (records || []).filter((r) => {
    if (!r) return false;
    const term = (recordSearch || '').toLowerCase().trim();
    if (!term) return true;
    return JSON.stringify(r.data || {}).toLowerCase().includes(term);
  });

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-7xl mx-auto w-full select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            Integrations & Data Hub
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Test incoming webhooks, inspect PostgreSQL collections, and view dispatched transactional emails.
          </p>
        </div>

        {/* View Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('webhook')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
              activeTab === 'webhook'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs font-semibold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Webhook className="w-3.5 h-3.5" />
            <span>Webhook Playground</span>
          </button>

          <button
            onClick={() => setActiveTab('database')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
              activeTab === 'database'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs font-semibold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Database Explorer</span>
          </button>

          <button
            onClick={() => setActiveTab('emails')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
              activeTab === 'emails'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs font-semibold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Email Outbox ({emails.length})</span>
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* TAB 1: WEBHOOK PLAYGROUND */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'webhook' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Payload & Sender (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs space-y-3.5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                  Test Inbound Webhook
                </h3>
                <span className="text-[10px] text-slate-400">HTTP POST Simulator</span>
              </div>

              {/* Endpoint Selector */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Target Webhook Endpoint
                </label>
                {endpoints.length === 0 ? (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    No active webhook triggers found. Publish a workflow with a Webhook Trigger node first.
                  </p>
                ) : (
                  <select
                    value={selectedEndpointId}
                    onChange={(e) => setSelectedEndpointId(e.target.value)}
                    className="w-full text-xs px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                  >
                    {endpoints.map((ep) => (
                      <option key={ep.id} value={ep.id}>
                        {ep.name} ({ep.id}) · {ep.callCount || 0} calls
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Endpoint URL */}
              {activeWebhookUrl && (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Endpoint URL
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      readOnly
                      value={activeWebhookUrl}
                      className="flex-1 font-mono text-[11px] px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 truncate"
                    />
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(activeWebhookUrl);
                        setCopiedUrl(true);
                        setTimeout(() => setCopiedUrl(false), 2000);
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                    >
                      {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              )}

              {/* Preset buttons */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Sample Payloads:
                </label>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() =>
                      setWebhookPayload(
                        JSON.stringify(
                          {
                            orderId: 'ORD-VIP-9988',
                            customerName: 'Kavita Rao',
                            customerEmail: 'kavita@techsol.co',
                            amount: 14999,
                            items: [{ id: 'lic_1', name: 'Enterprise Tier', price: 14999 }],
                          },
                          null,
                          2
                        )
                      )
                    }
                    className="px-2.5 py-1 text-[11px] rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                  >
                    High-Value Order (₹14,999)
                  </button>

                  <button
                    onClick={() =>
                      setWebhookPayload(
                        JSON.stringify(
                          {
                            orderId: 'ORD-STD-2210',
                            customerName: 'Aarav Mehta',
                            customerEmail: 'aarav@example.com',
                            amount: 1999,
                            items: [{ id: 'lic_2', name: 'Standard Seat', price: 1999 }],
                          },
                          null,
                          2
                        )
                      )
                    }
                    className="px-2.5 py-1 text-[11px] rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                  >
                    Standard Order (₹1,999)
                  </button>
                </div>
              </div>

              {/* JSON Payload Editor */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Request Body (application/json)
                </label>
                <textarea
                  rows={8}
                  value={webhookPayload}
                  onChange={(e) => setWebhookPayload(e.target.value)}
                  className="w-full font-mono text-xs p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {/* Fire Button */}
              <button
                onClick={handleSendWebhook}
                disabled={sendingWebhook || !selectedEndpointId}
                className="w-full flex items-center justify-center gap-1.5 py-2 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-sm transition-colors cursor-pointer disabled:opacity-50"
              >
                {sendingWebhook ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                <span>Send Webhook POST Request</span>
              </button>
            </div>
          </div>

          {/* Right: Response Inspector & Live Run Jump (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                  HTTP Response
                </h3>
                <span className="text-[10px] text-slate-400">Status & Telemetry</span>
              </div>

              {webhookResponse ? (
                <div className="space-y-3">
                  <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs flex items-center justify-between">
                    <span className="flex items-center gap-1.5 font-medium">
                      <CheckCircle2 className="w-4 h-4" />
                      HTTP 202 Accepted
                    </span>
                    <span className="text-[11px] font-mono">Run Enqueued</span>
                  </div>

                  <pre className="p-3 rounded-lg bg-slate-950 text-emerald-300/90 font-mono text-[11px] max-h-56 overflow-auto">
                    {JSON.stringify(webhookResponse, null, 2)}
                  </pre>

                  {webhookResponse.runId && (
                    <button
                      onClick={() => onNavigateToRun(webhookResponse.runId)}
                      className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 font-semibold text-xs transition-colors cursor-pointer"
                    >
                      <span>Jump to Live Execution ({webhookResponse.runId})</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ) : (
                <div className="py-16 text-center text-slate-400 text-xs space-y-1">
                  <Terminal className="w-6 h-6 mx-auto stroke-1" />
                  <p>Hit "Send Webhook POST Request" to observe real-time trigger handling.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 2: DATABASE EXPLORER */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'database' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Collections List (3 cols) */}
          <div className="lg:col-span-3 space-y-2">
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-2">
              Collections
            </h3>
            {collections.map((col) => (
              <button
                key={col.name}
                onClick={() => loadCollectionRecords(col.name)}
                className={`w-full flex items-center justify-between p-2.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  selectedCollection === col.name
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-2xs'
                    : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Database className="w-3.5 h-3.5" />
                  <span className="capitalize">{col.name}</span>
                </div>
                <span className="text-[10px] opacity-70">{col.count} records</span>
              </button>
            ))}
          </div>

          {/* Records Table (9 cols) */}
          <div className="lg:col-span-9 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder={`Search ${selectedCollection} records...`}
                  value={recordSearch}
                  onChange={(e) => setRecordSearch(e.target.value)}
                  className="w-full text-xs pl-8 pr-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>
              <button
                onClick={() => loadCollectionRecords(selectedCollection)}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Refresh</span>
              </button>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-2xs">
              {filteredRecords.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  No records stored in collection "{selectedCollection}" yet.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {filteredRecords.map((rec) => (
                    <div key={rec.id} className="p-3.5 text-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[11px] font-bold text-slate-700 dark:text-slate-300">
                          {rec.id}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          Saved: {new Date(rec.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <pre className="p-2.5 rounded bg-slate-50 dark:bg-slate-950 font-mono text-[11px] text-slate-800 dark:text-slate-200 overflow-x-auto">
                        {JSON.stringify(rec.data, null, 2)}
                      </pre>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 3: EMAIL OUTBOX */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'emails' && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs overflow-hidden">
          {emails.length === 0 ? (
            <div className="py-16 text-center text-xs text-slate-400">
              No emails sent yet. Execute a workflow containing a Send Email action node to inspect output.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {emails.map((em) => (
                <div key={em.id} className="p-4 space-y-2 text-xs">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 dark:text-white">
                          To: {em.to}
                        </span>
                        <span className="text-[10px] font-semibold uppercase px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                          {em.status}
                        </span>
                      </div>
                      <h4 className="font-semibold text-slate-700 dark:text-slate-300 mt-1">
                        {em.subject}
                      </h4>
                    </div>
                    <span className="text-[10px] text-slate-400 whitespace-nowrap">
                      {new Date(em.sentAt).toLocaleString()}
                    </span>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200/60 dark:border-slate-800 text-[11px] text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                    {em.body}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
