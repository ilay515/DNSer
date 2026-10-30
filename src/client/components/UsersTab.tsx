import React, { useState, useEffect } from 'react';
import { Users, Plus, Shield, Key, Trash2, Edit3, Check, X, AlertCircle } from 'lucide-react';
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

  const roleColors: Record<UserRole, string> = {
    admin: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    developer: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    viewer: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  };

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

      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-400" />
            <h3 className="text-lg font-bold text-white tracking-tight">User Access & Roles</h3>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Manage developer accounts and role-based access to the DNS dashboard
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all cursor-pointer shadow-md"
        >
          <Plus className="w-4 h-4" /> Add User
        </button>
      </div>

      {/* Users Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Username</th>
                <th className="py-3.5 px-4">Role</th>
                <th className="py-3.5 px-4">Permissions</th>
                <th className="py-3.5 px-4">Created At</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {users.map((u) => {
                const isCurrent = u.id === currentUser.id;
                return (
                  <tr key={u.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4">
                      <button
                        onClick={() => handleToggleActive(u)}
                        disabled={isCurrent}
                        className={`w-3.5 h-3.5 rounded-full border transition-all cursor-pointer ${
                          u.is_active
                            ? 'bg-emerald-500 border-emerald-400 shadow-sm shadow-emerald-500/50'
                            : 'bg-slate-800 border-slate-600'
                        } ${isCurrent ? 'cursor-not-allowed opacity-80' : ''}`}
                        title={u.is_active ? 'Active user' : 'Inactive user'}
                      />
                    </td>
                    <td className="py-3 px-4 font-semibold text-white">
                      {u.username}
                      {isCurrent && (
                        <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">
                          You
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider border ${roleColors[u.role]}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-400">
                      {u.role === 'admin'
                        ? 'Full control (Users, Domains, Records, System)'
                        : u.role === 'developer'
                        ? 'Manage domains, records & view logs'
                        : 'Read-only viewer'}
                    </td>
                    <td className="py-3 px-4 text-slate-400 font-mono">
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
                          className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 transition-all cursor-pointer"
                          title="Edit User or Change Password"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteUser(u.id, u.username)}
                          disabled={isCurrent}
                          className={`p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all cursor-pointer ${
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
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <h4 className="text-base font-bold text-white">Create New User</h4>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Username
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. dev_jane"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Initial Password
                </label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Role
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as UserRole)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="developer">Developer (Manage domains & records)</option>
                  <option value="viewer">Viewer (Read-only)</option>
                  <option value="admin">Admin (Full permissions)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition-all cursor-pointer shadow-md"
                >
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit User */}
      {showEditModal && editingUser && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <h4 className="text-base font-bold text-white">Edit User: {editingUser.username}</h4>
              <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateUser} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Role
                </label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as UserRole)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="developer">Developer (Manage domains & records)</option>
                  <option value="viewer">Viewer (Read-only)</option>
                  <option value="admin">Admin (Full permissions)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Reset Password (Leave blank to keep current)
                </label>
                <input
                  type="password"
                  placeholder="New password..."
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition-all cursor-pointer shadow-md"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
