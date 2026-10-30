import React, { useState, useEffect } from 'react';
import { api, authStorage } from './api.js';
import type { UserPublic, ServerStats, QueryLogEntry } from './types.js';
import { LoginPage } from './components/LoginPage.js';
import { Navbar, type TabType } from './components/Navbar.js';
import { OverviewTab } from './components/OverviewTab.js';
import { DomainsTab } from './components/DomainsTab.js';
import { LogsTab } from './components/LogsTab.js';
import { UsersTab } from './components/UsersTab.js';
import { SettingsTab } from './components/SettingsTab.js';

export const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<UserPublic | null>(null);
  const [currentTab, setCurrentTab] = useState<TabType>('overview');
  const [stats, setStats] = useState<ServerStats | null>(null);
  const [recentLogs, setRecentLogs] = useState<QueryLogEntry[]>([]);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [presetIp, setPresetIp] = useState<string | null>(null);

  // Check auth session
  useEffect(() => {
    const checkSession = async () => {
      try {
        const user = await api.getMe();
        setCurrentUser(user);
      } catch {
        authStorage.clearToken();
        setCurrentUser(null);
      } finally {
        setLoadingAuth(false);
      }
    };
    checkSession();
  }, []);

  // Fetch stats and recent logs
  const fetchStats = async () => {
    if (!currentUser) return;
    try {
      const [s, l] = await Promise.all([
        api.getStats(),
        api.getLogs({ limit: 5 }),
      ]);
      setStats(s);
      setRecentLogs(l.logs);
    } catch (err) {
      console.error('Failed to update stats:', err);
    }
  };

  useEffect(() => {
    if (!currentUser) return;
    fetchStats();
    const interval = setInterval(fetchStats, 6000);
    return () => clearInterval(interval);
  }, [currentUser]);

  const handleLogout = async () => {
    await api.logout();
    setCurrentUser(null);
  };

  const handleQuickAddIpRecord = (ip: string) => {
    setPresetIp(ip);
    setCurrentTab('domains');
  };

  if (loadingAuth) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!currentUser) {
    return <LoginPage onLoginSuccess={(u) => setCurrentUser(u)} />;
  }

  return (
    <div className="min-h-screen bg-[#0a0b0e] text-neutral-100 flex flex-col selection:bg-blue-600/30">
      <Navbar
        user={currentUser}
        currentTab={currentTab}
        onSelectTab={(tab) => setCurrentTab(tab)}
        onLogout={handleLogout}
        stats={stats}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        {currentTab === 'overview' && (
          <OverviewTab
            stats={stats}
            recentLogs={recentLogs}
            onNavigateTab={(tab) => setCurrentTab(tab)}
            onQuickAddIpRecord={handleQuickAddIpRecord}
          />
        )}

        {currentTab === 'domains' && (
          <DomainsTab
            user={currentUser}
            stats={stats}
            onRefreshStats={fetchStats}
            presetTargetIp={presetIp}
            onClearPresetIp={() => setPresetIp(null)}
          />
        )}

        {currentTab === 'logs' && (
          <LogsTab
            user={currentUser}
            onRefreshStats={fetchStats}
          />
        )}

        {currentTab === 'users' && (
          <UsersTab currentUser={currentUser} />
        )}

        {currentTab === 'settings' && (
          <SettingsTab
            user={currentUser}
            stats={stats}
            onRefreshStats={fetchStats}
          />
        )}
      </main>

      <footer className="border-t border-white/[0.05] bg-[#090a0d] py-3.5 text-center text-[11px] text-neutral-500">
        DNSer • Local Offline Developer Daemon • Port {stats?.dns.port || 5353} (UDP)
      </footer>
    </div>
  );
};
