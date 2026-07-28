import React from "react";
import { Heart, MessageSquare, Share2, MoreHorizontal, Sparkles } from "lucide-react";

export default function PersonalizedFeed({ user }) {
  // Dynamic user fields with fallbacks
  const displayName = user?.name || user?.username || "User";
  const displayRole = user?.role || "Member";
  const displayAvatar = user?.picture || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200";

  const posts = [
    {
      id: 1,
      author: "Alexander Sterling",
      role: "FOUNDER • QUANTUM VENTURES",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200",
      community: "Alpha Venture Group",
      time: "2 hours ago",
      tag: "INSIGHT",
      title: "Navigating the Liquidity Supercycle: Strategies for 2026",
      content: "As macroeconomic indicators pivot, institutional capital movement suggests an unprecedented shift in private market liquidity...",
      image: "https://images.unsplash.com/photo-1642543492481-44e81e3914a7?auto=format&fit=crop&q=80&w=1000",
      likes: "1.2k",
      comments: 84
    },
    {
      id: 2,
      author: "Elena Rostova",
      role: "HEAD OF RESEARCH • CRYPTO STRATEGY LAB",
      avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=200",
      community: "Crypto Strategy Lab",
      time: "5 hours ago",
      tag: "MARKET ANALYSIS",
      title: "On-Chain Flow Metrics & Institutional Accumulation",
      content: "Analyzing recent wallet migrations across layer-1 ecosystems. We are seeing major sovereign wealth desk testing protocols.",
      image: "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?auto=format&fit=crop&q=80&w=1000",
      likes: "856",
      comments: 32
    }
  ];

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Dynamic User Header Profile Summary Banner */}
      <div className="bg-[#14100D] border border-[#2A241E] rounded-2xl p-6 flex items-center justify-between relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#D4AF37]/5 rounded-full blur-3xl pointer-events-none"></div>
        <div className="flex items-center gap-5 relative z-10">
          <img 
            src={displayAvatar} 
            alt={displayName} 
            className="w-20 h-20 rounded-2xl object-cover border-2 border-[#D4AF37]/40 shadow-xl"
          />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-serif text-2xl font-bold text-[#E5E0D8]">{displayName}</h1>
              <span className="bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/40 text-[10px] px-2 py-0.5 rounded-full font-semibold">
                Verified Elite
              </span>
            </div>
            <p className="text-xs text-[#D4AF37] font-mono tracking-wider mt-0.5 uppercase">
              {displayRole}
            </p>
            <p className="text-xs text-[#A69B8D] mt-2 flex items-center gap-2">
              <span><b>18</b> Communities Joined</span> • <span><b>432</b> Network Connections</span>
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between border-b border-[#2A241E] pb-3">
        <h2 className="text-lg font-serif font-semibold text-[#E5E0D8] flex items-center gap-2">
          <Sparkles size={18} className="text-[#D4AF37]" /> Personalized Community Feed
        </h2>
        <span className="text-xs text-[#8C8070]">Sorted by Recent Activity</span>
      </div>

      {/* Feed Cards */}
      <div className="space-y-6">
        {posts.map((post) => (
          <article key={post.id} className="bg-[#14100D] border border-[#2A241E] rounded-2xl p-5 hover:border-[#3D3123] transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <img src={post.avatar} alt={post.author} className="w-10 h-10 rounded-full object-cover border border-[#2A241E]" />
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-[#E5E0D8]">{post.author}</h3>
                    <span className="text-xs text-[#8C8070]">in</span>
                    <span className="text-xs font-semibold text-[#D4AF37]">{post.community}</span>
                  </div>
                  <p className="text-[10px] text-[#A69B8D] font-mono uppercase">{post.role} • {post.time}</p>
                </div>
              </div>
              <button className="text-[#8C8070] hover:text-[#E5E0D8] p-1"><MoreHorizontal size={18} /></button>
            </div>

            <div className="space-y-2 mb-4">
              <span className="inline-block text-[10px] font-bold uppercase tracking-widest text-[#D4AF37] bg-[#D4AF37]/10 px-2 py-0.5 rounded border border-[#D4AF37]/20">
                {post.tag}
              </span>
              <h4 className="text-lg font-serif font-bold text-[#E5E0D8] hover:text-[#D4AF37] transition-colors cursor-pointer">
                {post.title}
              </h4>
              <p className="text-sm text-[#A69B8D] line-clamp-2 leading-relaxed">{post.content}</p>
            </div>

            {post.image && (
              <div className="rounded-xl overflow-hidden mb-4 border border-[#2A241E] aspect-[16/9] relative">
                <img src={post.image} alt="Post content" className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" />
              </div>
            )}

            <div className="flex items-center gap-6 pt-3 border-t border-[#2A241E]/60 text-xs text-[#8C8070]">
              <button className="flex items-center gap-2 hover:text-[#D4AF37] transition-colors">
                <Heart size={16} /> <span>{post.likes}</span>
              </button>
              <button className="flex items-center gap-2 hover:text-[#D4AF37] transition-colors">
                <MessageSquare size={16} /> <span>{post.comments} Comments</span>
              </button>
              <button className="flex items-center gap-2 hover:text-[#D4AF37] transition-colors ml-auto">
                <Share2 size={16} /> <span>Share</span>
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}