import React, { useState, useEffect } from 'react';
import { Users, Plus, Trash2, Edit3, X, AlertCircle } from 'lucide-react';
import { api } from '../api.js';
import type { UserPublic, UserRole } from '../types.js';

interface UsersTabProps {
  currentUser: UserPublic;
}

export const UsersTab: React.FC<UsersTabProps> = ({ currentUser }) => {
  const [users, setUsers] = useState<UserPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add User Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('developer');

  // Edit User Modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserPublic | null>(null);
  const [editRole, setEditRole] = useState<UserRole>('developer');
  const [editPassword, setEditPassword] = useState('');

  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await api.getUsers();
      setUsers(list);
    } catch (err: any) {
      setError(err.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim() || !newPassword) return;
    setError(null);
    try {
      await api.createUser({
        username: newUsername.trim(),
        password: newPassword,
        role: newRole,
      });
      setShowAddModal(false);
      setNewUsername('');
      setNewPassword('');
      setNewRole('developer');
      await loadUsers();
    } catch (err: any) {
      setError(err.message || 'Failed to create user');
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setError(null);
    try {
      const updates: { role?: UserRole; password?: string } = {
        role: editRole,
      };
      if (editPassword.trim()) {
        updates.password = editPassword.trim();
      }
      await api.updateUser(editingUser.id, updates);
      setShowEditModal(false);
      setEditingUser(null);
      setEditPassword('');
      await loadUsers();
    } catch (err: any) {
      setError(err.message || 'Failed to update user');
    }
  };

  const handleToggleActive = async (targetUser: UserPublic) => {
    if (targetUser.id === currentUser.id) {
      alert('You cannot deactivate your own account.');
      return;
    }
    try {
      await api.updateUser(targetUser.id, {
        is_active: targetUser.is_active ? 0 : 1,
      });
      await loadUsers();
    } catch (err: any) {
      setError(err.message || 'Failed to update status');
    }
  };

  const handleDeleteUser = async (id: string, username: string) => {
    if (id === currentUser.id) {
      alert('You cannot delete your own account.');
      return;
    }
    if (!confirm(`Are you sure you want to delete user "${username}"?`)) return;
    try {
      await api.deleteUser(id);
      await loadUsers();
    } catch (err: any) {
      setError(err.message || 'Failed to delete user');
    }
  };

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

      {/* Header */}
      <div className="bg-[#12141c]/90 border border-white/[0.07] rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-neutral-400" strokeWidth={1.75} />
            <h3 className="text-sm font-semibold text-white tracking-tight">Users & Access</h3>
          </div>
          <p className="text-xs text-neutral-400 mt-0.5">
            Manage developer accounts and role permissions
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-[0.97] text-white text-xs font-medium transition-all cursor-pointer shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" /> Add User
        </button>
      </div>

      {/* Users Table */}
      <div className="bg-[#12141c]/90 border border-white/[0.07] rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0e0f14]/80 border-b border-white/[0.06] text-neutral-400 uppercase tracking-wider text-[10px] font-medium">
              <tr>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Permissions</th>
                <th className="py-3 px-4">Created</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03]">
              {users.map((u) => {
                const isCurrent = u.id === currentUser.id;
                return (
                  <tr key={u.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-4">
                      <button
                        onClick={() => handleToggleActive(u)}
                        disabled={isCurrent}
                        className={`w-3 h-3 rounded-full border transition-all cursor-pointer ${
                          u.is_active
                            ? 'bg-emerald-400 border-emerald-300 shadow-[0_0_6px_rgba(52,211,153,0.5)]'
                            : 'bg-neutral-800 border-neutral-600'
                        } ${isCurrent ? 'cursor-not-allowed opacity-80' : ''}`}
                        title={u.is_active ? 'Active user' : 'Inactive user'}
                      />
                    </td>
                    <td className="py-3 px-4 font-medium text-white flex items-center gap-2.5">
                      <div className="w-6 h-6 rounded-full bg-white/[0.08] text-[11px] font-medium flex items-center justify-center text-neutral-200">
                        {u.username[0].toUpperCase()}
                      </div>
                      <span>{u.username}</span>
                      {isCurrent && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-white/[0.06] text-neutral-400 font-mono">
                          You
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-medium uppercase tracking-wider bg-white/[0.06] text-neutral-300 border border-white/[0.06]">
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-neutral-400">
                      {u.role === 'admin'
                        ? 'Full control'
                        : u.role === 'developer'
                        ? 'Manage zones & records'
                        : 'Read-only'}
                    </td>
                    <td className="py-3 px-4 text-neutral-400 font-mono">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => {
                            setEditingUser(u);
                            setEditRole(u.role);
                            setEditPassword('');
                            setShowEditModal(true);
                          }}
                          className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/[0.06] transition-all cursor-pointer"
                          title="Edit User"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteUser(u.id, u.username)}
                          disabled={isCurrent}
                          className={`p-1.5 rounded-lg text-neutral-400 hover:text-red-400 hover:bg-red-500/[0.08] transition-all cursor-pointer ${
                            isCurrent ? 'opacity-30 cursor-not-allowed' : ''
                          }`}
                          title="Delete User"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Add User */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#14161f] border border-white/[0.1] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
              <h4 className="text-sm font-semibold text-white">Create User</h4>
              <button onClick={() => setShowAddModal(false)} className="text-neutral-400 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-[11px] font-medium text-neutral-400 uppercase tracking-wider mb-1.5">
                  Username
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. dev_jane"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className="w-full px-3 py-2 bg-black/40 border border-white/[0.08] rounded-xl text-neutral-100 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-neutral-400 uppercase tracking-wider mb-1.5">
                  Initial Password
                </label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-black/40 border border-white/[0.08] rounded-xl text-neutral-100 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-neutral-400 uppercase tracking-wider mb-1.5">
                  Role
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 bg-black/40 border border-white/[0.08] rounded-xl text-neutral-100 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                >
                  <option value="developer">Developer</option>
                  <option value="viewer">Viewer</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-medium text-neutral-400 hover:text-white transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 active:scale-[0.97] transition-all cursor-pointer shadow-md"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit User */}
      {showEditModal && editingUser && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#14161f] border border-white/[0.1] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
              <h4 className="text-sm font-semibold text-white">Edit User: {editingUser.username}</h4>
              <button onClick={() => setShowEditModal(false)} className="text-neutral-400 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateUser} className="space-y-4">
              <div>
                <label className="block text-[11px] font-medium text-neutral-400 uppercase tracking-wider mb-1.5">
                  Role
                </label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 bg-black/40 border border-white/[0.08] rounded-xl text-neutral-100 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                >
                  <option value="developer">Developer</option>
                  <option value="viewer">Viewer</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-neutral-400 uppercase tracking-wider mb-1.5">
                  Reset Password (optional)
                </label>
                <input
                  type="password"
                  placeholder="New password..."
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-black/40 border border-white/[0.08] rounded-xl text-neutral-100 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-medium text-neutral-400 hover:text-white transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 active:scale-[0.97] transition-all cursor-pointer shadow-md"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
