import React, { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, ArrowRight } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { fetchBrowsableCommunities } from "../../../../api/communities";
import CommunityCard from "../../../communities/components/CommunityCard";
import { useAuth } from "../../../../context/AuthContext";

export default function DiscoverCommunities() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [communities, setCommunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchBrowsableCommunities({
        includeJoined: "1",
        limit: 48,
      });
      const fetchedList = data?.communities || [];

      const recentSorted = [...fetchedList].sort(
        (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
      );

      setCommunities(recentSorted);
    } catch (err) {
      setError(
        err?.response?.data?.message || "Unable to load communities right now."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const displayList = communities;

  return (
    <section className="relative bg-[#0E0C0A] py-16 sm:py-20 md:py-24 overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] max-w-[90vw] h-[300px] bg-[#D4AF37]/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-2xl mx-auto mb-10 sm:mb-12"
        >
          <span className="inline-block text-[11px] font-semibold tracking-[0.25em] text-[#D4AF37] uppercase mb-3">
            Elite Circles
          </span>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-serif text-[#E5E0D8] leading-tight">
            Discover Private Communities
          </h2>
          <p className="mt-3 text-sm sm:text-base text-[#A69B8D] leading-relaxed">
            Browse all public and request-access communities. Join instantly or
            send a request — your application goes directly to the community owner.
          </p>
        </motion.div>

        {error && (
          <div className="max-w-xl mx-auto mb-6 text-xs sm:text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-center">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16 text-[#A69B8D] text-sm gap-2">
            <Loader2 size={18} className="animate-spin" />
            Loading communities...
          </div>
        ) : displayList.length === 0 ? (
          <div className="border border-dashed border-[#2A241E] rounded-2xl py-16 text-center text-[#8C8070] text-sm px-4 max-w-xl mx-auto">
            No communities to showcase yet. Be the first to create one.
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6"
          >
            {displayList.map((community) => (
              <CommunityCard
                key={community.id}
                community={community}
                onClick={() => navigate(`/communities/${community.id}`)}
              />
            ))}
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-10 sm:mt-12 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4"
        >
          <Link
            to="/communities"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#D4AF37] text-black text-sm font-semibold hover:bg-[#e0c04a] transition-colors"
          >
            Browse All Communities
            <ArrowRight size={16} />
          </Link>
          {!isAuthenticated && (
            <Link
              to="/signup"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-[#2A241E] text-[#E5E0D8] text-sm font-semibold hover:border-[#D4AF37]/40 transition-colors"
            >
              Join Fointer
            </Link>
          )}
        </motion.div>
      </div>
    </section>
  );
}