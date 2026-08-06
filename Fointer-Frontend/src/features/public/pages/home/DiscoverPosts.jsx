import React, { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, ArrowRight } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { fetchPublicPosts } from "../../../../api/posts";
import PostCard from "../../../posts/components/PostCard";
import { useAuth } from "../../../../context/AuthContext";
import { useToast } from "../../../../shared/components/feedback/ToastContext";
import { postSegment } from "../../../../shared/services/entityLinks";

export default function DiscoverPosts() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { showToast } = useToast();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchPublicPosts({
        page: 1,
        limit: 3,
        sortBy: "newest",
      });
      setPosts(data?.posts || []);
    } catch (err) {
      showToast(
        err?.response?.data?.message || "Unable to load posts right now."
      );
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    load();
  }, [load]);

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
            Open Feed
          </span>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-serif text-[#E5E0D8] leading-tight">
            Discover Posts
          </h2>
          <p className="mt-3 text-sm sm:text-base text-[#A69B8D] leading-relaxed">
            Browse public posts shared on Fointer — stories and updates posted
            outside of any community.
          </p>
        </motion.div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-[#A69B8D] text-sm gap-2">
            <Loader2 size={18} className="animate-spin" />
            Loading posts...
          </div>
        ) : posts.length === 0 ? (
          <div className="border border-dashed border-[#2A241E] rounded-2xl py-16 text-center text-[#8C8070] text-sm px-4 max-w-xl mx-auto">
            No public posts to showcase yet. Be the first to share one.
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6"
          >
            {posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                onClick={() => navigate(`/posts/${postSegment(post)}`)}
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
            to="/posts"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#D4AF37] text-black text-sm font-semibold hover:bg-[#e0c04a] transition-colors"
          >
            Browse All Posts
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
