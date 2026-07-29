import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Trash2,
  Loader2,
  ArrowLeft,
  Users,
  RefreshCw,
  Search,
} from 'lucide-react';
import {
  fetchAllCommunities,
  deleteCommunity,
} from '../../../../api/communities';
import ConfirmDeleteModal from '../../../../shared/components/modals/ConfirmDeleteModal';
import { COMMUNITY_TYPE_LABELS } from '../../../../shared/constants/community';

const TYPE_LABELS = COMMUNITY_TYPE_LABELS;

export default function CommunityManagement() {
  const navigate = useNavigate();
  const [communities, setCommunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [search, setSearch] = useState('');

  // Modal State
  const [communityToDelete, setCommunityToDelete] = useState(null);

  const query = search.trim().toLowerCase();
  const filteredCommunities = query
    ? communities.filter((c) =>
        (c.name || '').toLowerCase().includes(query)
      )
    : communities;

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

  const openDetail = (community) => {
    navigate(`/admin/communities/${community.id}`);
  };

  const backToList = () => {
    setSelectedId(null);
    setDetail(null);
    setError('');
  };

  const handleConfirmDelete = async () => {
    if (!communityToDelete) return;

    setDeleting(true);
    setError('');
    try {
      await deleteCommunity(communityToDelete.id);
      if (selectedId === communityToDelete.id) {
        backToList();
      }
      setCommunityToDelete(null);
      await loadCommunities();
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to delete community.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-full">
      {selectedId ? (
        <div className="space-y-6">
          <button
            type="button"
            onClick={backToList}
            className="inline-flex items-center gap-1.5 text-xs text-stone-400 hover:text-amber-300 transition-colors"
          >
            <ArrowLeft size={14} /> Back to communities
          </button>

          {error && (
            <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          {detailLoading || !detail ? (
            <div className="flex items-center justify-center gap-2 py-16 text-stone-400 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading community...
            </div>
          ) : (
            <>
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div>
                  <h1 className="font-serif text-2xl md:text-3xl font-bold text-amber-50">
                    {detail.name}
                  </h1>
                  <p className="text-xs text-stone-400 mt-1">
                    {TYPE_LABELS[detail.type] || detail.type} ·{' '}
                    {detail.memberCount ?? 0} members
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setCommunityToDelete(detail)}
                  disabled={deleting}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-500/20 bg-red-500/10 text-red-400 text-xs font-semibold hover:bg-red-500/20 transition-colors disabled:opacity-60"
                >
                  <Trash2 size={14} />
                  Delete
                </button>
              </div>

              {detail.coverImage ? (
                <div className="rounded-xl overflow-hidden border border-stone-800/60 h-48 sm:h-64">
                  <img
                    src={detail.coverImage}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="rounded-xl border border-stone-800/60 h-32 bg-gradient-to-br from-stone-900 to-[#0E0C0A]" />
              )}

              <div className="bg-[#141210] border border-stone-800/60 rounded-xl p-4 sm:p-5 space-y-4">
                <div className="flex items-center gap-2 text-stone-400 text-xs">
                  <Users size={14} className="text-amber-400" />
                  {(detail.memberCount ?? 0).toLocaleString()} members
                </div>

                {detail.owner && (
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-stone-500 mb-1">
                      Owner
                    </div>
                    <p className="text-sm text-amber-50">
                      {detail.owner.name || detail.owner.username}
                      {detail.owner.email ? (
                        <span className="text-stone-500 text-xs ml-2">
                          {detail.owner.email}
                        </span>
                      ) : null}
                    </p>
                  </div>
                )}

                {detail.description && (
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-stone-500 mb-1">
                      Description
                    </div>
                    <p className="text-sm text-stone-300 whitespace-pre-wrap">
                      {detail.description}
                    </p>
                  </div>
                )}

                {detail.rules && (
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-stone-500 mb-1">
                      Rules
                    </div>
                    <p className="text-sm text-stone-300 whitespace-pre-wrap">
                      {detail.rules}
                    </p>
                  </div>
                )}

                {detail.tags?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {detail.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 text-[11px]"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="font-serif text-2xl md:text-3xl font-bold text-amber-50">
                Community Management
              </h1>
              <p className="text-xs text-stone-400 mt-1">
                View community details and delete communities when needed.
              </p>
            </div>
            <button
              type="button"
              onClick={loadCommunities}
              disabled={loading}
              className="p-2 rounded-lg border border-stone-800 text-stone-400 hover:text-amber-400 hover:border-amber-500/40 transition-colors disabled:opacity-50 shrink-0"
              title="Refresh"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-stone-500" />
            <input
              type="text"
              placeholder="Search by community name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#141210] border border-stone-800/60 rounded-lg pl-9 pr-4 py-2 text-xs text-stone-200 focus:outline-none focus:border-amber-600/50 placeholder:text-stone-600"
            />
          </div>

          {error && (
            <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-stone-400 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading communities...
            </div>
          ) : communities.length === 0 ? (
            <div className="border border-dashed border-stone-800 rounded-xl py-12 text-center text-stone-500 text-sm">
              No communities found.
            </div>
          ) : filteredCommunities.length === 0 ? (
            <div className="border border-dashed border-stone-800 rounded-xl py-12 text-center text-stone-500 text-sm">
              No communities match your search.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredCommunities.map((c) => (
                <div
                  key={c.id}
                  className="w-full bg-[#141210] border border-stone-800/60 rounded-xl p-3.5 sm:p-4 flex items-center gap-3 hover:border-amber-500/30 transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => openDetail(c)}
                    className="flex items-center gap-3 min-w-0 flex-1 text-left"
                  >
                    {c.coverImage ? (
                      <img
                        src={c.coverImage}
                        alt=""
                        className="w-14 h-14 rounded-lg object-cover border border-stone-800 shrink-0"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 font-semibold shrink-0">
                        {(c.name || '?').charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-semibold text-amber-50 truncate">
                          {c.name}
                        </h3>
                        <span className="text-[10px] text-stone-500 border border-stone-800 px-1.5 py-0.5 rounded">
                          {TYPE_LABELS[c.type] || c.type}
                        </span>
                      </div>
                      <p className="text-[11px] text-stone-500 line-clamp-1 mt-0.5">
                        {c.description || 'No description'}
                      </p>
                      <p className="text-[10px] text-stone-600 mt-1">
                        {c.memberCount ?? 0} members
                        {c.owner?.username ? ` · @${c.owner.username}` : ''}
                      </p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCommunityToDelete(c)}
                    className="p-2 rounded-lg border border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors shrink-0"
                    aria-label={`Delete ${c.name}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <ConfirmDeleteModal
        open={Boolean(communityToDelete)}
        title="Delete Community"
        variant="admin"
        loading={deleting}
        onConfirm={handleConfirmDelete}
        onClose={() => setCommunityToDelete(null)}
      >
        <p>
          Are you sure you want to delete{' '}
          <strong className="text-stone-100 font-bold">
            {communityToDelete?.name}
          </strong>
          ? This action cannot be undone.
        </p>
      </ConfirmDeleteModal>
    </div>
  );
}