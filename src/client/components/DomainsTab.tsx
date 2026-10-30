import React, { useState, useEffect } from 'react';
import { Globe, Plus, Trash2, Edit3, Check, X, Search, Shield, Zap, RefreshCw, AlertCircle } from 'lucide-react';
import { api } from '../api.js';
import type { Domain, DnsRecord, UserPublic, ServerStats } from '../types.js';

interface DomainsTabProps {
  user: UserPublic;
  stats: ServerStats | null;
  onRefreshStats: () => void;
  presetTargetIp?: string | null;
  onClearPresetIp?: () => void;
}

export const DomainsTab: React.FC<DomainsTabProps> = ({
  user,
  stats,
  onRefreshStats,
  presetTargetIp,
  onClearPresetIp,
}) => {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [records, setRecords] = useState<DnsRecord[]>([]);
  const [selectedDomainId, setSelectedDomainId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Modals state
  const [showDomainModal, setShowDomainModal] = useState(false);
  const [newDomainName, setNewDomainName] = useState('');
  const [newDomainDesc, setNewDomainDesc] = useState('');

  const [showRecordModal, setShowRecordModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<DnsRecord | null>(null);
  const [recDomainId, setRecDomainId] = useState<string>('');
  const [recName, setRecName] = useState('');
  const [recType, setRecType] = useState<'A' | 'AAAA' | 'CNAME' | 'TXT' | 'MX' | 'PTR'>('A');
  const [recValue, setRecValue] = useState('');
  const [recTtl, setRecTtl] = useState(60);
  const [recPriority, setRecPriority] = useState(10);

  const canEdit = user.role === 'admin' || user.role === 'developer';

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [domList, recList] = await Promise.all([api.getDomains(), api.getRecords()]);
      setDomains(domList);
      setRecords(recList);
      if (domList.length > 0 && !selectedDomainId) {
        setSelectedDomainId(domList[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load domains and records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Handle quick preset IP from Overview tab
  useEffect(() => {
    if (presetTargetIp && domains.length > 0) {
      const targetDomain = domains.find(d => d.id === selectedDomainId) || domains[0];
      setRecDomainId(targetDomain.id);
      setRecName(`dev.${targetDomain.name}`);
      setRecType('A');
      setRecValue(presetTargetIp);
      setRecTtl(60);
      setEditingRecord(null);
      setShowRecordModal(true);
      onClearPresetIp?.();
    }
  }, [presetTargetIp, domains]);

  const handleCreateDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDomainName.trim()) return;
    setError(null);
    try {
      const created = await api.createDomain(newDomainName.trim(), newDomainDesc.trim());
      setShowDomainModal(false);
      setNewDomainName('');
      setNewDomainDesc('');
      await loadData();
      setSelectedDomainId(created.id);
      onRefreshStats();
    } catch (err: any) {
      setError(err.message || 'Failed to create domain');
    }
  };

  const handleDeleteDomain = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete domain "${name}" and all its records?`)) return;
    setError(null);
    try {
      await api.deleteDomain(id);
      await loadData();
      if (selectedDomainId === id) {
        setSelectedDomainId(null);
      }
      onRefreshStats();
    } catch (err: any) {
      setError(err.message || 'Failed to delete domain');
    }
  };

  const handleOpenAddRecord = (domainId: string) => {
    const domain = domains.find(d => d.id === domainId);
    setEditingRecord(null);
    setRecDomainId(domainId);
    setRecName(domain ? domain.name : '');
    setRecType('A');
    setRecValue('127.0.0.1');
    setRecTtl(60);
    setRecPriority(10);
    setShowRecordModal(true);
  };

  const handleOpenEditRecord = (record: DnsRecord) => {
    setEditingRecord(record);
    setRecDomainId(record.domain_id);
    setRecName(record.name);
    setRecType(record.type);
    setRecValue(record.value);
    setRecTtl(record.ttl);
    setRecPriority(record.priority || 10);
    setShowRecordModal(true);
  };

  const handleSaveRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recName.trim() || !recValue.trim()) return;

    setError(null);
    try {
      if (editingRecord) {
        await api.updateRecord(editingRecord.id, {
          name: recName.trim(),
          type: recType,
          value: recValue.trim(),
          ttl: recTtl,
          priority: recPriority,
        });
      } else {
        await api.createRecord({
          domain_id: recDomainId,
          name: recName.trim(),
          type: recType,
          value: recValue.trim(),
          ttl: recTtl,
          priority: recPriority,
        });
      }
      setShowRecordModal(false);
      await loadData();
      onRefreshStats();
    } catch (err: any) {
      setError(err.message || 'Failed to save record');
    }
  };

  const handleToggleRecordActive = async (record: DnsRecord) => {
    if (!canEdit) return;
    try {
      await api.updateRecord(record.id, {
        is_active: record.is_active ? 0 : 1,
      });
      await loadData();
      onRefreshStats();
    } catch (err: any) {
      setError(err.message || 'Failed to toggle record');
    }
  };

  const handleDeleteRecord = async (id: string, name: string) => {
    if (!confirm(`Delete record "${name}"?`)) return;
    try {
      await api.deleteRecord(id);
      await loadData();
      onRefreshStats();
    } catch (err: any) {
      setError(err.message || 'Failed to delete record');
    }
  };

  const selectedDomain = domains.find(d => d.id === selectedDomainId);
  const filteredRecords = records.filter(r => {
    if (selectedDomainId && r.domain_id !== selectedDomainId) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return r.name.toLowerCase().includes(q) || r.value.toLowerCase().includes(q) || r.type.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-slate-400 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left: Domain Zones List */}
        <div className="lg:col-span-1 bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-indigo-400" />
              <h3 className="font-semibold text-white text-sm">Domain Zones</h3>
            </div>
            {canEdit && (
              <button
                onClick={() => setShowDomainModal(true)}
                className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-all cursor-pointer shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" /> Zone
              </button>
            )}
          </div>

          <div className="space-y-1 max-h-[600px] overflow-y-auto">
            {domains.map((dom) => {
              const active = selectedDomainId === dom.id;
              return (
                <div
                  key={dom.id}
                  onClick={() => setSelectedDomainId(dom.id)}
                  className={`group flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all ${
                    active
                      ? 'bg-indigo-600/15 border border-indigo-500/30 text-white shadow-sm'
                      : 'hover:bg-slate-800/60 text-slate-300 border border-transparent'
                  }`}
                >
                  <div className="min-w-0 pr-2">
                    <div className="font-medium text-sm truncate flex items-center gap-1.5">
                      <span>{dom.name}</span>
                    </div>
                    {dom.description && (
                      <div className="text-[11px] text-slate-500 truncate">{dom.description}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700/60">
                      {dom.record_count || 0}
                    </span>
                    {canEdit && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteDomain(dom.id, dom.name);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-rose-400 transition-opacity cursor-pointer"
                        title="Delete Domain"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {domains.length === 0 && !loading && (
              <div className="text-center py-6 text-xs text-slate-500">
                No domain zones configured. Create one to get started!
              </div>
            )}
          </div>
        </div>

        {/* Right: Records for Selected Domain */}
        <div className="lg:col-span-3 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white tracking-tight">
                  {selectedDomain ? selectedDomain.name : 'All DNS Records'}
                </h3>
                {selectedDomain && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-mono">
                    Authoritative Zone
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {selectedDomain?.description || 'Active records managed by this local DNS server'}
              </p>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="Filter records..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-950/70 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {canEdit && selectedDomain && (
                <button
                  onClick={() => handleOpenAddRecord(selectedDomain.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all cursor-pointer shadow-sm shrink-0"
                >
                  <Plus className="w-4 h-4" /> Add Record
                </button>
              )}
            </div>
          </div>

          {/* Quick Preset Buttons */}
          {canEdit && selectedDomain && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs text-slate-400">
              <span className="flex items-center gap-1 text-slate-500 shrink-0">
                <Zap className="w-3.5 h-3.5 text-amber-400" /> Quick Add:
              </span>
              <button
                onClick={() => {
                  setRecDomainId(selectedDomain.id);
                  setRecName(`*.${selectedDomain.name}`);
                  setRecType('A');
                  setRecValue('127.0.0.1');
                  setRecTtl(60);
                  setShowRecordModal(true);
                }}
                className="px-2.5 py-1 rounded-lg bg-slate-950/70 hover:bg-slate-800 border border-slate-800 text-slate-300 font-mono text-[11px] transition-all cursor-pointer shrink-0"
              >
                + Wildcard (*.{selectedDomain.name} → 127.0.0.1)
              </button>
              <button
                onClick={() => {
                  setRecDomainId(selectedDomain.id);
                  setRecName(`api.${selectedDomain.name}`);
                  setRecType('A');
                  setRecValue('127.0.0.1');
                  setRecTtl(60);
                  setShowRecordModal(true);
                }}
                className="px-2.5 py-1 rounded-lg bg-slate-950/70 hover:bg-slate-800 border border-slate-800 text-slate-300 font-mono text-[11px] transition-all cursor-pointer shrink-0"
              >
                + api.{selectedDomain.name}
              </button>
            </div>
          )}

          {/* Records Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider font-semibold">
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Name</th>
                  <th className="py-3 px-3">Type</th>
                  <th className="py-3 px-3">Value / Destination</th>
                  <th className="py-3 px-3">TTL</th>
                  {canEdit && <th className="py-3 px-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {filteredRecords.map((rec) => (
                  <tr key={rec.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-3">
                      <button
                        onClick={() => handleToggleRecordActive(rec)}
                        disabled={!canEdit}
                        className={`w-3.5 h-3.5 rounded-full border transition-all cursor-pointer ${
                          rec.is_active
                            ? 'bg-emerald-500 border-emerald-400 shadow-sm shadow-emerald-500/50'
                            : 'bg-slate-800 border-slate-600'
                        }`}
                        title={rec.is_active ? 'Active (Click to pause)' : 'Paused (Click to activate)'}
                      />
                    </td>
                    <td className="py-3 px-3 font-semibold text-white">
                      {rec.name}
                    </td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                        rec.type === 'A' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' :
                        rec.type === 'AAAA' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' :
                        rec.type === 'CNAME' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' :
                        'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}>
                        {rec.type}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-200">
                      {rec.value}
                    </td>
                    <td className="py-3 px-3 text-slate-400">
                      {rec.ttl}s
                    </td>
                    {canEdit && (
                      <td className="py-3 px-3 text-right font-sans">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenEditRecord(rec)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 transition-all cursor-pointer"
                            title="Edit Record"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteRecord(rec.id, rec.name)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all cursor-pointer"
                            title="Delete Record"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}

                {filteredRecords.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500 font-sans">
                      No records found in this zone.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal: Add Domain Zone */}
      {showDomainModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <h4 className="text-base font-bold text-white">Create New Domain Zone</h4>
              <button onClick={() => setShowDomainModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateDomain} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Domain Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. staging.internal or dev.test"
                  value={newDomainName}
                  onChange={(e) => setNewDomainName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  Recommended dev TLDs: <code className="text-indigo-400">.local</code>, <code className="text-indigo-400">.test</code>, <code className="text-indigo-400">.dev</code>
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Description (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Local microservices routing"
                  value={newDomainDesc}
                  onChange={(e) => setNewDomainDesc(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDomainModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition-all cursor-pointer shadow-md"
                >
                  Create Domain
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add or Edit Record */}
      {showRecordModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <h4 className="text-base font-bold text-white">
                {editingRecord ? 'Edit DNS Record' : 'Add New DNS Record'}
              </h4>
              <button onClick={() => setShowRecordModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRecord} className="space-y-4 mt-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Record Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. api.local.dev or *.local.dev"
                    value={recName}
                    onChange={(e) => setRecName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Type
                  </label>
                  <select
                    value={recType}
                    onChange={(e) => setRecType(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                  >
                    <option value="A">A (IPv4)</option>
                    <option value="AAAA">AAAA (IPv6)</option>
                    <option value="CNAME">CNAME</option>
                    <option value="TXT">TXT</option>
                    <option value="MX">MX</option>
                    <option value="PTR">PTR</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Target Value
                </label>
                <input
                  type="text"
                  required
                  placeholder={recType === 'A' ? '127.0.0.1' : recType === 'CNAME' ? 'upstream.host' : 'Record value'}
                  value={recValue}
                  onChange={(e) => setRecValue(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                />

                {/* Preset shortcuts */}
                {recType === 'A' && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-[11px] text-slate-500">Presets:</span>
                    <button
                      type="button"
                      onClick={() => setRecValue('127.0.0.1')}
                      className="text-[11px] px-2 py-0.5 rounded bg-slate-950 hover:bg-slate-800 border border-slate-800 text-indigo-400 font-mono cursor-pointer"
                    >
                      127.0.0.1
                    </button>
                    {stats?.hostIps?.[0] && (
                      <button
                        type="button"
                        onClick={() => setRecValue(stats.hostIps[0].address)}
                        className="text-[11px] px-2 py-0.5 rounded bg-slate-950 hover:bg-slate-800 border border-slate-800 text-cyan-400 font-mono cursor-pointer"
                      >
                        LAN: {stats.hostIps[0].address}
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    TTL (Seconds)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={recTtl}
                    onChange={(e) => setRecTtl(parseInt(e.target.value, 10) || 60)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {recType === 'MX' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                      MX Priority
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={recPriority}
                      onChange={(e) => setRecPriority(parseInt(e.target.value, 10) || 10)}
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRecordModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition-all cursor-pointer shadow-md"
                >
                  {editingRecord ? 'Update Record' : 'Save Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
