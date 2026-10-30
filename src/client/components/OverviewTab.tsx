import React, { useState } from 'react';
import { Globe, Database, Activity, Clock, Terminal, Copy, Check, Wifi, Server, ArrowUpRight } from 'lucide-react';
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

  const digCommand = `dig @127.0.0.1 -p ${dnsPort} local.dev`;
  const nslookupCommand = `nslookup -port=${dnsPort} local.dev 127.0.0.1`;
  const curlCommand = `curl --resolve local.dev:3000:127.0.0.1 http://local.dev:3000`;

  return (
    <div className="space-y-6">
      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Domains</span>
            <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-400">
              <Globe className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-white">{stats?.domainCount ?? 0}</span>
            <button
              onClick={() => onNavigateTab('domains')}
              className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
            >
              Manage <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="mt-1 text-xs text-slate-500">Configured development zones</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Records</span>
            <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-400">
              <Database className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-white">{stats?.recordCount ?? 0}</span>
            <span className="text-xs text-emerald-400 font-medium">Ready</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">A, AAAA, CNAME & Wildcards</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Queries</span>
            <div className="p-2 bg-cyan-500/10 rounded-xl text-cyan-400">
              <Activity className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-white">{stats?.totalQueries ?? 0}</span>
            <button
              onClick={() => onNavigateTab('logs')}
              className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer"
            >
              Logs <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="mt-1 text-xs text-slate-500">Recorded in local SQLite</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Queries Today</span>
            <div className="p-2 bg-amber-500/10 rounded-xl text-amber-400">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-white">{stats?.queriesToday ?? 0}</span>
            <span className="text-xs text-amber-400 font-medium">Today</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">Traffic since midnight</p>
        </div>
      </div>

      {/* Developer CLI Helper & Network Interfaces */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Terminal Quick Test Commands */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Terminal className="w-5 h-5 text-indigo-400" />
              <h3 className="text-base font-semibold text-white">Local Test Commands</h3>
            </div>
            <span className="text-xs text-slate-400">Verify offline DNS resolution</span>
          </div>

          <div className="space-y-3">
            {/* DIG command */}
            <div>
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                <span>Test with <span className="font-mono text-slate-200">dig</span></span>
                <span className="text-slate-500">UDP Port {dnsPort}</span>
              </div>
              <div className="flex items-center justify-between bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2.5 font-mono text-xs text-slate-300">
                <span className="truncate mr-2">{digCommand}</span>
                <button
                  onClick={() => copyToClipboard(digCommand, 'dig')}
                  className="p-1 rounded text-slate-400 hover:text-white transition-all cursor-pointer"
                  title="Copy command"
                >
                  {copiedCmd === 'dig' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* NSLOOKUP command */}
            <div>
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                <span>Test with <span className="font-mono text-slate-200">nslookup</span></span>
                <span className="text-slate-500">Cross-platform</span>
              </div>
              <div className="flex items-center justify-between bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2.5 font-mono text-xs text-slate-300">
                <span className="truncate mr-2">{nslookupCommand}</span>
                <button
                  onClick={() => copyToClipboard(nslookupCommand, 'nslookup')}
                  className="p-1 rounded text-slate-400 hover:text-white transition-all cursor-pointer"
                  title="Copy command"
                >
                  {copiedCmd === 'nslookup' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* CURL resolve helper */}
            <div>
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                <span>Test with <span className="font-mono text-slate-200">curl --resolve</span></span>
                <span className="text-slate-500">Direct HTTP mapping</span>
              </div>
              <div className="flex items-center justify-between bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2.5 font-mono text-xs text-slate-300">
                <span className="truncate mr-2">{curlCommand}</span>
                <button
                  onClick={() => copyToClipboard(curlCommand, 'curl')}
                  className="p-1 rounded text-slate-400 hover:text-white transition-all cursor-pointer"
                  title="Copy command"
                >
                  {copiedCmd === 'curl' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Local Network Interfaces / Presets */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <Wifi className="w-5 h-5 text-cyan-400" />
            <h3 className="text-base font-semibold text-white">Detected Host IPs</h3>
          </div>
          <p className="text-xs text-slate-400">
            Point your custom domain to your machine's LAN IP so other phones or laptops on your Wi-Fi can resolve your dev projects.
          </p>

          <div className="space-y-2">
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/70 border border-slate-800">
              <div>
                <div className="text-xs font-semibold text-slate-200">Loopback (Localhost)</div>
                <div className="font-mono text-xs text-indigo-400">127.0.0.1</div>
              </div>
              <button
                onClick={() => onQuickAddIpRecord('127.0.0.1')}
                className="text-xs px-2.5 py-1 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 transition-all cursor-pointer"
              >
                + Add Record
              </button>
            </div>

            {stats?.hostIps && stats.hostIps.length > 0 ? (
              stats.hostIps.map((ip) => (
                <div key={ip.name} className="flex items-center justify-between p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                  <div>
                    <div className="text-xs font-semibold text-slate-200">{ip.name} (LAN)</div>
                    <div className="font-mono text-xs text-cyan-400">{ip.address}</div>
                  </div>
                  <button
                    onClick={() => onQuickAddIpRecord(ip.address)}
                    className="text-xs px-2.5 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 transition-all cursor-pointer"
                  >
                    + Add Record
                  </button>
                </div>
              ))
            ) : (
              <div className="text-xs text-slate-500 italic p-2">No external network adapter detected</div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Queries Activity Preview */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-indigo-400" />
            <h3 className="text-base font-semibold text-white">Live Query Feed</h3>
          </div>
          <button
            onClick={() => onNavigateTab('logs')}
            className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1 cursor-pointer"
          >
            View full log stream <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {recentLogs.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-sm">
            No queries logged yet. Run a <span className="font-mono text-slate-400">dig</span> command above to test!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider font-semibold">
                  <th className="py-2.5 px-3">Time</th>
                  <th className="py-2.5 px-3">Client</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Domain</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Answer</th>
                  <th className="py-2.5 px-3 text-right">Latency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {recentLogs.slice(0, 5).map((log, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-2.5 px-3 text-slate-400 font-sans">{new Date(log.timestamp).toLocaleTimeString()}</td>
                    <td className="py-2.5 px-3 text-slate-300">{log.client_ip}</td>
                    <td className="py-2.5 px-3">
                      <span className="px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-bold">
                        {log.query_type}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-white font-medium">{log.query_name}</td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-sans font-semibold uppercase ${
                          log.status === 'NOERROR'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : log.status === 'NXDOMAIN'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                        }`}
                      >
                        {log.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-400 truncate max-w-xs">{log.answer || '-'}</td>
                    <td className="py-2.5 px-3 text-right text-slate-400">{log.latency_ms}ms</td>
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
