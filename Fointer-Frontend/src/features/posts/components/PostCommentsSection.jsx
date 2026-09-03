import React from "react";
import {
  LuPencil as Pencil,
  LuTrash2 as Trash2,
  LuLoader as Loader2,
  LuHeart as Heart,
  LuReply as Reply,
  LuChevronDown as ChevronDown,
  LuChevronUp as ChevronUp,
  LuFlag as Flag
} from "react-icons/lu";
import PostAuthorAvatar from "./PostAuthorAvatar";
import UserProfileLink from "../../../shared/components/UserProfileLink";
import { timeAgo } from "../../../shared/utils/date";

export default function PostCommentsSection({
  visible,
  compact,
  post,
  comments,
  commentsLoading,
  commentsExpanded,
  setCommentsExpanded,
  topLevel,
  visibleTopLevel,
  getReplies,
  expandedReplies,
  toggleRepliesExpand,
  replyTargetId,
  setReplyTargetId,
  setShowMainCommentInput,
  commentText,
  setCommentText,
  mainInputVisible,
  editingComment,
  setEditingComment,
  submitComment,
  saveCommentEdit,
  handleLikeComment,
  openEditComment,
  openDeleteComment,
  canShowEdit,
  canShowDelete,
  canReportComment,
  setReportTarget,
  setCommentsOpen,
}) {
  if (!visible) return null;

  return (
    <section
      className={`bg-fo-surface shadow-xl ${
        compact
          ? "rounded-lg p-4 space-y-4"
          : "rounded-xl p-5 sm:p-8 space-y-6"
      }`}
    >
      <div
        className={`flex items-center justify-between gap-3 border-b border-fo-border ${
          compact ? "pb-3" : "pb-4"
        }`}
      >
        <h2
          className={`font-serif font-semibold text-fo-text ${
            compact ? "text-base" : "text-lg sm:text-xl"
          }`}
        >
          Discussion{" "}
          <span className="text-fo-muted font-sans text-xs sm:text-sm">
            ({post.commentCount || comments.length || 0})
          </span>
        </h2>
        {!commentsLoading &&
          topLevel.length > 3 &&
          !commentsExpanded && (
            <button
              type="button"
              onClick={() => setCommentsExpanded(true)}
              className="text-xs text-fo-accent hover:text-[#c3a030] transition-colors shrink-0"
            >
              View all comments
            </button>
          )}
      </div>

      {/* Main Comment Input Box (Slow Reveal Transition) */}
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          mainInputVisible
            ? `max-h-60 opacity-100 ${compact ? "mb-4" : "mb-6"}`
            : "max-h-0 opacity-0 pointer-events-none"
        }`}
      >
        <div className="rounded-lg border border-fo-border bg-fo-bg p-4 space-y-3">
          <textarea
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            rows={3}
            placeholder="Write a comment..."
            className="w-full bg-transparent text-sm text-fo-text placeholder:text-fo-subtle focus:outline-none resize-y"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setShowMainCommentInput(false);
                if (compact) setCommentsOpen(false);
                setCommentText("");
              }}
              className="px-3.5 py-2 rounded-lg text-xs text-fo-muted hover:text-fo-text transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => submitComment(null)}
              className="px-4 py-2 rounded-lg bg-fo-accent text-fo-bg text-xs font-bold hover:bg-[#c3a030] transition-colors"
            >
              Post Comment
            </button>
          </div>
        </div>
      </div>

      {/* Comments List */}
      {commentsLoading ? (
        <div className="flex items-center gap-2 text-xs text-fo-subtle py-4">
          <Loader2 size={14} className="animate-spin text-fo-accent" />{" "}
          Loading comments...
        </div>
      ) : topLevel.length === 0 ? (
        <p className="text-xs text-fo-subtle py-4">No comments yet.</p>
      ) : (
        <div className="space-y-6">
          {visibleTopLevel.map((comment) => {
            const replies = getReplies(comment.id);
            const isExpanded = !!expandedReplies[comment.id];
            const isReplyingHere = replyTargetId === comment.id;

            return (
              <div key={comment.id} className="space-y-3">
                {/* Parent Comment Item */}
                <div className="py-2">
                  {editingComment?.id === comment.id ? (
                    <div className="space-y-3 bg-fo-bg p-3 rounded-lg border border-fo-border">
                      <textarea
                        value={editingComment.text}
                        onChange={(e) =>
                          setEditingComment((p) => ({
                            ...p,
                            text: e.target.value,
                          }))
                        }
                        rows={2}
                        className="w-full bg-fo-surface border border-fo-border rounded-lg px-3 py-2 text-xs text-fo-text focus:outline-none focus:border-fo-accent/60 resize-y"
                      />
                      <div className="flex gap-2 justify-end">
                        <button
                          type="button"
                          onClick={() => setEditingComment(null)}
                          className="px-3 py-1.5 rounded border border-fo-border text-[11px] text-fo-muted hover:text-fo-text"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={saveCommentEdit}
                          className="px-3.5 py-1.5 rounded bg-fo-accent text-fo-bg text-[11px] font-bold hover:bg-[#c3a030]"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3">
                      <PostAuthorAvatar author={comment.author} size="sm" />
                      <div className="min-w-0 flex-1 space-y-1.5">
                        {/* Header info */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <UserProfileLink
                              author={comment.author}
                              className="text-xs font-bold text-fo-text hover:text-fo-accent transition-colors"
                            >
                              {comment.author?.name ||
                                comment.author?.username ||
                                "Member"}
                            </UserProfileLink>
                            <span className="text-[11px] text-fo-subtle">
                              {timeAgo(comment.createdAt)}
                            </span>
                            {comment.author?.role && (
                              <span className="text-[9px] uppercase tracking-wider bg-fo-accent/15 text-fo-accent px-1.5 py-0.5 rounded font-mono border border-fo-accent/30">
                                {comment.author.role}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            {canReportComment(comment) && (
                              <button
                                type="button"
                                onClick={() =>
                                  setReportTarget({
                                    type: "comment",
                                    id: comment.id,
                                    label: "this comment",
                                  })
                                }
                                className="text-fo-subtle hover:text-red-400 transition-colors p-1"
                                title="Report comment"
                              >
                                <Flag size={12} />
                              </button>
                            )}
                            {(canShowEdit(comment) ||
                              canShowDelete(comment)) && (
                              <>
                                {canShowEdit(comment) && (
                                  <button
                                    type="button"
                                    onClick={() => openEditComment(comment)}
                                    className="text-fo-subtle hover:text-fo-accent transition-colors p-1"
                                    title="Edit comment"
                                  >
                                    <Pencil size={12} />
                                  </button>
                                )}
                                {canShowDelete(comment) && (
                                  <button
                                    type="button"
                                    onClick={() => openDeleteComment(comment)}
                                    className="text-fo-subtle hover:text-red-400 transition-colors p-1"
                                    title="Delete comment"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </div>

                        <p className="text-xs sm:text-sm text-fo-muted leading-relaxed">
                          {comment.text}
                        </p>

                        {/* Action Controls Below Comment */}
                        <div className="flex items-center gap-4 pt-1 text-[11px] text-fo-muted">
                          <button
                            type="button"
                            onClick={() => handleLikeComment(comment)}
                            className={`inline-flex items-center gap-1.5 hover:text-fo-text transition-colors ${
                              comment.likedByMe
                                ? "text-fo-accent font-semibold"
                                : ""
                            }`}
                          >
                            <Heart
                              size={13}
                              className={
                                comment.likedByMe
                                  ? "fill-current text-fo-accent"
                                  : ""
                              }
                            />
                            <span>{comment.likeCount || 0}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setShowMainCommentInput(false);
                              if (isReplyingHere) {
                                setReplyTargetId(null);
                                setCommentText("");
                              } else {
                                setReplyTargetId(comment.id);
                                setCommentText("");
                              }
                            }}
                            className="inline-flex items-center gap-1.5 hover:text-fo-accent transition-colors"
                          >
                            <Reply size={13} />
                            <span>Reply</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Inline Reply Input directly under comment (Slow animation reveal) */}
                <div
                  className={`ml-6 sm:ml-10 overflow-hidden transition-all duration-300 ease-in-out ${
                    isReplyingHere
                      ? "max-h-60 opacity-100 my-2"
                      : "max-h-0 opacity-0 pointer-events-none"
                  }`}
                >
                  <div className="rounded-lg border border-fo-border bg-fo-bg p-3 space-y-2">
                    <textarea
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      rows={2}
                      placeholder={`Reply to ${
                        comment.author?.name || "member"
                      }...`}
                      className="w-full bg-transparent text-xs text-fo-text placeholder:text-fo-subtle focus:outline-none resize-y"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setReplyTargetId(null);
                          setCommentText("");
                        }}
                        className="px-3 py-1 rounded text-[11px] text-fo-muted hover:text-fo-text"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => submitComment(comment.id)}
                        className="px-3 py-1 rounded bg-fo-accent text-fo-bg text-[11px] font-bold hover:bg-[#c3a030]"
                      >
                        Reply
                      </button>
                    </div>
                  </div>
                </div>

                {/* View/Hide Replies Trigger */}
                {replies.length > 0 && (
                  <div className="ml-6 sm:ml-10 pt-1">
                    <button
                      type="button"
                      onClick={() => toggleRepliesExpand(comment.id)}
                      className="inline-flex items-center gap-1.5 text-xs text-fo-accent font-medium hover:underline focus:outline-none"
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp size={14} />
                          Hide replies
                        </>
                      ) : (
                        <>
                          <ChevronDown size={14} />
                          View {replies.length}{" "}
                          {replies.length === 1 ? "reply" : "replies"}
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* Expanded Replies Wrapper with smooth transition */}
                <div
                  className={`ml-6 sm:ml-10 border-l border-fo-border pl-4 sm:pl-6 space-y-3 overflow-hidden transition-all duration-300 ease-in-out ${
                    isExpanded
                      ? "max-h-[2000px] opacity-100 mt-2"
                      : "max-h-0 opacity-0 pointer-events-none"
                  }`}
                >
                  {replies.map((reply) => {
                    const isReplyingToReply = replyTargetId === reply.id;

                    return (
                      <div key={reply.id} className="py-2 space-y-2">
                        {editingComment?.id === reply.id ? (
                          <div className="space-y-3 bg-fo-bg p-3 rounded-lg border border-fo-border">
                            <textarea
                              value={editingComment.text}
                              onChange={(e) =>
                                setEditingComment((p) => ({
                                  ...p,
                                  text: e.target.value,
                                }))
                              }
                              rows={2}
                              className="w-full bg-fo-surface border border-fo-border rounded-lg px-3 py-2 text-xs text-fo-text focus:outline-none focus:border-fo-accent/60 resize-y"
                            />
                            <div className="flex gap-2 justify-end">
                              <button
                                type="button"
                                onClick={() => setEditingComment(null)}
                                className="px-3 py-1.5 rounded border border-fo-border text-[11px] text-fo-muted hover:text-fo-text"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={saveCommentEdit}
                                className="px-3.5 py-1.5 rounded bg-fo-accent text-fo-bg text-[11px] font-bold hover:bg-[#c3a030]"
                              >
                                Save
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start gap-3">
                            <PostAuthorAvatar author={reply.author} size="sm" />
                            <div className="min-w-0 flex-1 space-y-1.5">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <UserProfileLink
                                    author={reply.author}
                                    className="text-xs font-bold text-fo-text hover:text-fo-accent transition-colors"
                                  >
                                    {reply.author?.name ||
                                      reply.author?.username ||
                                      "Member"}
                                  </UserProfileLink>
                                  <span className="text-[11px] text-fo-subtle">
                                    {timeAgo(reply.createdAt)}
                                  </span>
                                  {reply.author?.role && (
                                    <span className="text-[9px] uppercase tracking-wider bg-fo-accent/15 text-fo-accent px-1.5 py-0.5 rounded font-mono border border-fo-accent/30">
                                      {reply.author.role}
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-1 shrink-0">
                                  {canReportComment(reply) && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setReportTarget({
                                          type: "comment",
                                          id: reply.id,
                                          label: "this reply",
                                        })
                                      }
                                      className="text-fo-subtle hover:text-red-400 transition-colors p-1"
                                      title="Report reply"
                                    >
                                      <Flag size={12} />
                                    </button>
                                  )}
                                  {(canShowEdit(reply) ||
                                    canShowDelete(reply)) && (
                                    <>
                                      {canShowEdit(reply) && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            openEditComment(reply)
                                          }
                                          className="text-fo-subtle hover:text-fo-accent transition-colors p-1"
                                          title="Edit reply"
                                        >
                                          <Pencil size={12} />
                                        </button>
                                      )}
                                      {canShowDelete(reply) && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            openDeleteComment(reply)
                                          }
                                          className="text-fo-subtle hover:text-red-400 transition-colors p-1"
                                          title="Delete reply"
                                        >
                                          <Trash2 size={12} />
                                        </button>
                                      )}
                                    </>
                                  )}
                                </div>
                              </div>

                              <p className="text-xs sm:text-sm text-fo-muted leading-relaxed">
                                {reply.text}
                              </p>

                              <div className="flex items-center gap-4 pt-1 text-[11px] text-fo-muted">
                                <button
                                  type="button"
                                  onClick={() => handleLikeComment(reply)}
                                  className={`inline-flex items-center gap-1.5 hover:text-fo-text transition-colors ${
                                    reply.likedByMe
                                      ? "text-fo-accent font-semibold"
                                      : ""
                                  }`}
                                >
                                  <Heart
                                    size={13}
                                    className={
                                      reply.likedByMe
                                        ? "fill-current text-fo-accent"
                                        : ""
                                    }
                                  />
                                  <span>{reply.likeCount || 0}</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    if (isReplyingToReply) {
                                      setReplyTargetId(null);
                                      setCommentText("");
                                    } else {
                                      setReplyTargetId(reply.id);
                                      setCommentText("");
                                    }
                                  }}
                                  className="inline-flex items-center gap-1.5 hover:text-fo-accent transition-colors"
                                >
                                  <Reply size={13} />
                                  <span>Reply</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Nested Input below reply item */}
                        <div
                          className={`overflow-hidden transition-all duration-300 ease-in-out ${
                            isReplyingToReply
                              ? "max-h-60 opacity-100 my-2"
                              : "max-h-0 opacity-0 pointer-events-none"
                          }`}
                        >
                          <div className="rounded-lg border border-fo-border bg-fo-bg p-3 space-y-2">
                            <textarea
                              value={commentText}
                              onChange={(e) => setCommentText(e.target.value)}
                              rows={2}
                              placeholder={`Reply to ${
                                reply.author?.name || "member"
                              }...`}
                              className="w-full bg-transparent text-xs text-fo-text placeholder:text-fo-subtle focus:outline-none resize-y"
                            />
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setReplyTargetId(null);
                                  setCommentText("");
                                }}
                                className="px-3 py-1 rounded text-[11px] text-fo-muted hover:text-fo-text"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => submitComment(comment.id)}
                                className="px-3 py-1 rounded bg-fo-accent text-fo-bg text-[11px] font-bold hover:bg-[#c3a030]"
                              >
                                Reply
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
