import React, { useState, useEffect } from 'react';
import { Globe, Plus, Trash2, Edit3, X, Search, Zap, AlertCircle, Check, ArrowRight } from 'lucide-react';
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

  // Inline new record bar state
  const [inlineName, setInlineName] = useState('');
  const [inlineType, setInlineType] = useState<'A' | 'AAAA' | 'CNAME' | 'TXT' | 'MX' | 'PTR'>('A');
  const [inlineValue, setInlineValue] = useState('127.0.0.1');

  // Inline editing of existing record
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');

  // Domain modal state
  const [showDomainModal, setShowDomainModal] = useState(false);
  const [newDomainName, setNewDomainName] = useState('');
  const [newDomainDesc, setNewDomainDesc] = useState('');

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
      setSelectedDomainId(targetDomain.id);
      setInlineName(`dev.${targetDomain.name}`);
      setInlineValue(presetTargetIp);
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
      setError(err.message || 'Failed to create zone');
    }
  };

  const handleDeleteDomain = async (id: string, name: string) => {
    if (!confirm(`Delete zone "${name}" and all its routes?`)) return;
    setError(null);
    try {
      await api.deleteDomain(id);
      await loadData();
      if (selectedDomainId === id) {
        setSelectedDomainId(null);
      }
      onRefreshStats();
    } catch (err: any) {
      setError(err.message || 'Failed to delete zone');
    }
  };

  const handleInlineAddRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDomainId || !inlineName.trim() || !inlineValue.trim()) return;

    setError(null);
    try {
      await api.createRecord({
        domain_id: selectedDomainId,
        name: inlineName.trim(),
        type: inlineType,
        value: inlineValue.trim(),
        ttl: 60,
      });
      setInlineName('');
      setInlineValue('127.0.0.1');
      await loadData();
      onRefreshStats();
    } catch (err: any) {
      setError(err.message || 'Failed to add record');
    }
  };

  const handleSaveInlineEdit = async (recordId: string) => {
    if (!editingValue.trim()) return;
    try {
      await api.updateRecord(recordId, { value: editingValue.trim() });
      setEditingRecordId(null);
      await loadData();
      onRefreshStats();
    } catch (err: any) {
      setError(err.message || 'Failed to update record');
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
    if (!confirm(`Remove route for "${name}"?`)) return;
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
    <div className="space-y-5">
      {error && (
        <div className="p-3.5 rounded-xl bg-red-500/[0.08] border border-red-500/20 text-red-400 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-neutral-400 hover:text-white cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        {/* Left: Domain Zones Sidebar */}
        <div className="lg:col-span-1 bg-[#12141c]/90 border border-white/[0.07] rounded-2xl p-3.5 shadow-sm space-y-3">
          <div className="flex items-center justify-between pb-2.5 border-b border-white/[0.06] px-1">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-neutral-400" strokeWidth={1.8} />
              <h3 className="font-semibold text-white text-xs tracking-tight">Zones</h3>
            </div>
            {canEdit && (
              <button
                onClick={() => setShowDomainModal(true)}
                className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 active:scale-[0.96] text-white font-medium transition-all cursor-pointer shadow-sm"
              >
                <Plus className="w-3 h-3" /> Zone
              </button>
            )}
          </div>

          <div className="space-y-1 max-h-[580px] overflow-y-auto">
            {domains.map((dom) => {
              const active = selectedDomainId === dom.id;
              return (
                <div
                  key={dom.id}
                  onClick={() => setSelectedDomainId(dom.id)}
                  className={`group flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all ${
                    active
                      ? 'bg-white/[0.1] text-white border border-white/[0.08]'
                      : 'hover:bg-white/[0.03] text-neutral-400 hover:text-neutral-200 border border-transparent'
                  }`}
                >
                  <div className="min-w-0 pr-2">
                    <div className="font-medium text-xs truncate">
                      {dom.name}
                    </div>
                    {dom.description && (
                      <div className="text-[10px] text-neutral-500 truncate mt-0.5">{dom.description}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-md bg-white/[0.06] text-neutral-400 border border-white/[0.06]">
                      {dom.record_count || 0}
                    </span>
                    {canEdit && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteDomain(dom.id, dom.name);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 text-neutral-500 hover:text-red-400 transition-opacity cursor-pointer"
                        title="Delete Zone"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {domains.length === 0 && !loading && (
              <div className="text-center py-6 text-xs text-neutral-500 font-sans">
                No zones configured. Click <span className="font-medium text-neutral-300">+ Zone</span> to create one.
              </div>
            )}
          </div>
        </div>

        {/* Right: Records Area */}
        <div className="lg:col-span-3 bg-[#12141c]/90 border border-white/[0.07] rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-white/[0.06]">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-white tracking-tight">
                  {selectedDomain ? selectedDomain.name : 'All Records'}
                </h3>
                {selectedDomain && (
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-blue-500/[0.08] text-blue-400 border border-blue-500/20">
                    Authoritative
                  </span>
                )}
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">
                {selectedDomain?.description || 'Routes resolved by local DNS engine'}
              </p>
            </div>

            <div className="relative w-full sm:w-56">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
              <input
                type="text"
                placeholder="Filter routes..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-black/35 border border-white/[0.07] rounded-xl text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Inline Add Record Row (Fast & Frictionless) */}
          {canEdit && selectedDomain && (
            <form onSubmit={handleInlineAddRecord} className="p-2.5 rounded-xl bg-black/35 border border-white/[0.06] flex flex-wrap sm:flex-nowrap items-center gap-2 text-xs">
              <input
                type="text"
                required
                placeholder={`Name (e.g. api.${selectedDomain.name} or *)`}
                value={inlineName}
                onChange={(e) => setInlineName(e.target.value)}
                className="flex-1 px-3 py-1.5 bg-black/40 border border-white/[0.07] rounded-lg text-white font-mono placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />

              <select
                value={inlineType}
                onChange={(e) => setInlineType(e.target.value as any)}
                className="w-24 px-2 py-1.5 bg-black/40 border border-white/[0.07] rounded-lg text-neutral-200 font-semibold focus:outline-none"
              >
                <option value="A">A</option>
                <option value="AAAA">AAAA</option>
                <option value="CNAME">CNAME</option>
                <option value="TXT">TXT</option>
                <option value="MX">MX</option>
              </select>

              <input
                type="text"
                required
                placeholder="Target (e.g. 127.0.0.1)"
                value={inlineValue}
                onChange={(e) => setInlineValue(e.target.value)}
                className="flex-1 px-3 py-1.5 bg-black/40 border border-white/[0.07] rounded-lg text-white font-mono placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />

              <button
                type="submit"
                className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium active:scale-[0.96] transition-all cursor-pointer whitespace-nowrap"
              >
                + Add Route
              </button>
            </form>
          )}

          {/* Quick preset chips */}
          {canEdit && selectedDomain && (
            <div className="flex items-center gap-2 overflow-x-auto text-xs text-neutral-400">
              <span className="flex items-center gap-1 text-neutral-500 text-[11px] shrink-0">
                <Zap className="w-3 h-3 text-amber-400" /> Presets:
              </span>
              <button
                type="button"
                onClick={() => {
                  setInlineName(`*.${selectedDomain.name}`);
                  setInlineValue('127.0.0.1');
                }}
                className="px-2 py-0.5 rounded-md bg-white/[0.04] hover:bg-white/[0.08] text-neutral-300 font-mono text-[11px] cursor-pointer shrink-0"
              >
                + Wildcard (*.{selectedDomain.name})
              </button>
              <button
                type="button"
                onClick={() => {
                  setInlineName(`api.${selectedDomain.name}`);
                  setInlineValue('127.0.0.1');
                }}
                className="px-2 py-0.5 rounded-md bg-white/[0.04] hover:bg-white/[0.08] text-neutral-300 font-mono text-[11px] cursor-pointer shrink-0"
              >
                + api.{selectedDomain.name}
              </button>
              {stats?.hostIps?.[0] && (
                <button
                  type="button"
                  onClick={() => {
                    setInlineName(`lan.${selectedDomain.name}`);
                    setInlineValue(stats.hostIps[0].address);
                  }}
                  className="px-2 py-0.5 rounded-md bg-white/[0.04] hover:bg-white/[0.08] text-emerald-400 font-mono text-[11px] cursor-pointer shrink-0"
                >
                  + LAN IP ({stats.hostIps[0].address})
                </button>
              )}
            </div>
          )}

          {/* Records List Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/[0.06] text-neutral-400 uppercase tracking-wider text-[10px] font-medium">
                  <th className="py-2.5 px-3">State</th>
                  <th className="py-2.5 px-3">Hostname</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Target Value</th>
                  <th className="py-2.5 px-3">TTL</th>
                  {canEdit && <th className="py-2.5 px-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04] font-mono">
                {filteredRecords.map((rec) => {
                  const isEditing = editingRecordId === rec.id;
                  return (
                    <tr key={rec.id} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="py-2.5 px-3">
                        <button
                          onClick={() => handleToggleRecordActive(rec)}
                          disabled={!canEdit}
                          className={`w-3 h-3 rounded-full border transition-all cursor-pointer ${
                            rec.is_active
                              ? 'bg-emerald-400 border-emerald-300 shadow-[0_0_6px_rgba(52,211,153,0.5)]'
                              : 'bg-neutral-800 border-neutral-600'
                          }`}
                          title={rec.is_active ? 'Active (Click to disable)' : 'Disabled (Click to enable)'}
                        />
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-white">
                        {rec.name}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="px-1.5 py-0.5 rounded font-bold text-[10px] bg-white/[0.06] text-neutral-200 border border-white/[0.07]">
                          {rec.type}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-neutral-200 font-sans">
                        {isEditing ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={editingValue}
                              onChange={(e) => setEditingValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveInlineEdit(rec.id);
                                if (e.key === 'Escape') setEditingRecordId(null);
                              }}
                              autoFocus
                              className="px-2 py-1 bg-black/60 border border-blue-500/50 rounded text-xs font-mono text-white focus:outline-none"
                            />
                            <button
                              onClick={() => handleSaveInlineEdit(rec.id)}
                              className="p-1 text-emerald-400 hover:text-emerald-300 cursor-pointer"
                              title="Save"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setEditingRecordId(null)}
                              className="p-1 text-neutral-500 hover:text-white cursor-pointer"
                              title="Cancel"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <span
                            onClick={() => {
                              if (canEdit) {
                                setEditingRecordId(rec.id);
                                setEditingValue(rec.value);
                              }
                            }}
                            className={`font-mono text-xs ${canEdit ? 'cursor-pointer hover:text-blue-300 underline decoration-dotted underline-offset-2' : ''}`}
                            title={canEdit ? 'Click to edit in place' : ''}
                          >
                            {rec.value}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-neutral-400 font-sans">
                        {rec.ttl}s
                      </td>
                      {canEdit && (
                        <td className="py-2.5 px-3 text-right font-sans">
                          <div className="flex items-center justify-end gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                            {!isEditing && (
                              <button
                                onClick={() => {
                                  setEditingRecordId(rec.id);
                                  setEditingValue(rec.value);
                                }}
                                className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/[0.06] transition-all cursor-pointer"
                                title="Edit route value"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteRecord(rec.id, rec.name)}
                              className="p-1.5 rounded-lg text-neutral-400 hover:text-red-400 hover:bg-red-500/[0.08] transition-all cursor-pointer"
                              title="Delete route"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}

                {filteredRecords.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-neutral-500 font-sans text-xs">
                      No routes in this zone. Use the input bar above to add one!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal: New Zone */}
      {showDomainModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#14161f] border border-white/[0.1] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
              <h4 className="text-sm font-semibold text-white">Create Domain Zone</h4>
              <button onClick={() => setShowDomainModal(false)} className="text-neutral-400 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateDomain} className="space-y-4">
              <div>
                <label className="block text-[11px] font-medium text-neutral-400 uppercase tracking-wider mb-1.5">
                  Zone Domain Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. dev.local or mycompany.test"
                  value={newDomainName}
                  onChange={(e) => setNewDomainName(e.target.value)}
                  className="w-full px-3 py-2 bg-black/40 border border-white/[0.08] rounded-xl text-neutral-100 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/40 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-neutral-400 uppercase tracking-wider mb-1.5">
                  Description
                </label>
                <input
                  type="text"
                  placeholder="e.g. Local microservices routing"
                  value={newDomainDesc}
                  onChange={(e) => setNewDomainDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-black/40 border border-white/[0.08] rounded-xl text-neutral-100 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDomainModal(false)}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-medium text-neutral-400 hover:text-white transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 active:scale-[0.97] transition-all cursor-pointer shadow-md"
                >
                  Create Zone
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
