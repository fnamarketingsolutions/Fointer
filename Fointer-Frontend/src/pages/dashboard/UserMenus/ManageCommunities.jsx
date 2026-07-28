import React, { useCallback, useEffect, useState } from "react";
import {
  Pencil,
  Trash2,
  X,
  Loader2,
  ArrowLeft,
  Users,
  Activity,
  MessageSquare,
  Medal,
  ChevronRight,
} from "lucide-react";
import {
  fetchMyCommunities,
  fetchCommunityManage,
  updateCommunity,
  deleteCommunity,
  approveJoinRequest,
  denyJoinRequest,
} from "../../../api/communities";

const emptyForm = {
  name: "",
  description: "",
  rules: "",
  tags: "",
  coverImage: "",
  type: "public",
};

const TYPE_LABELS = {
  public: "Public",
  private_invite: "Private-Invite",
  private_request: "Private-Request",
};

const formatType = (type) => TYPE_LABELS[type] || type || "Public";

export default function ManageCommunities() {
  const [communities, setCommunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [editingCommunity, setEditingCommunity] = useState(null);
  const [deletingCommunity, setDeletingCommunity] = useState(null);

  const [selectedId, setSelectedId] = useState(null);
  const [manageData, setManageData] = useState(null);
  const [manageLoading, setManageLoading] = useState(false);
  const [actionRequestId, setActionRequestId] = useState(null);

  const loadCommunities = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchMyCommunities();
      setCommunities(data?.communities || []);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load communities.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadManage = useCallback(async (id) => {
    if (!id) return;
    setManageLoading(true);
    setError("");
    try {
      const data = await fetchCommunityManage(id);
      setManageData(data);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load community dashboard.");
      setManageData(null);
    } finally {
      setManageLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCommunities();
  }, [loadCommunities]);

  useEffect(() => {
    if (selectedId) {
      loadManage(selectedId);
    } else {
      setManageData(null);
    }
  }, [selectedId, loadManage]);

  const openCommunity = (community) => {
    setSelectedId(community.id);
    setError("");
  };

  const backToList = () => {
    setSelectedId(null);
    setManageData(null);
    setError("");
    loadCommunities();
  };

  const openEdit = (community) => {
    setForm({
      name: community.name || "",
      description: community.description || "",
      rules: community.rules || "",
      tags: (community.tags || []).join(", "),
      coverImage: community.coverImage || "",
      type: community.type || "public",
    });
    setEditingCommunity(community);
    setError("");
  };

  const closeEdit = () => {
    setEditingCommunity(null);
    setForm(emptyForm);
  };

  const openDelete = (community) => {
    setDeletingCommunity(community);
    setError("");
  };

  const closeDelete = () => {
    setDeletingCommunity(null);
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!editingCommunity) return;
    if (!form.name.trim()) {
      setError("Community name is required.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      await updateCommunity(editingCommunity.id, {
        name: form.name.trim(),
        description: form.description.trim(),
        rules: form.rules.trim(),
        tags: form.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        coverImage: form.coverImage.trim(),
        type: form.type,
      });
      closeEdit();
      await loadCommunities();
      if (selectedId === editingCommunity.id) {
        await loadManage(selectedId);
      }
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to update community.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingCommunity) return;

    setDeleting(true);
    setError("");
    try {
      await deleteCommunity(deletingCommunity.id);
      closeDelete();
      if (selectedId === deletingCommunity.id) {
        backToList();
      } else {
        await loadCommunities();
      }
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to delete community.");
    } finally {
      setDeleting(false);
    }
  };

  const handleApprove = async (requestId) => {
    if (!selectedId) return;
    setActionRequestId(requestId);
    setError("");
    try {
      await approveJoinRequest(selectedId, requestId);
      await loadManage(selectedId);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to approve request.");
    } finally {
      setActionRequestId(null);
    }
  };

  const handleDeny = async (requestId) => {
    if (!selectedId) return;
    setActionRequestId(requestId);
    setError("");
    try {
      await denyJoinRequest(selectedId, requestId);
      await loadManage(selectedId);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to deny request.");
    } finally {
      setActionRequestId(null);
    }
  };

  const community = manageData?.community;
  const metrics = manageData?.metrics;
  const pendingRequests = manageData?.pendingRequests || [];
  const growthSeries = metrics?.growthSeries || [];
  const maxGrowth = Math.max(1, ...growthSeries.map((g) => g.value || 0));

  if (selectedId) {
    return (
      <div className="space-y-6 max-w-full">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <button
              type="button"
              onClick={backToList}
              className="inline-flex items-center gap-1.5 text-xs text-[#A69B8D] hover:text-[#D4AF37] mb-2 transition-colors"
            >
              <ArrowLeft size={14} />
              Back to communities
            </button>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-serif font-semibold text-[#E5E0D8]">
              {community?.name || "Community Dashboard"}
            </h1>
            <p className="text-xs sm:text-sm text-[#A69B8D] mt-1">
              {formatType(community?.type)} • {community?.memberCount ?? 0} members
            </p>
          </div>

          {community && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => openEdit(community)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#2A241E] text-xs text-[#A69B8D] hover:text-[#D4AF37] hover:border-[#D4AF37]/40"
              >
                <Pencil size={14} />
                Edit
              </button>
              <button
                type="button"
                onClick={() => openDelete(community)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-500/20 bg-red-500/10 text-red-400 text-xs hover:bg-red-500/20"
              >
                <Trash2 size={14} />
                Delete
              </button>
            </div>
          )}
        </div>

        {error && !editingCommunity && !deletingCommunity && (
          <div className="text-xs sm:text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 sm:px-4 py-2.5 sm:py-3">
            {error}
          </div>
        )}

        {manageLoading || !manageData ? (
          <div className="flex items-center justify-center py-16 text-[#A69B8D] text-xs sm:text-sm gap-2">
            <Loader2 size={16} className="animate-spin" />
            Loading dashboard...
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
              <div className="bg-[#14100D] border border-[#2A241E] rounded-xl p-4 sm:p-5">
                <div className="flex items-center justify-between text-[#A69B8D] text-[11px] uppercase tracking-wider mb-2">
                  <span>Total Members</span>
                  <Users size={14} className="text-[#D4AF37]" />
                </div>
                <div className="text-2xl sm:text-3xl font-semibold text-white">
                  {(metrics?.totalMembers ?? 0).toLocaleString()}
                </div>
                <p className="text-[11px] text-[#D4AF37] mt-1">Live membership count</p>
              </div>

              <div className="bg-[#14100D] border border-[#2A241E] rounded-xl p-4 sm:p-5">
                <div className="flex items-center justify-between text-[#A69B8D] text-[11px] uppercase tracking-wider mb-2">
                  <span>Engagement Rate</span>
                  <Activity size={14} className="text-[#D4AF37]" />
                </div>
                <div className="text-2xl sm:text-3xl font-semibold text-white">
                  {(metrics?.engagementRate ?? 0).toFixed(1)}%
                </div>
                <div className="mt-2 w-full h-1.5 rounded-full bg-[#0E0C0A] overflow-hidden">
                  <div
                    className="h-full bg-[#D4AF37] rounded-full"
                    style={{ width: `${Math.min(100, metrics?.engagementRate || 0)}%` }}
                  />
                </div>
              </div>

              <div className="bg-[#14100D] border border-[#2A241E] rounded-xl p-4 sm:p-5">
                <div className="flex items-center justify-between text-[#A69B8D] text-[11px] uppercase tracking-wider mb-2">
                  <span>Active Threads</span>
                  <MessageSquare size={14} className="text-[#D4AF37]" />
                </div>
                <div className="text-2xl sm:text-3xl font-semibold text-white">
                  {metrics?.activeThreads ?? 0}
                </div>
                <p className="text-[11px] text-[#8C8070] mt-1">Available after posts launch</p>
              </div>

              <div className="bg-[#14100D] border border-[#2A241E] rounded-xl p-4 sm:p-5">
                <div className="flex items-center justify-between text-[#A69B8D] text-[11px] uppercase tracking-wider mb-2">
                  <span>Elite Tier</span>
                  <Medal size={14} className="text-[#D4AF37]" />
                </div>
                <div className="text-2xl sm:text-3xl font-semibold text-white">
                  Lvl {metrics?.tierLevel ?? 1}
                </div>
                <p className="text-[11px] text-[#8C8070] mt-1">
                  {metrics?.tierLabel || "Elite"} community
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5">
              <div className="lg:col-span-7 bg-[#14100D] border border-[#2A241E] rounded-xl p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <h2 className="text-base sm:text-lg font-semibold text-[#E5E0D8]">
                      Pending Requests
                    </h2>
                    <p className="text-[11px] sm:text-xs text-[#A69B8D] mt-0.5">
                      Review and approve new member applications.
                    </p>
                  </div>
                  <span className="text-[11px] text-[#D4AF37] shrink-0">
                    {pendingRequests.length} pending
                  </span>
                </div>

                {community?.type !== "private_request" ? (
                  <div className="border border-dashed border-[#2A241E] rounded-lg py-10 text-center text-[#8C8070] text-xs px-4">
                    Join requests only apply to Private-Request communities.
                  </div>
                ) : pendingRequests.length === 0 ? (
                  <div className="border border-dashed border-[#2A241E] rounded-lg py-10 text-center text-[#8C8070] text-xs px-4">
                    No pending requests right now.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pendingRequests.map((request) => {
                      const name = request.user?.name || request.user?.username || "Member";
                      const initial = name.charAt(0).toUpperCase();
                      const busy = actionRequestId === request.id;
                      return (
                        <div
                          key={request.id}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg bg-[#0E0C0A] border border-[#2A241E]"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {request.user?.avatar ? (
                              <img
                                src={request.user.avatar}
                                alt=""
                                className="w-10 h-10 rounded-full object-cover border border-[#2A241E] shrink-0"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-[#D4AF37]/15 border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37] text-sm font-semibold shrink-0">
                                {initial}
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-[#E5E0D8] truncate">
                                {name}
                              </div>
                              <div className="text-[11px] text-[#A69B8D] truncate">
                                {request.user?.email || request.user?.username || "Applicant"}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 self-end sm:self-auto">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => handleDeny(request.id)}
                              className="px-3 py-1.5 rounded-lg border border-[#2A241E] text-xs text-[#A69B8D] hover:text-[#E5E0D8] disabled:opacity-60"
                            >
                              Deny
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => handleApprove(request.id)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#D4AF37] text-black text-xs font-semibold disabled:opacity-60"
                            >
                              {busy && <Loader2 size={12} className="animate-spin" />}
                              Approve
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="lg:col-span-5 bg-[#14100D] border border-[#2A241E] rounded-xl p-4 sm:p-5">
                <h2 className="text-base sm:text-lg font-semibold text-[#E5E0D8]">
                  Growth Health
                </h2>
                <p className="text-[11px] sm:text-xs text-[#A69B8D] mt-0.5 mb-4">
                  Historical performance of community acquisition.
                </p>

                <div className="flex items-end gap-2 h-36 mb-4">
                  {growthSeries.map((point) => (
                    <div
                      key={point.label}
                      className="flex-1 flex flex-col items-center gap-1 h-full justify-end"
                    >
                      <div
                        className="w-full max-w-[28px] rounded-t-md bg-[#D4AF37]/35"
                        style={{
                          height: `${Math.max(8, ((point.value || 0) / maxGrowth) * 100)}%`,
                        }}
                        title={`${point.label}: ${point.value}`}
                      />
                      <span className="text-[9px] text-[#8C8070]">{point.label}</span>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-4 text-[11px] text-[#A69B8D]">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#D4AF37]" />
                    Organic Reach: {metrics?.organicReach ?? 0}%
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#5A5046]" />
                    Referral Elite: {metrics?.referralElite ?? 0}%
                  </span>
                </div>
              </div>
            </div>

            {(community?.description || community?.rules || community?.tags?.length > 0) && (
              <div className="bg-[#14100D] border border-[#2A241E] rounded-xl p-4 sm:p-5 space-y-3">
                <h2 className="text-base font-semibold text-[#E5E0D8]">Community Details</h2>
                {community.description && (
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-[#A69B8D] mb-1">
                      Description
                    </div>
                    <p className="text-xs sm:text-sm text-[#E5E0D8] whitespace-pre-wrap">
                      {community.description}
                    </p>
                  </div>
                )}
                {community.rules && (
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-[#A69B8D] mb-1">
                      Rules
                    </div>
                    <p className="text-xs sm:text-sm text-[#E5E0D8] whitespace-pre-wrap">
                      {community.rules}
                    </p>
                  </div>
                )}
                {community.tags?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {community.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 rounded-md bg-[#D4AF37]/10 text-[#D4AF37] text-[11px]"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {(editingCommunity || deletingCommunity) && (
          <ManageModals
            editingCommunity={editingCommunity}
            deletingCommunity={deletingCommunity}
            form={form}
            setForm={setForm}
            error={error}
            saving={saving}
            deleting={deleting}
            closeEdit={closeEdit}
            closeDelete={closeDelete}
            handleUpdate={handleUpdate}
            handleDeleteConfirm={handleDeleteConfirm}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-full">
      <div>
        <h1 className="text-xl sm:text-2xl md:text-3xl font-serif font-semibold text-[#E5E0D8]">
          Manage Communities
        </h1>
        <p className="text-xs sm:text-sm text-[#A69B8D] mt-1">
          Open a community to review requests, metrics, and settings.
        </p>
      </div>

      {error && !editingCommunity && !deletingCommunity && (
        <div className="text-xs sm:text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 sm:px-4 py-2.5 sm:py-3">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-[#A69B8D] text-xs sm:text-sm gap-2">
          <Loader2 size={16} className="animate-spin" />
          Loading communities...
        </div>
      ) : communities.length === 0 ? (
        <div className="border border-dashed border-[#2A241E] rounded-xl py-12 sm:py-16 text-center text-[#A69B8D] text-xs sm:text-sm px-4">
          You have not created any communities yet.
        </div>
      ) : (
        <div className="space-y-3">
          {communities.map((item) => (
            <div
              key={item.id}
              className="bg-[#14100D] border border-[#2A241E] rounded-xl p-3.5 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 transition-all hover:border-[#D4AF37]/25"
            >
              <button
                type="button"
                onClick={() => openCommunity(item)}
                className="flex items-start gap-3 min-w-0 w-full sm:w-auto text-left flex-1"
              >
                {item.coverImage ? (
                  <img
                    src={item.coverImage}
                    alt=""
                    className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg object-cover border border-[#2A241E] shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37] font-semibold text-sm sm:text-base shrink-0">
                    {(item.name || "?").charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-xs sm:text-sm text-[#E5E0D8] truncate">
                      {item.name}
                    </h3>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#0E0C0A] border border-[#2A241E] text-[#A69B8D]">
                      {formatType(item.type)}
                    </span>
                  </div>
                  <p className="text-[11px] sm:text-xs text-[#A69B8D] mt-0.5 line-clamp-2 leading-relaxed">
                    {item.description || "No description"}
                  </p>
                  <p className="text-[10px] text-[#8C8070] mt-1">
                    {item.memberCount ?? 0} members
                  </p>
                </div>
                <ChevronRight size={16} className="text-[#5A5046] shrink-0 mt-1 hidden sm:block" />
              </button>

              <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto ml-auto sm:ml-0">
                <button
                  type="button"
                  onClick={() => openCommunity(item)}
                  className="px-3 py-2 rounded-lg bg-[#D4AF37] text-black text-xs font-semibold hover:bg-[#e0c04a]"
                >
                  Open
                </button>
                <button
                  type="button"
                  onClick={() => openEdit(item)}
                  aria-label={`Edit ${item.name}`}
                  className="p-2 rounded-lg border border-[#2A241E] text-[#A69B8D] hover:text-[#D4AF37] hover:border-[#D4AF37]/40 transition-colors bg-[#0E0C0A]/40"
                >
                  <Pencil size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => openDelete(item)}
                  aria-label={`Delete ${item.name}`}
                  className="p-2 rounded-lg border border-red-500/20 bg-red-500/10 text-red-400 hover:text-red-300 transition-colors"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {(editingCommunity || deletingCommunity) && (
        <ManageModals
          editingCommunity={editingCommunity}
          deletingCommunity={deletingCommunity}
          form={form}
          setForm={setForm}
          error={error}
          saving={saving}
          deleting={deleting}
          closeEdit={closeEdit}
          closeDelete={closeDelete}
          handleUpdate={handleUpdate}
          handleDeleteConfirm={handleDeleteConfirm}
        />
      )}
    </div>
  );
}

function ManageModals({
  editingCommunity,
  deletingCommunity,
  form,
  setForm,
  error,
  saving,
  deleting,
  closeEdit,
  closeDelete,
  handleUpdate,
  handleDeleteConfirm,
}) {
  return (
    <>
      {editingCommunity && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={closeEdit} />
          <div className="relative w-full max-w-md bg-[#14100D] border border-[#2A241E] rounded-xl p-4 sm:p-5 shadow-2xl z-10 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base sm:text-lg font-semibold text-[#D4AF37]">Edit Community</h2>
              <button
                type="button"
                onClick={closeEdit}
                className="p-1.5 text-[#A69B8D] hover:text-[#E5E0D8] rounded-lg"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            {error && (
              <div className="mb-4 text-xs sm:text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <form onSubmit={handleUpdate} className="space-y-3.5">
              <div>
                <label className="block text-[10px] sm:text-xs uppercase tracking-wider text-[#A69B8D] mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 sm:py-2.5 rounded-lg bg-[#0E0C0A] border border-[#2A241E] text-[#E5E0D8] text-xs sm:text-sm focus:outline-none focus:border-[#D4AF37]/60"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] sm:text-xs uppercase tracking-wider text-[#A69B8D] mb-1">
                  Description
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, description: e.target.value }))
                  }
                  rows={2}
                  className="w-full px-3 py-2 sm:py-2.5 rounded-lg bg-[#0E0C0A] border border-[#2A241E] text-[#E5E0D8] text-xs sm:text-sm focus:outline-none focus:border-[#D4AF37]/60 resize-y"
                />
              </div>

              <div>
                <label className="block text-[10px] sm:text-xs uppercase tracking-wider text-[#A69B8D] mb-1">
                  Rules
                </label>
                <textarea
                  value={form.rules}
                  onChange={(e) => setForm((prev) => ({ ...prev, rules: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 sm:py-2.5 rounded-lg bg-[#0E0C0A] border border-[#2A241E] text-[#E5E0D8] text-xs sm:text-sm focus:outline-none focus:border-[#D4AF37]/60 resize-y"
                />
              </div>

              <div>
                <label className="block text-[10px] sm:text-xs uppercase tracking-wider text-[#A69B8D] mb-1">
                  Tags (comma-separated)
                </label>
                <input
                  type="text"
                  value={form.tags}
                  onChange={(e) => setForm((prev) => ({ ...prev, tags: e.target.value }))}
                  className="w-full px-3 py-2 sm:py-2.5 rounded-lg bg-[#0E0C0A] border border-[#2A241E] text-[#E5E0D8] text-xs sm:text-sm focus:outline-none focus:border-[#D4AF37]/60"
                  placeholder="finance, startups"
                />
              </div>

              <div>
                <label className="block text-[10px] sm:text-xs uppercase tracking-wider text-[#A69B8D] mb-1">
                  Cover Image URL
                </label>
                <input
                  type="url"
                  value={form.coverImage}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, coverImage: e.target.value }))
                  }
                  className="w-full px-3 py-2 sm:py-2.5 rounded-lg bg-[#0E0C0A] border border-[#2A241E] text-[#E5E0D8] text-xs sm:text-sm focus:outline-none focus:border-[#D4AF37]/60"
                  placeholder="https://..."
                />
              </div>

              <div>
                <label className="block text-[10px] sm:text-xs uppercase tracking-wider text-[#A69B8D] mb-1">
                  Type
                </label>
                <select
                  value={form.type}
                  onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value }))}
                  className="w-full px-3 py-2 sm:py-2.5 rounded-lg bg-[#0E0C0A] border border-[#2A241E] text-[#E5E0D8] text-xs sm:text-sm focus:outline-none focus:border-[#D4AF37]/60"
                >
                  <option value="public">Public</option>
                  <option value="private_invite">Private-Invite</option>
                  <option value="private_request">Private-Request</option>
                </select>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#D4AF37] text-black text-xs sm:text-sm font-semibold disabled:opacity-60 hover:bg-[#e0c04a] transition-colors"
                >
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  Save Changes
                </button>
                <button
                  type="button"
                  onClick={closeEdit}
                  className="flex-1 sm:flex-none px-4 py-2.5 rounded-lg border border-[#2A241E] text-xs sm:text-sm text-[#A69B8D] hover:text-[#E5E0D8]"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deletingCommunity && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={closeDelete} />
          <div className="relative w-full max-w-sm bg-[#14100D] border border-[#2A241E] rounded-xl p-4 sm:p-5 shadow-2xl z-10">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base sm:text-lg font-semibold text-red-400">Delete Community</h2>
              <button
                type="button"
                onClick={closeDelete}
                className="p-1.5 text-[#A69B8D] hover:text-[#E5E0D8] rounded-lg"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            {error && (
              <div className="mb-3 text-xs sm:text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <p className="text-xs sm:text-sm text-[#A69B8D] mb-4">
              Are you sure you want to delete{" "}
              <span className="text-[#E5E0D8] font-semibold">{deletingCommunity.name}</span>? This
              action cannot be undone.
            </p>

            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={deleting}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 text-xs sm:text-sm font-semibold hover:bg-red-500/30 disabled:opacity-60 transition-colors"
              >
                {deleting && <Loader2 size={14} className="animate-spin" />}
                Delete
              </button>
              <button
                type="button"
                onClick={closeDelete}
                disabled={deleting}
                className="flex-1 px-4 py-2.5 rounded-lg border border-[#2A241E] text-xs sm:text-sm text-[#A69B8D] hover:text-[#E5E0D8]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
