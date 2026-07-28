import React, { useState } from "react";
import { Edit3, Trash2, Clock, ThumbsUp, MessageSquare } from "lucide-react";

export default function ActivityHistory() {
  const [subTab, setSubTab] = useState("posts");

  const myPosts = [
    {
      id: 1,
      title: "Q2 LP Quarterly Update & Portfolio Performance Metrics",
      community: "Alpha Venture Group",
      timeAgo: "22 mins ago",
      timeRemaining: "38 mins left to edit/delete",
      canEdit: true,
      likes: 14,
      comments: 3
    },
    {
      id: 2,
      title: "Analyzing Cross-Chain Bridge Risk Models",
      community: "Crypto Strategy Lab",
      timeAgo: "2 days ago",
      timeRemaining: "Edit window expired",
      canEdit: false,
      likes: 89,
      comments: 18
    }
  ];

  const myComments = [
    {
      id: 1,
      comment: "Agreed on the macroeconomic rates assessment. We expect liquidity relief by Q4.",
      onPost: "Navigating the Liquidity Supercycle: Strategies for 2026",
      timeAgo: "1 hour ago"
    }
  ];

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-xl font-serif font-bold text-[#E5E0D8]">My Activity History</h2>
        <p className="text-xs text-[#8C8070] mt-1">Manage your authored posts, edit windows, comments, and saved likes.</p>
      </div>

      {/* Sub-navigation Tabs */}
      <div className="flex border-b border-[#2A241E] gap-6 text-sm">
        <button 
          onClick={() => setSubTab("posts")} 
          className={`pb-3 font-semibold transition-all ${subTab === "posts" ? "text-[#D4AF37] border-b-2 border-[#D4AF37]" : "text-[#8C8070] hover:text-[#E5E0D8]"}`}
        >
          My Posts
        </button>
        <button 
          onClick={() => setSubTab("comments")} 
          className={`pb-3 font-semibold transition-all ${subTab === "comments" ? "text-[#D4AF37] border-b-2 border-[#D4AF37]" : "text-[#8C8070] hover:text-[#E5E0D8]"}`}
        >
          Comments & Liked Posts
        </button>
      </div>

      {subTab === "posts" && (
        <div className="space-y-4">
          {myPosts.map((post) => (
            <div key={post.id} className="bg-[#14100D] border border-[#2A241E] p-5 rounded-xl space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-mono text-[#D4AF37] uppercase">{post.community}</span>
                  <h3 className="font-serif font-bold text-base text-[#E5E0D8]">{post.title}</h3>
                  <p className="text-[10px] text-[#8C8070] mt-1">Posted {post.timeAgo}</p>
                </div>

                {/* Time-Remaining Badges */}
                {post.canEdit ? (
                  <span className="bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/30 text-[11px] px-2.5 py-1 rounded-full font-mono flex items-center gap-1.5 shrink-0">
                    <Clock size={12} /> {post.timeRemaining}
                  </span>
                ) : (
                  <span className="bg-[#2A241E] text-[#8C8070] text-[11px] px-2.5 py-1 rounded-full font-mono shrink-0">
                    {post.timeRemaining}
                  </span>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-2 border-t border-[#2A241E]/40 text-xs text-[#8C8070]">
                <div className="flex gap-4">
                  <span>{post.likes} Likes</span>
                  <span>{post.comments} Comments</span>
                </div>

                <div className="flex items-center gap-2">
                  <button 
                    disabled={!post.canEdit}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded border text-xs font-medium transition-colors ${
                      post.canEdit 
                        ? "border-[#3D3123] text-[#E5E0D8] hover:border-[#D4AF37] hover:text-[#D4AF37]" 
                        : "border-[#2A241E] text-[#4A4036] cursor-not-allowed"
                    }`}
                  >
                    <Edit3 size={12} /> Edit
                  </button>
                  <button 
                    disabled={!post.canEdit}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded border text-xs font-medium transition-colors ${
                      post.canEdit 
                        ? "border-red-900/40 text-red-400 hover:bg-red-950/40" 
                        : "border-[#2A241E] text-[#4A4036] cursor-not-allowed"
                    }`}
                  >
                    <Trash2 size={12} /> Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {subTab === "comments" && (
        <div className="space-y-4">
          {myComments.map((c) => (
            <div key={c.id} className="bg-[#14100D] border border-[#2A241E] p-4 rounded-xl space-y-2">
              <p className="text-xs text-[#8C8070]">Commented on <span className="text-[#E5E0D8] font-semibold">"{c.onPost}"</span> • {c.timeAgo}</p>
              <blockquote className="border-l-2 border-[#D4AF37] pl-3 py-1 text-sm text-[#E5E0D8] italic bg-[#1C1612]/50 rounded-r">
                "{c.comment}"
              </blockquote>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}