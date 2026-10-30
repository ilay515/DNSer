import React, { useState, useEffect, useRef } from 'react';
import { Activity, Play, Pause, Trash2, Search, Filter, ArrowDown, Wifi, RefreshCw } from 'lucide-react';
import { api, authStorage } from '../api.js';
import type { QueryLogEntry, UserPublic } from '../types.js';

interface LogsTabProps {
  user: UserPublic;
  onRefreshStats: () => void;
}

export const LogsTab: React.FC<LogsTabProps> = ({ user, onRefreshStats }) => {
  const [logs, setLogs] = useState<QueryLogEntry[]>([]);
  const [isStreaming, setIsStreaming] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [autoScroll, setAutoScroll] = useState(true);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Initial fetch of logs
  const fetchRecentLogs = async () => {
    try {
      const res = await api.getLogs({ limit: 100 });
      setLogs(res.logs);
    } catch (err) {
      console.error('Failed to load initial logs:', err);
    }
  };

  useEffect(() => {
    fetchRecentLogs();
  }, []);

  // SSE Stream Setup
  useEffect(() => {
    if (!isStreaming) {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      return;
    }

    const token = authStorage.getToken() || '';
    const sseUrl = `/api/logs/stream?token=${encodeURIComponent(token)}`;
    const es = new EventSource(sseUrl);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const entry: QueryLogEntry = JSON.parse(event.data);
        setLogs((prev) => [entry, ...prev.slice(0, 500)]);
      } catch (err) {
        // Ignore ping/heartbeat comments
      }
    };

    es.onerror = () => {
      // Reconnection handled automatically by browser EventSource
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [isStreaming]);

  const handleClearLogs = async () => {
    if (!confirm('Clear all query logs?')) return;
    try {
      await api.clearLogs();
      setLogs([]);
      onRefreshStats();
    } catch (err) {
      console.error('Failed to clear logs:', err);
    }
  };

  const filteredLogs = logs.filter((log) => {
    if (statusFilter !== 'ALL' && log.status !== statusFilter) return false;
    if (typeFilter !== 'ALL' && log.query_type !== typeFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        log.query_name.toLowerCase().includes(q) ||
        log.client_ip.toLowerCase().includes(q) ||
        (log.answer && log.answer.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Controls Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-cyan-400" />
            <h3 className="font-bold text-white text-base">DNS Query Logs</h3>
          </div>

          {/* Stream Status indicator */}
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-slate-950 border border-slate-800 text-xs">
            <span className="relative flex h-2 w-2">
              {isStreaming && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              )}
              <span className={`relative inline-flex rounded-full h-2 w-2 ${isStreaming ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
            </span>
            <span className="text-slate-400 font-mono text-[11px]">
              {isStreaming ? 'LIVE STREAM' : 'PAUSED'}
            </span>
          </div>
        </div>

        {/* Action Buttons & Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative flex-1 sm:w-48">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search domain or IP..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none"
          >
            <option value="ALL">All Status</option>
            <option value="NOERROR">NOERROR (Resolved)</option>
            <option value="NXDOMAIN">NXDOMAIN (Not Found)</option>
            <option value="FORWARDED">FORWARDED (Relayed)</option>
          </select>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none"
          >
            <option value="ALL">All Types</option>
            <option value="A">A</option>
            <option value="AAAA">AAAA</option>
            <option value="CNAME">CNAME</option>
            <option value="TXT">TXT</option>
            <option value="MX">MX</option>
          </select>

          {/* Play/Pause Button */}
          <button
            onClick={() => setIsStreaming(!isStreaming)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
              isStreaming
                ? 'bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20'
                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
            }`}
          >
            {isStreaming ? (
              <>
                <Pause className="w-3.5 h-3.5" /> Pause
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" /> Resume
              </>
            )}
          </button>

          {/* Clear Logs */}
          <button
            onClick={handleClearLogs}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 border border-slate-800 hover:border-rose-500/20 text-xs font-semibold transition-all cursor-pointer"
            title="Clear All Logs"
          >
            <Trash2 className="w-3.5 h-3.5" /> Clear
          </button>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div ref={logContainerRef} className="max-h-[650px] overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-slate-950/90 backdrop-blur-md border-b border-slate-800 text-slate-400 uppercase tracking-wider font-semibold z-10">
              <tr>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Client IP</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Query Name</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Answer / Destination</th>
                <th className="py-3 px-4 text-right">Latency</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {filteredLogs.map((log, index) => {
                const date = new Date(log.timestamp);
                const timeStr = date.toLocaleTimeString() + '.' + String(date.getMilliseconds()).padStart(3, '0');
                return (
                  <tr key={log.id || index} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-2.5 px-4 text-slate-400 font-sans">{timeStr}</td>
                    <td className="py-2.5 px-4 text-slate-300 font-semibold">{log.client_ip}</td>
                    <td className="py-2.5 px-4">
                      <span className="px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-bold">
                        {log.query_type}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-white font-medium">{log.query_name}</td>
                    <td className="py-2.5 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-sans font-semibold uppercase ${
                          log.status === 'NOERROR'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : log.status === 'NXDOMAIN'
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                        }`}
                      >
                        {log.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-slate-300 max-w-sm truncate">{log.answer || '-'}</td>
                    <td className="py-2.5 px-4 text-right text-slate-400">{log.latency_ms}ms</td>
                  </tr>
                );
              })}

              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500 font-sans text-sm">
                    No matching queries found in logs.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
