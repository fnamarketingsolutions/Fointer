import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, Trash2, Pencil, X, Loader2 } from 'lucide-react';
import { fetchUsers, updateUser, deleteUser } from '../../../api/dashboard';
import { useAuth } from '../../../context/AuthContext';

const emptyEdit = { name: '', username: '', email: '', role: 'user' };

const UserManagement = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyEdit);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchUsers();
      setUsers(data?.users || []);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load users.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.username?.toLowerCase().includes(q)
    );
  }, [users, search]);

  const openEdit = (u) => {
    setEditing(u);
    setForm({
      name: u.name || '',
      username: u.username || '',
      email: u.email || '',
      role: u.role || 'user',
    });
    setError('');
  };

  const closeEdit = () => {
    setEditing(null);
    setForm(emptyEdit);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!editing) return;

    setSaving(true);
    setError('');
    try {
      await updateUser(editing.id, {
        name: form.name.trim(),
        username: form.username.trim(),
        email: form.email.trim(),
        role: form.role,
      });
      closeEdit();
      await loadUsers();
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to update user.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (u) => {
    if (String(u.id) === String(currentUser?.id || currentUser?._id)) {
      setError('You cannot delete your own account.');
      return;
    }
    if (!window.confirm(`Delete user "${u.name || u.username}"?`)) return;

    setError('');
    try {
      await deleteUser(u.id);
      if (editing?.id === u.id) closeEdit();
      await loadUsers();
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to delete user.');
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl md:text-3xl font-bold text-amber-50">User Management</h1>
          <p className="text-xs text-stone-400 mt-1">
            Update member profiles, change roles, or remove accounts.
          </p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-stone-500" />
          <input
            type="text"
            placeholder="Search email or name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#141210] border border-stone-800/60 rounded-lg pl-9 pr-4 py-2 text-xs text-stone-200 focus:outline-none focus:border-amber-500/60 placeholder-stone-600"
          />
        </div>
      </div>

      {error && (
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {editing && (
        <form
          onSubmit={handleSave}
          className="bg-[#141210] border border-stone-800/60 rounded-xl p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-amber-100">Edit User</h2>
            <button type="button" onClick={closeEdit} className="p-1.5 text-stone-400 hover:text-stone-200">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-stone-500 mb-1">Name</label>
              <input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                className="w-full bg-[#0c0a09] border border-stone-800/60 rounded-lg px-3 py-2 text-xs text-stone-200 focus:outline-none focus:border-amber-500/60"
                required
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-stone-500 mb-1">Username</label>
              <input
                value={form.username}
                onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))}
                className="w-full bg-[#0c0a09] border border-stone-800/60 rounded-lg px-3 py-2 text-xs text-stone-200 focus:outline-none focus:border-amber-500/60"
                required
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-stone-500 mb-1">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                className="w-full bg-[#0c0a09] border border-stone-800/60 rounded-lg px-3 py-2 text-xs text-stone-200 focus:outline-none focus:border-amber-500/60"
                required
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-stone-500 mb-1">Role</label>
              <select
                value={form.role}
                onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}
                className="w-full bg-[#0c0a09] border border-stone-800/60 rounded-lg px-3 py-2 text-xs text-stone-200 focus:outline-none focus:border-amber-500/60"
              >
                <option value="user">user</option>
                <option value="admin">admin</option>
              </select>
            </div>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 text-stone-950 text-xs font-bold disabled:opacity-60"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Save Changes
          </button>
        </form>
      )}

      <div className="bg-[#141210] border border-stone-800/60 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-stone-400 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading users...
          </div>
        ) : (
          <table className="w-full text-left text-xs text-stone-300">
            <thead className="bg-[#0c0a09] text-stone-400 text-[10px] uppercase tracking-wider border-b border-stone-800/60">
              <tr>
                <th className="p-4">User</th>
                <th className="p-4">Username</th>
                <th className="p-4">Role</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-800/40">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-stone-500">
                    No users found.
                  </td>
                </tr>
              ) : (
                filtered.map((u) => (
                  <tr key={u.id} className="hover:bg-[#1a1714] transition-colors">
                    <td className="p-4">
                      <div className="font-semibold text-amber-100">{u.name}</div>
                      <div className="text-[11px] text-stone-500">{u.email}</div>
                    </td>
                    <td className="p-4 text-stone-400">@{u.username}</td>
                    <td className="p-4">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-[#1e1b18] text-amber-400 border border-amber-500/20 capitalize">
                        {u.role}
                      </span>
                    </td>
                    <td className="p-4 text-right space-x-2">
                      <button
                        type="button"
                        onClick={() => openEdit(u)}
                        className="p-1.5 text-stone-400 hover:text-amber-400 rounded bg-[#0c0a09] border border-stone-800/40"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(u)}
                        className="p-1.5 text-red-400 hover:text-red-300 rounded bg-red-500/10 border border-red-500/20"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default UserManagement;
