import React, { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, Search, ArrowLeft } from "lucide-react";
import { fetchBrowsableCommunities } from "../../../../api/communities";
import CommunityCard from "../../components/CommunityCard";
import { useAuth } from "../../../../context/AuthContext";

export default function AllCommunities() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [communities, setCommunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");

  const load = useCallback(async (q = "") => {
    setLoading(true);
    setError("");
    try {
      const params = { includeJoined: "1", limit: 48 };
      if (q.trim()) params.q = q.trim();
      const data = await fetchBrowsableCommunities(params);
      setCommunities(data?.communities || []);
    } catch (err) {
      setError(
        err?.response?.data?.message || "Unable to load communities right now."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(query);
  }, [load, query]);

  const handleSearch = (e) => {
    e.preventDefault();
    setQuery(searchInput.trim());
  };

  return (
    <div className="min-h-screen bg-[#0E0C0A] text-[#E5E0D8]">
      <div className="relative overflow-hidden border-b border-[#2A241E]">
        <div className="absolute inset-0 bg-gradient-to-br from-[#1C1612] via-[#0E0C0A] to-[#0E0C0A]" />
        <div className="absolute top-0 right-0 w-[400px] h-[300px] bg-[#D4AF37]/8 rounded-full blur-[100px] pointer-events-none" />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        
        

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-serif text-[#D4AF37] leading-tight">
            All Communities
          </h1>
          <p className="mt-2 text-sm sm:text-base text-[#A69B8D] max-w-xl">
            Search by name or tags. Request access to private circles, or join
            public ones instantly.
          </p>

          <form
            onSubmit={handleSearch}
            className="mt-8 flex flex-col sm:flex-row gap-2 max-w-2xl"
          >
            <div className="relative flex-1">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8C8070]"
              />
              <input
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search by name or tag..."
                className="w-full pl-10 pr-4 py-3 rounded-lg bg-[#14100D] border border-[#2A241E] text-[#E5E0D8] text-sm placeholder:text-[#8C8070] focus:outline-none focus:border-[#D4AF37]/50"
              />
            </div>
            <button
              type="submit"
              className="px-6 py-3 rounded-lg bg-[#D4AF37] text-black text-sm font-semibold hover:bg-[#e0c04a] shrink-0"
            >
              Search
            </button>
          </form>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
        {error && (
          <div className="mb-6 text-xs sm:text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-center">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16 text-[#A69B8D] text-sm gap-2">
            <Loader2 size={18} className="animate-spin" />
            Loading communities...
          </div>
        ) : communities.length === 0 ? (
          <div className="border border-dashed border-[#2A241E] rounded-2xl py-16 text-center text-[#8C8070] text-sm px-4 max-w-xl mx-auto">
            {query
              ? `No communities match “${query}”.`
              : "No communities to show yet."}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {communities.map((community) => (
              <CommunityCard
                key={community.id}
                community={community}
                onClick={() => navigate(`/communities/${community.id}`)}
              />
            ))}
          </div>
        )}

        {!isAuthenticated && (
          <p className="mt-10 text-center text-xs text-[#8C8070]">
            <Link to="/login" className="text-[#D4AF37] hover:underline">
              Sign in
            </Link>{" "}
            to join or request access to communities.
          </p>
        )}
      </div>
    </div>
  );
}
