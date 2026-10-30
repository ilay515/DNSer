import React from 'react';
import { Server, Globe, Activity, Users, Settings, LogOut } from 'lucide-react';
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
    { id: 'users', label: 'Users', icon: Users, adminOnly: true },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <header className="bg-[#0e0f14]/85 border-b border-white/[0.07] sticky top-0 z-30 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-14">
          {/* Brand & Daemon Status */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-b from-white/[0.12] to-white/[0.04] border border-white/[0.1] flex items-center justify-center text-blue-400">
                <Server className="w-4 h-4" strokeWidth={1.8} />
              </div>
              <span className="font-semibold text-white text-sm tracking-tight">DNSer</span>
            </div>

            {/* Daemon Status Pill */}
            <div className="hidden md:flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.06] text-[11px]">
              <span className={`w-1.5 h-1.5 rounded-full ${isDnsRunning ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]' : 'bg-red-400'}`} />
              <span className="text-neutral-400">Port</span>
              <span className="font-mono text-neutral-200 font-medium">:{dnsPort}</span>
            </div>
          </div>

          {/* Apple-style Segmented Control */}
          <nav className="flex items-center p-0.5 rounded-xl bg-white/[0.05] border border-white/[0.06]">
            {navItems.map((item) => {
              if (item.adminOnly && user.role !== 'admin') return null;
              const Icon = item.icon;
              const active = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 cursor-pointer ${
                    active
                      ? 'bg-white/[0.12] text-white shadow-[0_1px_3px_rgba(0,0,0,0.3)]'
                      : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.03]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" strokeWidth={active ? 2 : 1.75} />
                  <span className="hidden sm:inline">{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* User profile & Logout */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2">
              <span className="text-xs text-neutral-300 font-medium">{user.username}</span>
              <span className="text-[10px] uppercase font-semibold tracking-wider px-1.5 py-0.5 rounded-md bg-white/[0.06] text-neutral-400 border border-white/[0.06]">
                {user.role}
              </span>
            </div>

            <button
              onClick={onLogout}
              title="Sign Out"
              className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-100 hover:bg-white/[0.08] active:scale-[0.95] transition-all cursor-pointer"
            >
              <LogOut className="w-4 h-4" strokeWidth={1.75} />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
