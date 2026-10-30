import React, { useState } from 'react';
import { Globe, Database, Activity, Clock, Terminal, Copy, Check, Wifi, ArrowUpRight } from 'lucide-react';
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

  const dnsPort = stats?.dns.port || 5353;

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCmd(id);
    setTimeout(() => setCopiedCmd(null), 2000);
  };

  const pnpmQueryCommand = `pnpm query local.dev`;
  const digCommand = `dig @127.0.0.1 -p ${dnsPort} local.dev`;
  const nslookupCommand = `nslookup -port=${dnsPort} local.dev 127.0.0.1`;

  return (
    <div className="space-y-6">
      {/* Metric Tiles Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-[#12141c]/90 border border-white/[0.07] rounded-2xl p-4 shadow-sm backdrop-blur-md">
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-[11px] font-medium uppercase tracking-wider">Zones</span>
            <Globe className="w-4 h-4 text-neutral-400" strokeWidth={1.75} />
          </div>
          <div className="mt-2.5 flex items-baseline justify-between">
            <span className="text-2xl font-semibold text-white tracking-tight">{stats?.domainCount ?? 0}</span>
            <button
              onClick={() => onNavigateTab('domains')}
              className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-0.5 cursor-pointer font-medium"
            >
              View <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
          <p className="mt-0.5 text-[11px] text-neutral-500">Configured domain zones</p>
        </div>

        <div className="bg-[#12141c]/90 border border-white/[0.07] rounded-2xl p-4 shadow-sm backdrop-blur-md">
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-[11px] font-medium uppercase tracking-wider">Active Records</span>
            <Database className="w-4 h-4 text-neutral-400" strokeWidth={1.75} />
          </div>
          <div className="mt-2.5 flex items-baseline justify-between">
            <span className="text-2xl font-semibold text-white tracking-tight">{stats?.recordCount ?? 0}</span>
            <span className="text-[11px] text-emerald-400 font-medium">Ready</span>
          </div>
          <p className="mt-0.5 text-[11px] text-neutral-500">A, AAAA, CNAME & Wildcards</p>
        </div>

        <div className="bg-[#12141c]/90 border border-white/[0.07] rounded-2xl p-4 shadow-sm backdrop-blur-md">
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-[11px] font-medium uppercase tracking-wider">Total Queries</span>
            <Activity className="w-4 h-4 text-neutral-400" strokeWidth={1.75} />
          </div>
          <div className="mt-2.5 flex items-baseline justify-between">
            <span className="text-2xl font-semibold text-white tracking-tight">{stats?.totalQueries ?? 0}</span>
            <button
              onClick={() => onNavigateTab('logs')}
              className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-0.5 cursor-pointer font-medium"
            >
              Logs <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
          <p className="mt-0.5 text-[11px] text-neutral-500">Stored in SQLite</p>
        </div>

        <div className="bg-[#12141c]/90 border border-white/[0.07] rounded-2xl p-4 shadow-sm backdrop-blur-md">
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-[11px] font-medium uppercase tracking-wider">Today's Traffic</span>
            <Clock className="w-4 h-4 text-neutral-400" strokeWidth={1.75} />
          </div>
          <div className="mt-2.5 flex items-baseline justify-between">
            <span className="text-2xl font-semibold text-white tracking-tight">{stats?.queriesToday ?? 0}</span>
            <span className="text-[11px] text-neutral-400 font-medium">Today</span>
          </div>
          <p className="mt-0.5 text-[11px] text-neutral-500">Queries resolved today</p>
        </div>
      </div>

      {/* Terminal Test Commands & Local Network */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Test Commands Card */}
        <div className="lg:col-span-2 bg-[#12141c]/90 border border-white/[0.07] rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-neutral-400" strokeWidth={1.75} />
              <h3 className="text-sm font-semibold text-white tracking-tight">Test Resolution</h3>
            </div>
            <span className="text-[11px] text-neutral-500 font-mono">Port :{dnsPort} (UDP)</span>
          </div>

          <div className="space-y-2.5">
            {/* Built-in pnpm query */}
            <div className="bg-black/35 border border-white/[0.06] rounded-xl p-3 flex items-center justify-between font-mono text-xs text-neutral-200">
              <div className="min-w-0 pr-3">
                <span className="text-neutral-500 text-[10px] block font-sans uppercase font-medium">Built-in (Zero dependencies needed)</span>
                <span className="text-blue-300 font-medium">{pnpmQueryCommand}</span>
              </div>
              <button
                onClick={() => copyToClipboard(pnpmQueryCommand, 'pnpm')}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/[0.08] active:scale-[0.95] transition-all cursor-pointer"
                title="Copy command"
              >
                {copiedCmd === 'pnpm' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* DIG */}
            <div className="bg-black/35 border border-white/[0.06] rounded-xl p-3 flex items-center justify-between font-mono text-xs text-neutral-200">
              <div className="min-w-0 pr-3">
                <span className="text-neutral-500 text-[10px] block font-sans uppercase font-medium">Standard dig</span>
                <span className="text-neutral-300">{digCommand}</span>
              </div>
              <button
                onClick={() => copyToClipboard(digCommand, 'dig')}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/[0.08] active:scale-[0.95] transition-all cursor-pointer"
                title="Copy command"
              >
                {copiedCmd === 'dig' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* NSLOOKUP */}
            <div className="bg-black/35 border border-white/[0.06] rounded-xl p-3 flex items-center justify-between font-mono text-xs text-neutral-200">
              <div className="min-w-0 pr-3">
                <span className="text-neutral-500 text-[10px] block font-sans uppercase font-medium">Cross-platform nslookup</span>
                <span className="text-neutral-300">{nslookupCommand}</span>
              </div>
              <button
                onClick={() => copyToClipboard(nslookupCommand, 'nslookup')}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/[0.08] active:scale-[0.95] transition-all cursor-pointer"
                title="Copy command"
              >
                {copiedCmd === 'nslookup' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Local Network Interfaces */}
        <div className="bg-[#12141c]/90 border border-white/[0.07] rounded-2xl p-5 shadow-sm space-y-3.5">
          <div className="flex items-center gap-2">
            <Wifi className="w-4 h-4 text-neutral-400" strokeWidth={1.75} />
            <h3 className="text-sm font-semibold text-white tracking-tight">Host Network IPs</h3>
          </div>
          <p className="text-xs text-neutral-400">
            Map dev records to your local IP to access your app from mobile phones or other devices on your Wi-Fi.
          </p>

          <div className="space-y-2">
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-black/30 border border-white/[0.05]">
              <div>
                <div className="text-xs font-medium text-neutral-200">Loopback</div>
                <div className="font-mono text-xs text-blue-400">127.0.0.1</div>
              </div>
              <button
                onClick={() => onQuickAddIpRecord('127.0.0.1')}
                className="text-[11px] px-2.5 py-1 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] active:scale-[0.96] text-neutral-200 transition-all cursor-pointer"
              >
                + Record
              </button>
            </div>

            {stats?.hostIps && stats.hostIps.length > 0 ? (
              stats.hostIps.map((ip) => (
                <div key={ip.name} className="flex items-center justify-between p-2.5 rounded-xl bg-black/30 border border-white/[0.05]">
                  <div>
                    <div className="text-xs font-medium text-neutral-200">{ip.name} (LAN)</div>
                    <div className="font-mono text-xs text-emerald-400">{ip.address}</div>
                  </div>
                  <button
                    onClick={() => onQuickAddIpRecord(ip.address)}
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] active:scale-[0.96] text-neutral-200 transition-all cursor-pointer"
                  >
                    + Record
                  </button>
                </div>
              ))
            ) : null}
          </div>
        </div>
      </div>

      {/* Recent Queries Activity Preview */}
      <div className="bg-[#12141c]/90 border border-white/[0.07] rounded-2xl p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-neutral-400" strokeWidth={1.75} />
            <h3 className="text-sm font-semibold text-white tracking-tight">Recent Queries</h3>
          </div>
          <button
            onClick={() => onNavigateTab('logs')}
            className="text-xs text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1 cursor-pointer"
          >
            Live Feed <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {recentLogs.length === 0 ? (
          <div className="text-center py-6 text-neutral-500 text-xs font-sans">
            No queries logged yet. Test with <span className="font-mono text-neutral-400">pnpm query local.dev</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/[0.06] text-neutral-400 uppercase tracking-wider text-[10px] font-medium">
                  <th className="py-2 px-3">Time</th>
                  <th className="py-2 px-3">Client</th>
                  <th className="py-2 px-3">Type</th>
                  <th className="py-2 px-3">Domain</th>
                  <th className="py-2 px-3">Status</th>
                  <th className="py-2 px-3">Answer</th>
                  <th className="py-2 px-3 text-right">Latency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04] font-mono">
                {recentLogs.slice(0, 5).map((log, idx) => (
                  <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-2 px-3 text-neutral-400 font-sans">{new Date(log.timestamp).toLocaleTimeString()}</td>
                    <td className="py-2 px-3 text-neutral-300">{log.client_ip}</td>
                    <td className="py-2 px-3">
                      <span className="px-1.5 py-0.5 rounded bg-white/[0.06] text-neutral-200 border border-white/[0.06] font-semibold text-[10px]">
                        {log.query_type}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-white font-medium">{log.query_name}</td>
                    <td className="py-2 px-3">
                      <span
                        className={`inline-flex items-center gap-1.5 text-[11px] font-sans font-medium ${
                          log.status === 'NOERROR'
                            ? 'text-emerald-400'
                            : log.status === 'NXDOMAIN'
                            ? 'text-amber-400'
                            : 'text-neutral-300'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          log.status === 'NOERROR' ? 'bg-emerald-400' : log.status === 'NXDOMAIN' ? 'bg-amber-400' : 'bg-neutral-400'
                        }`} />
                        {log.status}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-neutral-400 truncate max-w-xs">{log.answer || '—'}</td>
                    <td className="py-2 px-3 text-right text-neutral-400">{log.latency_ms}ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
