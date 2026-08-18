import React from "react";
import {
  LuLoader as Loader2
} from "react-icons/lu";
import PostAuthorAvatar from "./PostAuthorAvatar";
import { timeAgo } from "../../../shared/utils/date";

export default function RecentPostsSidebar({
  recentPosts,
  recentPostsLoading,
  communityId,
  postPathBuilder,
  navigate,
}) {
  if (!communityId) return null;

  return (
    <div className="bg-[#14100D] rounded-xl p-5 space-y-4 shadow-xl">
      <h3 className="text-sm font-serif font-semibold text-[#E5E0D8] border-b border-[#2A241E] pb-3">
        Recent Posts
      </h3>
      {recentPostsLoading ? (
        <div className="flex items-center gap-2 text-xs text-[#8C8070] py-2">
          <Loader2 size={14} className="animate-spin text-[#D4AF37]" />
          Loading...
        </div>
      ) : recentPosts.length === 0 ? (
        <p className="text-xs text-[#8C8070]">
          No other posts for this community.
        </p>
      ) : (
        <div className="space-y-3">
          {recentPosts.map((recentPost) => {
            const authorName =
              recentPost.author?.name ||
              recentPost.author?.username ||
              "Member";
            const coverImage = recentPost.media?.find((m) => m.type === "image");

            return (
              <div
                key={recentPost.id}
                className="rounded-lg border border-[#2A241E] bg-[#0E0C0A] p-3 space-y-2"
              >
                <div className="flex items-start gap-3">
                  <PostAuthorAvatar author={recentPost.author} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-[#E5E0D8] truncate">
                      {authorName}
                    </div>
                    {recentPost.author?.username && (
                      <div className="text-[10px] text-[#A69B8D] truncate">
                        @{recentPost.author.username}
                      </div>
                    )}
                    <div className="text-[10px] text-[#8C8070] mt-0.5">
                      {timeAgo(recentPost.createdAt)}
                    </div>
                  </div>
                  {coverImage && (
                    <div className="w-16 h-16 shrink-0 rounded-md overflow-hidden bg-[#14100D] border border-[#2A241E]">
                      <img
                        src={coverImage.url}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      const path = postPathBuilder
                        ? postPathBuilder(recentPost.id)
                        : `/communities/${communityId}/posts/${recentPost.id}`;
                      navigate(path);
                    }}
                    className="text-[10px] font-medium text-[#D4AF37] hover:text-[#c3a030] transition-colors"
                  >
                    Details →
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
