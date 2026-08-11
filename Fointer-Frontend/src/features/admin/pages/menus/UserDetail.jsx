import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Users } from 'lucide-react';
import { fetchAdminUserDetail } from '../../../../api/dashboard';
import { useToast } from '../../../../shared/components/feedback/ToastContext';

export default function UserDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadDetail = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await fetchAdminUserDetail(id);
      setDetail(data);
    } catch (err) {
      showToast(err?.response?.data?.message || 'Failed to load user detail.');
    } finally {
      setLoading(false);
    }
  }, [id, showToast]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() => navigate('/admin/users')}
        className="inline-flex items-center gap-1.5 text-xs text-stone-400 hover:text-amber-300 transition-colors"
      >
        <ArrowLeft size={14} /> Back to users
      </button>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-20 text-stone-400 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading user detail...
        </div>
      ) : !detail?.user ? (
        <div className="border border-dashed border-stone-800 rounded-xl py-12 text-center text-stone-500 text-sm">
          User not found.
        </div>
      ) : (
        <div className="space-y-5">
          <div className="bg-[#141210] border border-stone-800/60 rounded-xl p-4 sm:p-5">
            <div className="flex items-center gap-3">
              {detail.user.avatar ? (
                <img
                  src={detail.user.avatar}
                  alt=""
                  className="w-16 h-16 rounded-full object-cover border border-stone-800"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 text-xl font-semibold">
                  {(detail.user.name || detail.user.username || '?').charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <h1 className="font-serif text-2xl font-bold text-amber-50 truncate">
                  {detail.user.name || detail.user.username}
                </h1>
                <p className="text-sm text-stone-400">@{detail.user.username}</p>
                <p className="text-xs text-stone-500">{detail.user.email}</p>
              </div>
            </div>
          </div>

          <div className="bg-[#141210] border border-stone-800/60 rounded-xl p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-4 text-amber-200">
              <Users size={16} />
              <h2 className="font-semibold text-sm">Owned Communities</h2>
            </div>
            {detail.ownedCommunities?.length ? (
              <div className="space-y-3">
                {detail.ownedCommunities.map((community) => (
                  <div
                    key={community.id}
                    className="rounded-lg border border-stone-800/60 bg-[#0E0C0A] p-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-amber-50">{community.name}</p>
                        <p className="text-[11px] text-stone-500">
                          @{community.owner?.username || detail.user.username}
                        </p>
                      </div>
                      <p className="text-xs text-stone-300">
                        {community.memberCount || 0} members
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-stone-500">No owned communities found.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
