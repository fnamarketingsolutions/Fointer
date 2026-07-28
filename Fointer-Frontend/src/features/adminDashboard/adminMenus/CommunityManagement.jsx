import React, { useCallback, useEffect, useState } from 'react';
import { Trash2, Pencil, X, Loader2 } from 'lucide-react';
import {
  fetchAllCommunities,
  updateCommunity,
  deleteCommunity,
} from '../../../api/communities';

const emptyForm = { name: '', description: '', avatar: '' };

const CommunityManagement = () => {
  const [communities, setCommunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const loadCommunities = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchAllCommunities();
      setCommunities(data?.communities || []);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load communities.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCommunities();
  }, [loadCommunities]);

  const openEdit = (community) => {
    setEditingId(community.id);
    setForm({
      name: community.name || '',
      description: community.description || '',
      avatar: community.avatar || '',
    });
    setError('');
  };

  const closeEdit = () => {
    setEditingId(null);
    setForm(emptyForm);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!editingId) return;

    setSaving(true);
    setError('');
    try {
      await updateCommunity(editingId, {
        name: form.name.trim(),
        description: form.description.trim(),
        avatar: form.avatar.trim(),
      });
      closeEdit();
      await loadCommunities();
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to update community.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete community "${name}"?`)) return;

    setError('');
    try {
      await deleteCommunity(id);
      if (editingId === id) closeEdit();
      await loadCommunities();
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to delete community.');
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-2xl md:text-3xl font-bold text-amber-50">Community Management</h1>
        <p className="text-xs text-stone-400 mt-1">
          Review, edit, or remove communities across the platform.
        </p>
      </div>

      {error && (
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {editingId && (
        <form
          onSubmit={handleSave}
          className="bg-[#141210] border border-stone-800/60 rounded-xl p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-amber-100">Edit Community</h2>
            <button type="button" onClick={closeEdit} className="p-1.5 text-stone-400 hover:text-stone-200">
              <X className="w-4 h-4" />
            </button>
          </div>
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
            <label className="block text-[10px] uppercase tracking-wider text-stone-500 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              rows={3}
              className="w-full bg-[#0c0a09] border border-stone-800/60 rounded-lg px-3 py-2 text-xs text-stone-200 focus:outline-none focus:border-amber-500/60 resize-y"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-stone-500 mb-1">Avatar URL</label>
            <input
              value={form.avatar}
              onChange={(e) => setForm((p) => ({ ...p, avatar: e.target.value }))}
              className="w-full bg-[#0c0a09] border border-stone-800/60 rounded-lg px-3 py-2 text-xs text-stone-200 focus:outline-none focus:border-amber-500/60"
            />
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

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-stone-400 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading communities...
        </div>
      ) : communities.length === 0 ? (
        <div className="border border-dashed border-stone-800 rounded-xl py-16 text-center text-stone-500 text-sm">
          No communities yet.
        </div>
      ) : (
        <div className="space-y-4">
          {communities.map((item) => (
            <div
              key={item.id}
              className="bg-[#141210] border border-stone-800/60 rounded-xl p-5 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="space-y-1.5 max-w-2xl">
                <h3 className="font-serif text-lg font-bold text-amber-100">{item.name}</h3>
                <p className="text-xs text-stone-400">
                  {item.description || 'No description'}
                </p>
                <p className="text-[11px] text-stone-500">
                  Owner: {item.owner?.name || item.owner?.username || 'Unknown'}
                  {item.owner?.email ? ` (${item.owner.email})` : ''}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openEdit(item)}
                  className="p-2 text-stone-400 hover:text-amber-400 rounded-lg bg-[#0c0a09] border border-stone-800/60 transition-colors"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(item.id, item.name)}
                  className="p-2 text-stone-400 hover:text-red-400 rounded-lg bg-[#0c0a09] border border-stone-800/60 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CommunityManagement;
