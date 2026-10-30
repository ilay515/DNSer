import React, { useState, useEffect } from 'react';
import { Settings, Save, Check, AlertCircle, HelpCircle } from 'lucide-react';
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
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const isAdmin = user.role === 'admin';

  const loadSettings = async () => {
    try {
      const s = await api.getSettings();
      setSettings(s);
      setUpstreamEnabled(s.upstream_enabled);
      setUpstreamServer(s.upstream_server || '1.1.1.1:53');
      setRetention(s.query_log_retention || 5000);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to load settings' });
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
      setMessage({ type: 'success', text: 'Settings saved' });
      onRefreshStats();
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      {message && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center gap-2 ${
            message.type === 'success'
              ? 'bg-emerald-500/[0.08] border-emerald-500/20 text-emerald-400'
              : 'bg-red-500/[0.08] border-red-500/20 text-red-400'
          }`}
        >
          {message.type === 'success' ? <Check className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{message.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left 2 Cols: Settings */}
        <div className="lg:col-span-2 bg-[#12141c]/90 border border-white/[0.07] rounded-2xl p-5 shadow-sm space-y-5">
          <div className="flex items-center gap-2 pb-3 border-b border-white/[0.06]">
            <Settings className="w-4 h-4 text-neutral-400" strokeWidth={1.75} />
            <h3 className="text-sm font-semibold text-white tracking-tight">Daemon Settings</h3>
          </div>

          <form onSubmit={handleSave} className="space-y-5">
            {/* Upstream Relay Section */}
            <div className="p-4 rounded-xl bg-black/30 border border-white/[0.05] space-y-3.5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-white text-xs">Upstream DNS Relay</div>
                  <div className="text-[11px] text-neutral-400 mt-0.5">
                    {upstreamEnabled
                      ? 'Forward lookups for unknown domains to external upstream DNS'
                      : 'Strict Offline: Unknown domains immediately return NXDOMAIN'}
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
                  <div className="w-9 h-5 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              {upstreamEnabled && (
                <div className="pt-2 border-t border-white/[0.04]">
                  <label className="block text-[11px] font-medium text-neutral-400 uppercase tracking-wider mb-1.5">
                    Upstream Server (IP:Port)
                  </label>
                  <input
                    type="text"
                    value={upstreamServer}
                    onChange={(e) => setUpstreamServer(e.target.value)}
                    disabled={!isAdmin}
                    placeholder="1.1.1.1:53"
                    className="w-full px-3 py-2 bg-black/40 border border-white/[0.08] rounded-xl text-neutral-100 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/40 font-mono"
                  />
                  <div className="mt-2 flex items-center gap-1.5 text-[11px]">
                    <span className="text-neutral-500">Presets:</span>
                    <button
                      type="button"
                      onClick={() => setUpstreamServer('1.1.1.1:53')}
                      className="px-2 py-0.5 rounded-md bg-white/[0.05] hover:bg-white/[0.1] text-blue-400 font-mono cursor-pointer"
                    >
                      Cloudflare (1.1.1.1)
                    </button>
                    <button
                      type="button"
                      onClick={() => setUpstreamServer('8.8.8.8:53')}
                      className="px-2 py-0.5 rounded-md bg-white/[0.05] hover:bg-white/[0.1] text-emerald-400 font-mono cursor-pointer"
                    >
                      Google (8.8.8.8)
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Retention Limit */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-medium text-neutral-400 uppercase tracking-wider">
                Log Retention Limit
              </label>
              <input
                type="number"
                min="100"
                max="50000"
                step="100"
                value={retention}
                onChange={(e) => setRetention(parseInt(e.target.value, 10) || 5000)}
                disabled={!isAdmin}
                className="w-full px-3 py-2 bg-black/40 border border-white/[0.08] rounded-xl text-neutral-100 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/40 font-mono"
              />
              <p className="text-[11px] text-neutral-500">
                Maximum queries retained in the local SQLite database.
              </p>
            </div>

            {/* Ports Info */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="p-3 rounded-xl bg-black/30 border border-white/[0.05]">
                <span className="text-[11px] text-neutral-400 block">DNS Port (UDP)</span>
                <span className="text-base font-mono font-medium text-emerald-400">:{settings?.dns_port || 5353}</span>
              </div>
              <div className="p-3 rounded-xl bg-black/30 border border-white/[0.05]">
                <span className="text-[11px] text-neutral-400 block">HTTP Web Port</span>
                <span className="text-base font-mono font-medium text-blue-400">:{settings?.http_port || 3000}</span>
              </div>
            </div>

            {isAdmin && (
              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-[0.97] text-white text-xs font-medium transition-all cursor-pointer shadow-sm disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" /> {saving ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            )}
          </form>
        </div>

        {/* Right Col: Routing Guide */}
        <div className="bg-[#12141c]/90 border border-white/[0.07] rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-white/[0.06]">
            <HelpCircle className="w-4 h-4 text-neutral-400" strokeWidth={1.75} />
            <h3 className="text-xs font-semibold text-white tracking-tight uppercase">System Routing</h3>
          </div>

          <div className="space-y-4 text-xs text-neutral-300">
            <div>
              <div className="font-medium text-white mb-1">Single Command Testing</div>
              <div className="p-2 rounded-lg bg-black/40 font-mono text-[11px] text-neutral-300 border border-white/[0.06] overflow-x-auto">
                pnpm query local.dev
              </div>
            </div>

            <div>
              <div className="font-medium text-white mb-1">Docker Containers</div>
              <div className="p-2 rounded-lg bg-black/40 font-mono text-[11px] text-neutral-300 border border-white/[0.06] overflow-x-auto">
                docker run --dns 172.17.0.1 ...
              </div>
            </div>

            <div>
              <div className="font-medium text-white mb-1">Rootless Port 53 on Linux</div>
              <div className="p-2 rounded-lg bg-black/40 font-mono text-[11px] text-neutral-300 border border-white/[0.06] overflow-x-auto">
                sudo setcap 'cap_net_bind_service=+ep' $(which node)
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
