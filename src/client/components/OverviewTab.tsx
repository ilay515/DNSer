import React, { useState } from 'react';
import {
  Globe,
  Database,
  Activity,
  Terminal,
  Copy,
  Check,
  Wifi,
  ArrowUpRight,
  Plus,
  Play,
  Sparkles,
  Zap
} from 'lucide-react';
import { api } from '../api.js';
import type { ServerStats, QueryLogEntry } from '../types.js';

interface OverviewTabProps {
  stats: ServerStats | null;
  recentLogs: QueryLogEntry[];
  onNavigateTab: (tab: 'domains' | 'logs' | 'users' | 'settings') => void;
  onQuickAddIpRecord: (ip: string) => void;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  stats,
  recentLogs,
  onNavigateTab,
  onQuickAddIpRecord,
}) => {
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);
  const [cliTab, setCliTab] = useState<'pnpm' | 'dig' | 'nslookup' | 'curl'>('pnpm');

  // Quick route bar state
  const [quickDomain, setQuickDomain] = useState('');
  const [quickTarget, setQuickTarget] = useState('127.0.0.1');
  const [isAddingRoute, setIsAddingRoute] = useState(false);
  const [routeFeedback, setRouteFeedback] = useState<string | null>(null);

  // In-browser test resolver state
  const [testQueryInput, setTestQueryInput] = useState('local.dev');
  const [testResult, setTestResult] = useState<{ status: string; answer?: string; time: number } | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  const dnsPort = stats?.dns.port || 5353;

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCmd(id);
    setTimeout(() => setCopiedCmd(null), 2000);
  };

  const commands = {
    pnpm: `pnpm query ${testQueryInput || 'local.dev'}`,
    dig: `dig @127.0.0.1 -p ${dnsPort} ${testQueryInput || 'local.dev'}`,
    nslookup: `nslookup -port=${dnsPort} ${testQueryInput || 'local.dev'} 127.0.0.1`,
    curl: `curl --resolve ${testQueryInput || 'local.dev'}:3000:127.0.0.1 http://${testQueryInput || 'local.dev'}:3000`,
  };

  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickDomain.trim()) return;

    setIsAddingRoute(true);
    setRouteFeedback(null);
    try {
      await api.quickRoute(quickDomain.trim(), quickTarget.trim());
      setRouteFeedback(`Added ${quickDomain.trim()} → ${quickTarget.trim()}`);
      setQuickDomain('');
      setTimeout(() => setRouteFeedback(null), 3000);
    } catch (err: any) {
      setRouteFeedback(`Error: ${err.message || 'Failed to add route'}`);
    } finally {
      setIsAddingRoute(false);
    }
  };

  const handleTestResolve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testQueryInput.trim()) return;

    setIsTesting(true);
    setTestResult(null);
    const start = performance.now();

    try {
      const records = await api.getRecords();
      const cleanQ = testQueryInput.trim().toLowerCase().replace(/\.+$/, '');
      const duration = Math.max(1, Math.round(performance.now() - start));

      const matched = records.find(r => {
        const rName = r.name.toLowerCase().replace(/\.+$/, '');
        if (rName === cleanQ) return true;
        if (rName.startsWith('*.') && (cleanQ === rName.slice(2) || cleanQ.endsWith('.' + rName.slice(2)))) {
          return true;
        }
        return false;
      });

      if (matched && matched.is_active) {
        setTestResult({
          status: 'NOERROR',
          answer: `${matched.type} ${matched.value}`,
          time: duration,
        });
      } else {
        setTestResult({
          status: 'NXDOMAIN',
          answer: 'No route found in local database',
          time: duration,
        });
      }
    } catch (err: any) {
      setTestResult({
        status: 'ERROR',
        answer: err.message,
        time: 0,
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleQuickRouteFromLog = async (queryName: string) => {
    try {
      await api.quickRoute(queryName, '127.0.0.1');
      setRouteFeedback(`Routed ${queryName} → 127.0.0.1`);
      setTimeout(() => setRouteFeedback(null), 3000);
    } catch (err: any) {
      alert(`Could not add route: ${err.message}`);
    }
  };

  const formatRelativeTime = (isoString: string) => {
    const diffSeconds = Math.round((Date.now() - new Date(isoString).getTime()) / 1000);
    if (diffSeconds < 5) return 'just now';
    if (diffSeconds < 60) return `${diffSeconds}s ago`;
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    return new Date(isoString).toLocaleTimeString();
  };

  return (
    <div className="space-y-6">
      {/* Human Hero Header */}
      <div className="bg-gradient-to-r from-blue-900/15 via-[#12141c] to-[#12141c] border border-white/[0.08] rounded-2xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
            <h2 className="text-lg font-semibold text-white tracking-tight">
              DNSer is active on <span className="font-mono text-emerald-400">127.0.0.1:{dnsPort}</span>
            </h2>
          </div>
          <p className="text-xs text-neutral-400">
            {stats?.domainCount || 0} zones • {stats?.recordCount || 0} active dev routes • {stats?.totalQueries || 0} queries served
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigateTab('domains')}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] text-xs font-medium text-white transition-all cursor-pointer active:scale-[0.97]"
          >
            Manage Zones <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onNavigateTab('logs')}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/25 text-xs font-medium transition-all cursor-pointer active:scale-[0.97]"
          >
            Live Logs <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Instant Route Creator (No clunky modals needed) */}
      <div className="bg-[#12141c]/90 border border-white/[0.07] rounded-2xl p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" strokeWidth={1.8} />
            <h3 className="text-sm font-semibold text-white tracking-tight">Quick Route</h3>
            <span className="text-[11px] text-neutral-500">— point any domain to your local machine instantly</span>
          </div>

          {routeFeedback && (
            <span className="text-xs font-medium text-emerald-400 animate-fade-in flex items-center gap-1">
              <Check className="w-3.5 h-3.5" /> {routeFeedback}
            </span>
          )}
        </div>

        <form onSubmit={handleQuickAdd} className="flex flex-col sm:flex-row items-stretch gap-2.5">
          <div className="flex-1 relative">
            <input
              type="text"
              required
              placeholder="e.g. api.project.local or *.test"
              value={quickDomain}
              onChange={(e) => setQuickDomain(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-black/40 border border-white/[0.08] rounded-xl text-neutral-100 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/40 font-mono"
            />
          </div>

          <div className="sm:w-56">
            <select
              value={quickTarget}
              onChange={(e) => setQuickTarget(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-black/40 border border-white/[0.08] rounded-xl text-neutral-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/40 font-mono"
            >
              <option value="127.0.0.1">127.0.0.1 (Localhost)</option>
              {stats?.hostIps?.map(ip => (
                <option key={ip.address} value={ip.address}>
                  {ip.address} ({ip.name})
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={isAddingRoute}
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-all active:scale-[0.97] cursor-pointer shadow-sm disabled:opacity-50"
          >
            <Plus className="w-4 h-4" /> Add Route
          </button>
        </form>
      </div>

      {/* Interactive Testing & Command Copy Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Live In-Browser Test Resolver */}
        <div className="bg-[#12141c]/90 border border-white/[0.07] rounded-2xl p-5 shadow-sm space-y-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-400" strokeWidth={1.8} />
              <h3 className="text-sm font-semibold text-white tracking-tight">Test Resolver</h3>
            </div>
            <span className="text-[11px] text-neutral-500">Instant lookup verification</span>
          </div>

          <form onSubmit={handleTestResolve} className="flex gap-2">
            <input
              type="text"
              value={testQueryInput}
              onChange={(e) => setTestQueryInput(e.target.value)}
              placeholder="Domain to test..."
              className="flex-1 px-3 py-2 bg-black/40 border border-white/[0.08] rounded-xl text-neutral-100 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/40 font-mono"
            />
            <button
              type="submit"
              disabled={isTesting}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] text-xs font-medium text-white transition-all cursor-pointer active:scale-[0.97]"
            >
              <Play className="w-3.5 h-3.5" /> Resolve
            </button>
          </form>

          {testResult && (
            <div className="p-3 rounded-xl bg-black/30 border border-white/[0.06] text-xs flex items-center justify-between font-mono">
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  testResult.status === 'NOERROR'
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                    : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                }`}>
                  {testResult.status}
                </span>
                <span className="text-neutral-200">{testResult.answer}</span>
              </div>
              <span className="text-neutral-500 text-[11px] font-sans">{testResult.time}ms</span>
            </div>
          )}
        </div>

        {/* CLI Snippets with Friendly Tabs */}
        <div className="bg-[#12141c]/90 border border-white/[0.07] rounded-2xl p-5 shadow-sm space-y-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-neutral-400" strokeWidth={1.8} />
              <h3 className="text-sm font-semibold text-white tracking-tight">Terminal Command</h3>
            </div>

            {/* Segmented CLI tool selector */}
            <div className="flex items-center p-0.5 rounded-lg bg-black/40 border border-white/[0.06] text-[10px] font-mono">
              {(['pnpm', 'dig', 'nslookup', 'curl'] as const).map(tab => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setCliTab(tab)}
                  className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
                    cliTab === tab
                      ? 'bg-white/[0.12] text-white font-medium'
                      : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-black/40 border border-white/[0.07] rounded-xl p-3 flex items-center justify-between font-mono text-xs text-neutral-200">
            <span className="truncate pr-3 text-neutral-300">{commands[cliTab]}</span>
            <button
              onClick={() => copyToClipboard(commands[cliTab], cliTab)}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/[0.08] active:scale-[0.95] transition-all cursor-pointer shrink-0"
              title="Copy snippet"
            >
              {copiedCmd === cliTab ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Live Recent Activity Stream with 1-Click Route */}
      <div className="bg-[#12141c]/90 border border-white/[0.07] rounded-2xl p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-neutral-400" strokeWidth={1.8} />
            <h3 className="text-sm font-semibold text-white tracking-tight">Live Query Traffic</h3>
          </div>
          <button
            onClick={() => onNavigateTab('logs')}
            className="text-xs text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1 cursor-pointer"
          >
            All Activity <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {recentLogs.length === 0 ? (
          <div className="text-center py-8 text-neutral-500 text-xs font-sans">
            No queries logged yet. Run <code className="text-neutral-300 font-mono">pnpm query local.dev</code> to see live queries appear here!
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {recentLogs.slice(0, 6).map((log, idx) => (
              <div key={idx} className="py-2.5 px-2 flex items-center justify-between gap-3 text-xs font-mono hover:bg-white/[0.02] rounded-xl transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    log.status === 'NOERROR' ? 'bg-emerald-400' : log.status === 'NXDOMAIN' ? 'bg-amber-400' : 'bg-neutral-400'
                  }`} />
                  <span className="font-semibold text-white truncate">{log.query_name}</span>
                  <span className="px-1.5 py-0.2 rounded text-[10px] bg-white/[0.06] text-neutral-400 font-bold shrink-0">
                    {log.query_type}
                  </span>
                  <span className="text-neutral-400 truncate max-w-xs hidden sm:inline text-[11px]">
                    {log.answer ? `→ ${log.answer}` : '(not found)'}
                  </span>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {log.status === 'NXDOMAIN' && (
                    <button
                      onClick={() => handleQuickRouteFromLog(log.query_name)}
                      className="text-[11px] px-2 py-0.5 rounded-md bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/25 transition-all cursor-pointer font-sans"
                      title="Instantly point this domain to 127.0.0.1"
                    >
                      + Route to 127.0.0.1
                    </button>
                  )}
                  <span className="text-neutral-500 text-[11px] font-sans">
                    {formatRelativeTime(log.timestamp)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
