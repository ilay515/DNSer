import React, { useState } from 'react';
import { Server, ArrowRight, ShieldCheck } from 'lucide-react';
import { api } from '../api.js';
import type { UserPublic } from '../types.js';

interface LoginPageProps {
  onLoginSuccess: (user: UserPublic) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;

    setError(null);
    setLoading(true);
    try {
      const res = await api.login(username.trim(), password);
      onLoginSuccess(res.user);
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleFillDefaults = () => {
    setUsername('admin');
    setPassword('admin123');
    setError(null);
  };

  return (
    <div className="min-h-screen bg-[#0a0b0e] flex flex-col justify-center items-center px-4 sm:px-6 relative selection:bg-blue-600/30">
      <div className="max-w-[380px] w-full space-y-7 z-10">
        {/* App Icon & Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-b from-white/[0.12] to-white/[0.04] border border-white/[0.12] shadow-[0_8px_20px_rgba(0,0,0,0.4)] text-blue-400">
            <Server className="w-7 h-7" strokeWidth={1.75} />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-white">DNSer</h1>
            <p className="text-xs text-neutral-400 mt-1 font-normal">
              Local developer DNS daemon & dashboard
            </p>
          </div>
        </div>

        {/* Form Card */}
        <div className="bg-[#12141c]/90 border border-white/[0.08] rounded-2xl p-7 shadow-[0_20px_40px_rgba(0,0,0,0.6)] backdrop-blur-xl">
          <form className="space-y-4" onSubmit={handleSubmit}>
            {error && (
              <div className="p-3 rounded-xl bg-red-500/[0.08] border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-[11px] font-medium tracking-wide uppercase text-neutral-400">
                Username
              </label>
              <input
                type="text"
                required
                autoFocus
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                className="w-full px-3.5 py-2.5 bg-black/40 border border-white/[0.08] rounded-xl text-neutral-100 placeholder-neutral-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/60 transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[11px] font-medium tracking-wide uppercase text-neutral-400">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 bg-black/40 border border-white/[0.08] rounded-xl text-neutral-100 placeholder-neutral-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/60 transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 active:scale-[0.98] transition-all cursor-pointer shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Sign In <ArrowRight className="w-4 h-4" strokeWidth={2} />
                </>
              )}
            </button>
          </form>

          {/* Quick preset account */}
          <div className="mt-5 pt-4 border-t border-white/[0.06] flex items-center justify-between text-xs text-neutral-400">
            <span className="text-[11px] text-neutral-500 font-mono">admin / admin123</span>
            <button
              type="button"
              onClick={handleFillDefaults}
              className="text-[11px] text-blue-400 hover:text-blue-300 font-medium px-2 py-1 rounded-md bg-blue-500/[0.08] hover:bg-blue-500/[0.15] border border-blue-500/20 transition-all cursor-pointer"
            >
              Fill Default
            </button>
          </div>
        </div>

        <div className="text-center text-[11px] text-neutral-500 flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-neutral-400" />
          <span>Local offline daemon • Node.js v24</span>
        </div>
      </div>
    </div>
  );
};
