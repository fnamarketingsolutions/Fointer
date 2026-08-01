import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Loader2,
  Ban,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Users,
  Building2,
  ExternalLink,
} from 'lucide-react';
import {
  fetchAdminUserDetail,
  fetchUsers,
  updateUserStatus,
} from '../../../../api/dashboard';
import { useAuth } from '../../../../context/AuthContext';
import { COMMUNITY_TYPE_LABELS } from '../../../../shared/constants/community';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'banned', label: 'Banned' },
  { id: 'users', label: 'Users' },
  { id: 'moderators', label: 'Moderators' },
];

const statusClass = (status) => {
  if (status === 'banned') return 'text-red-400 bg-red-500/10 border-red-500/20';
  if (status === 'suspended') return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
  return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
};

const TYPE_LABELS = COMMUNITY_TYPE_LABELS;

const UserManagement = () => {
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [expandedUserId, setExpandedUserId] = useState(null);
  const [detailByUserId, setDetailByUserId] = useState({});
  const [detailLoadingId, setDetailLoadingId] = useState(null);
  const [expandedCommunityId, setExpandedCommunityId] = useState(null);

  const loadUsers = useCallback(async (opts = {}) => {
    const nextFilter = opts.filter ?? filter;
    const nextSearch = opts.search ?? search;
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (nextSearch.trim()) params.q = nextSearch.trim();
      if (nextFilter === 'active' || nextFilter === 'banned') {
        params.status = nextFilter;
      } else if (nextFilter === 'users') {
        params.role = 'user';
      } else if (nextFilter === 'moderators') {
        params.moderators = 'true';
      }
      const data = await fetchUsers(params);
      setUsers(data?.users || []);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load users.');
    } finally {
      setLoading(false);
    }
  }, [filter, search]);

  useEffect(() => {
    loadUsers({ filter });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when filter chips change
  }, [filter]);

  const setStatus = async (u, status) => {
    if (String(u.id) === String(currentUser?.id || currentUser?._id) && status !== 'active') {
      setError('You cannot ban your own account.');
      return;
    }
    setBusyId(u.id);
    setError('');
    try {
      await updateUserStatus(u.id, status);
      await loadUsers();
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to update status.');
    } finally {
      setBusyId(null);
    }
  };

  const toggleUserDetail = async (u) => {
    if (expandedUserId === u.id) {
      setExpandedUserId(null);
      setExpandedCommunityId(null);
      return;
    }

    setExpandedUserId(u.id);
    setExpandedCommunityId(null);

    if (detailByUserId[u.id]) return;

    setDetailLoadingId(u.id);
    setError('');
    try {
      const data = await fetchAdminUserDetail(u.id);
      setDetailByUserId((prev) => ({ ...prev, [u.id]: data }));
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load user detail.');
    } finally {
      setDetailLoadingId(null);
    }
  };

  const toggleCommunityMembers = (communityId) => {
    setExpandedCommunityId((prev) => (prev === communityId ? null : communityId));
  };

  const handleSearch = (e) => {
    e.preventDefault();
    loadUsers({ search });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl md:text-3xl font-bold text-amber-50">
            User Management
          </h1>
          <p className="text-xs text-stone-400 mt-1">
            Ban or activate users.
          </p>
        </div>
        <button
          type="button"
          onClick={() => loadUsers()}
          disabled={loading}
          className="p-2 rounded-lg border border-stone-800 text-stone-400 hover:text-amber-400 hover:border-amber-500/40 transition-colors disabled:opacity-50 shrink-0"
          title="Refresh"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <form onSubmit={handleSearch} className="relative">
        <Search className="w-4 h-4 absolute left-3 top-2.5 text-stone-500" />
        <input
          type="text"
          placeholder="Search by name, username, or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-[#141210] border border-stone-800/60 rounded-lg pl-9 pr-4 py-2 text-xs text-stone-200 focus:outline-none focus:border-amber-600/50 placeholder:text-stone-600"
        />
      </form>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors ${
              filter === f.id
                ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                : 'bg-[#141210] text-stone-400 border-stone-800/60 hover:border-stone-600'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-stone-400 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading users...
        </div>
      ) : users.length === 0 ? (
        <div className="border border-dashed border-stone-800 rounded-xl py-12 text-center text-stone-500 text-sm">
          No users match this filter.
        </div>
      ) : (
        <div className="space-y-4">
          {users.map((u) => {
            const isSelf =
              String(u.id) === String(currentUser?.id || currentUser?._id);
            const busy = busyId === u.id;
            const detail = detailByUserId[u.id];
            const detailLoading = detailLoadingId === u.id;
            return (
              <div
                key={u.id}
                className="bg-[#141210] border border-stone-800/60 rounded-xl px-4 py-4 sm:px-5 my-3 hover:border-amber-500/30 transition-colors"
                onClick={() => toggleUserDetail(u)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleUserDetail(u);
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <div className="flex flex-col lg:flex-row lg:items-center gap-4 justify-between">
                  <div className="flex items-center gap-3 min-w-0 text-left">
                    {u.avatar ? (
                      <img
                        src={u.avatar}
                        alt=""
                        className="w-11 h-11 rounded-full object-cover border border-stone-800 shrink-0"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 text-sm font-semibold shrink-0">
                        {(u.name || u.username || '?').charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-semibold text-amber-50 truncate">
                          {u.name || u.username}
                        </h3>
                        <span className="text-[10px] uppercase tracking-wider text-stone-500 border border-stone-800 px-1.5 py-0.5 rounded">
                          {u.role}
                        </span>
                        <span
                          className={`text-[10px] uppercase tracking-wider border px-1.5 py-0.5 rounded ${statusClass(
                            u.status
                          )}`}
                        >
                          {u.status || 'active'}
                        </span>
                      </div>
                      <p className="text-[11px] text-stone-500 truncate mt-0.5">
                        @{u.username} · {u.email}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {u.status !== 'banned' && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setStatus(u, 'banned');
                        }}
                        disabled={busy || isSelf}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-500/20 bg-red-500/10 text-red-400 text-[11px] font-semibold disabled:opacity-50"
                      >
                        {busy ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <Ban size={12} />
                        )}
                        Ban
                      </button>
                    )}
                    {u.status !== 'active' && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setStatus(u, 'active');
                        }}
                        disabled={busy}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 text-[11px] font-semibold disabled:opacity-50"
                      >
                        {busy ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <CheckCircle2 size={12} />
                        )}
                        Activate
                      </button>
                    )}
                  </div>
                </div>

                <div
                  className={`overflow-hidden transition-all duration-300 ease-out ${
                    expandedUserId === u.id ? 'max-h-[1200px] opacity-100 mt-4' : 'max-h-0 opacity-0'
                  }`}
                >
                  <div className="border-t border-stone-800/60 pt-4 space-y-4">
                    {detailLoading ? (
                      <div className="flex items-center gap-2 text-xs text-stone-500 py-3">
                        <Loader2 size={12} className="animate-spin" /> Loading user detail...
                      </div>
                    ) : detail?.user ? (
                      <>
                        <div className="grid gap-3 md:grid-cols-3">
                          <div className="rounded-xl border border-stone-800/60 bg-[#0E0C0A] p-3">
                            <p className="text-[10px] uppercase tracking-wider text-stone-500">
                              Name
                            </p>
                            <p className="text-sm font-semibold text-amber-50 mt-1">
                              {detail.user.name || 'No name'}
                            </p>
                          </div>
                          <div className="rounded-xl border border-stone-800/60 bg-[#0E0C0A] p-3">
                            <p className="text-[10px] uppercase tracking-wider text-stone-500">
                              Username
                            </p>
                            <p className="text-sm font-semibold text-amber-50 mt-1">
                              @{detail.user.username}
                            </p>
                          </div>
                          <div className="rounded-xl border border-stone-800/60 bg-[#0E0C0A] p-3">
                            <p className="text-[10px] uppercase tracking-wider text-stone-500">
                              Communities
                            </p>
                            <p className="text-sm font-semibold text-amber-50 mt-1">
                              {detail.communityCount || 0}
                            </p>
                          </div>
                        </div>

                        <div className="rounded-xl border border-stone-800/60 bg-[#0E0C0A] p-4 space-y-3">
                          <div className="flex items-center gap-2 text-amber-200">
                            <Building2 size={16} />
                            <h4 className="font-semibold text-sm">Owned Communities</h4>
                          </div>

                          {detail.ownedCommunities?.length ? (
                            <div className="space-y-3">
                              {detail.ownedCommunities.map((community) => {
                                const membersOpen = expandedCommunityId === community.id;
                                return (
                                  <div
                                    key={community.id}
                                    className="rounded-xl border border-stone-800/60 bg-[#141210] p-3 space-y-3"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleCommunityMembers(community.id);
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        toggleCommunityMembers(community.id);
                                      }
                                    }}
                                    role="button"
                                    tabIndex={0}
                                  >
                                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                      <div className="min-w-0">
                                        <p className="text-sm font-semibold text-amber-50">
                                          {community.name}
                                        </p>
                                        <p className="text-[11px] text-stone-500 mt-0.5">
                                          {TYPE_LABELS[community.type] || community.type} ·{' '}
                                          {community.memberCount || 0} members
                                        </p>
                                      </div>
                                      <div className="flex flex-wrap items-center gap-2">
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            navigate(`/admin/communities/${community.id}`);
                                          }}
                                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-500/20 bg-amber-500/10 text-amber-300 text-[11px] font-semibold hover:bg-amber-500/20 transition-colors hover:cursor-pointer"
                                        >
                                          <ExternalLink size={12} />
                                          Community Detail
                                        </button>
                                        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-800 text-stone-400 text-[11px] font-semibold hover:cursor-pointer">
                                          <Users size={12} />
                                          Members
                                          {membersOpen ? (
                                            <ChevronUp size={12} />
                                          ) : (
                                            <ChevronDown size={12} />
                                          )}
                                        </div>
                                      </div>
                                    </div>

                                    <div
                                      className={`overflow-hidden transition-all duration-300 ease-out ${
                                        membersOpen
                                          ? 'max-h-96 opacity-100'
                                          : 'max-h-0 opacity-0'
                                      }`}
                                    >
                                      <div className="border-t border-stone-800/60 pt-3">
                                        {community.members?.length ? (
                                          <div className="space-y-2">
                                            {community.members.map((member) => (
                                              <div
                                                key={member.id}
                                                className="rounded-lg border border-stone-800/60 bg-[#0E0C0A] px-3 py-2 flex items-center justify-between gap-3"
                                              >
                                                <div className="min-w-0">
                                                  <p className="text-sm text-amber-50 truncate">
                                                    {member.user?.name || 'Unnamed member'}
                                                  </p>
                                                  <p className="text-[11px] text-stone-500 truncate">
                                                    @{member.user?.username || 'unknown'}
                                                  </p>
                                                </div>
                                                <span className="text-[10px] uppercase tracking-wider text-stone-500 border border-stone-800 px-1.5 py-0.5 rounded">
                                                  {member.role}
                                                </span>
                                              </div>
                                            ))}
                                          </div>
                                        ) : (
                                          <p className="text-xs text-stone-500">
                                            No active members found.
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="text-xs text-stone-500">
                              This user does not own any communities.
                            </p>
                          )}
                        </div>
                      </>
                    ) : (
                      <p className="text-xs text-stone-500 py-2">No detail available.</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default UserManagement;
