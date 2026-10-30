import React, { useState, useEffect, useRef } from 'react';
import { Activity, Play, Pause, Trash2, Search, X } from 'lucide-react';
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
  const logContainerRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

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
        // Ignore pings
      }
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [isStreaming]);

  const handleClearLogs = async () => {
    if (!confirm('Clear query log history?')) return;
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
      <div className="bg-[#12141c]/90 border border-white/[0.07] rounded-2xl p-3.5 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-neutral-400" strokeWidth={1.75} />
            <h3 className="font-semibold text-white text-sm tracking-tight">Query Inspector</h3>
          </div>

          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.06] text-[11px]">
            <span className={`w-1.5 h-1.5 rounded-full ${isStreaming ? 'bg-emerald-400' : 'bg-amber-400'}`} />
            <span className="text-neutral-400 font-mono text-[10px]">
              {isStreaming ? 'STREAMING' : 'PAUSED'}
            </span>
          </div>
        </div>

        {/* Filters and Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative flex-1 sm:w-44">
            <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-7 pr-2.5 py-1.5 bg-black/35 border border-white/[0.07] rounded-xl text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-black/35 border border-white/[0.07] rounded-xl text-xs text-neutral-300 focus:outline-none"
          >
            <option value="ALL">All Status</option>
            <option value="NOERROR">NOERROR</option>
            <option value="NXDOMAIN">NXDOMAIN</option>
            <option value="FORWARDED">FORWARDED</option>
          </select>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-black/35 border border-white/[0.07] rounded-xl text-xs text-neutral-300 focus:outline-none"
          >
            <option value="ALL">All Types</option>
            <option value="A">A</option>
            <option value="AAAA">AAAA</option>
            <option value="CNAME">CNAME</option>
            <option value="TXT">TXT</option>
            <option value="MX">MX</option>
          </select>

          {/* Pause / Resume */}
          <button
            onClick={() => setIsStreaming(!isStreaming)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-white/[0.06] hover:bg-white/[0.1] active:scale-[0.96] text-neutral-200 transition-all cursor-pointer"
          >
            {isStreaming ? (
              <>
                <Pause className="w-3 h-3" /> Pause
              </>
            ) : (
              <>
                <Play className="w-3 h-3" /> Resume
              </>
            )}
          </button>

          {/* Clear */}
          <button
            onClick={handleClearLogs}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white/[0.04] hover:bg-red-500/[0.1] text-neutral-400 hover:text-red-400 active:scale-[0.96] text-xs font-medium transition-all cursor-pointer"
            title="Clear Logs"
          >
            <Trash2 className="w-3 h-3" /> Clear
          </button>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-[#12141c]/90 border border-white/[0.07] rounded-2xl shadow-sm overflow-hidden">
        <div ref={logContainerRef} className="max-h-[620px] overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-[#0e0f14]/95 backdrop-blur-md border-b border-white/[0.06] text-neutral-400 uppercase tracking-wider text-[10px] font-medium z-10">
              <tr>
                <th className="py-2.5 px-3.5">Time</th>
                <th className="py-2.5 px-3.5">Client IP</th>
                <th className="py-2.5 px-3.5">Type</th>
                <th className="py-2.5 px-3.5">Question</th>
                <th className="py-2.5 px-3.5">Status</th>
                <th className="py-2.5 px-3.5">Answer</th>
                <th className="py-2.5 px-3.5 text-right">Latency</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03] font-mono">
              {filteredLogs.map((log, index) => {
                const date = new Date(log.timestamp);
                const timeStr = date.toLocaleTimeString() + '.' + String(date.getMilliseconds()).padStart(3, '0');
                return (
                  <tr key={log.id || index} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-2 px-3.5 text-neutral-400 font-sans">{timeStr}</td>
                    <td className="py-2 px-3.5 text-neutral-300">{log.client_ip}</td>
                    <td className="py-2 px-3.5">
                      <span className="px-1.5 py-0.5 rounded bg-white/[0.06] text-neutral-200 border border-white/[0.06] font-semibold text-[10px]">
                        {log.query_type}
                      </span>
                    </td>
                    <td className="py-2 px-3.5 text-white font-medium">{log.query_name}</td>
                    <td className="py-2 px-3.5">
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
                    <td className="py-2 px-3.5 text-neutral-400 max-w-sm truncate">{log.answer || '—'}</td>
                    <td className="py-2 px-3.5 text-right text-neutral-400">{log.latency_ms}ms</td>
                  </tr>
                );
              })}

              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-neutral-500 font-sans text-xs">
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
