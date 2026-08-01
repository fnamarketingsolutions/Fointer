import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, RefreshCw, ArrowRight, Search } from "lucide-react";
import { fetchJoinedCommunities } from "../../../../api/communities";
import CommunityCard from "../../components/CommunityCard";
import CommunityBrowseDetail from "../../components/CommunityBrowseDetail";

export default function JoinedCommunities() {
  const [joined, setJoined] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState("");

  const query = search.trim().toLowerCase();
  const filteredJoined = query
    ? joined.filter((c) => (c.name || "").toLowerCase().includes(query))
    : joined;

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const joinedRes = await fetchJoinedCommunities();
      setJoined(joinedRes?.communities || []);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load communities.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-[#A69B8D] text-xs sm:text-sm gap-2">
        <Loader2 size={16} className="animate-spin" />
        Loading communities...
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-full">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-serif font-semibold text-[#E5E0D8]">
            Joined Communities
          </h1>
          <p className="text-xs sm:text-sm text-[#A69B8D] mt-1">
            Communities you are an active member of.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="p-2 rounded-lg border border-[#2A241E] text-[#A69B8D] hover:text-[#D4AF37] hover:border-[#D4AF37]/40 transition-colors disabled:opacity-50 shrink-0"
          title="Refresh"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#8C8070]" />
        <input
          type="text"
          placeholder="Search by community name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-[#0D0A08] border border-[#2A241E] rounded-lg pl-9 pr-4 py-2 text-xs sm:text-sm text-[#E5E0D8] focus:outline-none focus:border-[#D4AF37]/60 placeholder:text-[#8C8070]"
        />
      </div>

      {error && (
        <div className="text-xs sm:text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 sm:px-4 py-2.5">
          {error}
        </div>
      )}

      {joined.length === 0 ? (
        <div className="border border-dashed border-[#2A241E] rounded-xl py-12 sm:py-16 text-center text-[#8C8070] text-xs sm:text-sm px-4 space-y-4">
          <p>You have not joined any communities yet.</p>
          <Link
            to="/communities"
            className="inline-flex items-center gap-2 text-[#D4AF37] hover:text-[#e0c04a] font-medium"
          >
            Browse all communities <ArrowRight size={14} />
          </Link>
        </div>
      ) : filteredJoined.length === 0 ? (
        <div className="border border-dashed border-[#2A241E] rounded-xl py-12 sm:py-16 text-center text-[#8C8070] text-xs sm:text-sm px-4">
          No communities match your search.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {filteredJoined.map((c) => (
            <CommunityCard
              key={c.id}
              community={c}
              onClick={() => setSelectedId(c.id)}
              roleLabel={c.membershipRole || "member"}
            />
          ))}
        </div>
      )}

      {selectedId && (
        <CommunityBrowseDetail
          communityId={selectedId}
          onClose={() => setSelectedId(null)}
          onJoined={load}
        />
      )}
    </div>
  );
}
