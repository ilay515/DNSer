import React, { useState, useEffect } from 'react';
import { Settings, Save, Server, Shield, Radio, Check, AlertCircle, Terminal, HelpCircle } from 'lucide-react';
import { api } from '../api.js';
import type { ServerSettings, UserPublic, ServerStats } from '../types.js';

interface SettingsTabProps {
  user: UserPublic;
  stats: ServerStats | null;
  onRefreshStats: () => void;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({ user, stats, onRefreshStats }) => {
  const [settings, setSettings] = useState<ServerSettings | null>(null);
  const [upstreamEnabled, setUpstreamEnabled] = useState(false);
  const [upstreamServer, setUpstreamServer] = useState('1.1.1.1:53');
  const [retention, setRetention] = useState(5000);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const isAdmin = user.role === 'admin';

  const loadSettings = async () => {
    setLoading(true);
    try {
      const s = await api.getSettings();
      setSettings(s);
      setUpstreamEnabled(s.upstream_enabled);
      setUpstreamServer(s.upstream_server || '1.1.1.1:53');
      setRetention(s.query_log_retention || 5000);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to load settings' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    setSaving(true);
    setMessage(null);
    try {
      const updated = await api.updateSettings({
        upstream_enabled: upstreamEnabled,
        upstream_server: upstreamServer.trim(),
        query_log_retention: retention,
      });
      setSettings(updated);
      setMessage({ type: 'success', text: 'Server settings saved successfully!' });
      onRefreshStats();
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {message && (
        <div
          className={`p-4 rounded-xl border text-sm flex items-center gap-2 ${
            message.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
              : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
          }`}
        >
          {message.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          <span>{message.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Server Configuration */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
          <div className="flex items-center gap-2 pb-4 border-b border-slate-800">
            <Settings className="w-5 h-5 text-indigo-400" />
            <h3 className="text-base font-bold text-white">DNS Daemon Configuration</h3>
          </div>

          <form onSubmit={handleSave} className="space-y-6">
            {/* Offline vs Upstream Mode */}
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-white text-sm">Upstream DNS Relay</div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {upstreamEnabled
                      ? 'Relay mode active: Forward queries for unknown domains to public upstream DNS'
                      : 'Strict Offline mode active: Unknown domains immediately return NXDOMAIN without internet access'}
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={upstreamEnabled}
                    onChange={(e) => setUpstreamEnabled(e.target.checked)}
                    disabled={!isAdmin}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>

              {upstreamEnabled && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Upstream Server (IP:Port)
                  </label>
                  <input
                    type="text"
                    value={upstreamServer}
                    onChange={(e) => setUpstreamServer(e.target.value)}
                    disabled={!isAdmin}
                    placeholder="1.1.1.1:53"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-[11px] text-slate-500">Presets:</span>
                    <button
                      type="button"
                      onClick={() => setUpstreamServer('1.1.1.1:53')}
                      className="text-[11px] px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-indigo-400 font-mono cursor-pointer"
                    >
                      Cloudflare (1.1.1.1)
                    </button>
                    <button
                      type="button"
                      onClick={() => setUpstreamServer('8.8.8.8:53')}
                      className="text-[11px] px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-cyan-400 font-mono cursor-pointer"
                    >
                      Google (8.8.8.8)
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Retention */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Query Log Retention Limit
              </label>
              <input
                type="number"
                min="100"
                max="50000"
                step="100"
                value={retention}
                onChange={(e) => setRetention(parseInt(e.target.value, 10) || 5000)}
                disabled={!isAdmin}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
              />
              <p className="mt-1 text-xs text-slate-500">
                Number of historical DNS queries retained in the local SQLite database before auto-pruning.
              </p>
            </div>

            {/* Current Ports Information */}
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
                <span className="text-xs text-slate-400 block">DNS Listening Port (UDP)</span>
                <span className="text-lg font-mono font-bold text-emerald-400">:{settings?.dns_port || 5353}</span>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
                <span className="text-xs text-slate-400 block">Web Dashboard Port (HTTP)</span>
                <span className="text-lg font-mono font-bold text-indigo-400">:{settings?.http_port || 3000}</span>
              </div>
            </div>

            {isAdmin && (
              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all cursor-pointer shadow-md disabled:opacity-50"
                >
                  <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            )}
          </form>
        </div>

        {/* Right Col: Setup & Integration Guide */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
            <HelpCircle className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-bold text-white">How to Route to DNSer</h3>
          </div>

          <div className="space-y-4 text-xs text-slate-300">
            <div>
              <div className="font-semibold text-white mb-1">1. Single Command Testing</div>
              <p className="text-slate-400 mb-2">No system changes needed:</p>
              <div className="p-2.5 rounded-lg bg-slate-950 font-mono text-[11px] text-slate-300 border border-slate-800 overflow-x-auto">
                dig @127.0.0.1 -p {settings?.dns_port || 5353} local.dev
              </div>
            </div>

            <div>
              <div className="font-semibold text-white mb-1">2. Docker Containers</div>
              <p className="text-slate-400 mb-2">Configure Docker container to resolve dev domains:</p>
              <div className="p-2.5 rounded-lg bg-slate-950 font-mono text-[11px] text-slate-300 border border-slate-800 overflow-x-auto">
                docker run --dns 172.17.0.1 ...
              </div>
            </div>

            <div>
              <div className="font-semibold text-white mb-1">3. Binding to Standard Port 53</div>
              <p className="text-slate-400 mb-2">
                To bind to port 53 without running as root, grant Node Linux network capabilities:
              </p>
              <div className="p-2.5 rounded-lg bg-slate-950 font-mono text-[11px] text-slate-300 border border-slate-800 overflow-x-auto">
                sudo setcap 'cap_net_bind_service=+ep' $(which node)
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
