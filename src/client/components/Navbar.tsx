import React from 'react';
import { Server, Globe, Activity, Users, Settings, LogOut, Radio } from 'lucide-react';
import type { UserPublic, ServerStats } from '../types.js';

export type TabType = 'overview' | 'domains' | 'logs' | 'users' | 'settings';

interface NavbarProps {
  user: UserPublic;
  currentTab: TabType;
  onSelectTab: (tab: TabType) => void;
  onLogout: () => void;
  stats: ServerStats | null;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  currentTab,
  onSelectTab,
  onLogout,
  stats,
}) => {
  const dnsPort = stats?.dns.port || 5353;
  const isDnsRunning = stats?.dns.isRunning ?? true;

  const navItems: { id: TabType; label: string; icon: React.FC<{ className?: string }>; adminOnly?: boolean }[] = [
    { id: 'overview', label: 'Overview', icon: Server },
    { id: 'domains', label: 'Domains & Records', icon: Globe },
    { id: 'logs', label: 'Live Logs', icon: Activity },
    { id: 'users', label: 'User Control', icon: Users, adminOnly: true },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const roleColors: Record<string, string> = {
    admin: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    developer: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    viewer: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  };

  return (
    <header className="bg-slate-900/90 border-b border-slate-800 sticky top-0 z-30 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand & Daemon Status */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-inner">
                <Server className="w-5 h-5" />
              </div>
              <div>
                <span className="font-bold text-white text-base tracking-tight">DNSer</span>
                <span className="hidden sm:inline-block ml-2 text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700/60 font-mono">
                  offline-dev
                </span>
              </div>
            </div>

            {/* DNS Daemon Badge */}
            <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-slate-950/60 border border-slate-800 text-xs">
              <span className="relative flex h-2 w-2">
                {isDnsRunning && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                )}
                <span className={`relative inline-flex rounded-full h-2 w-2 ${isDnsRunning ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
              </span>
              <span className="text-slate-400">DNS Port:</span>
              <span className="font-mono text-emerald-400 font-medium">:{dnsPort} (UDP)</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex items-center gap-1 sm:gap-2">
            {navItems.map((item) => {
              if (item.adminOnly && user.role !== 'admin') return null;
              const Icon = item.icon;
              const active = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                    active
                      ? 'bg-indigo-600/15 text-indigo-400 border border-indigo-500/30 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden lg:inline">{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* User profile & Logout */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2">
              <span className="text-xs text-slate-400">{user.username}</span>
              <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${roleColors[user.role] || roleColors.viewer}`}>
                {user.role}
              </span>
            </div>

            <button
              onClick={onLogout}
              title="Sign Out"
              className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-slate-800 hover:border-rose-500/20 transition-all cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
