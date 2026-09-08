const slugify = (value) =>
  String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const toSlugParam = (title, code) => {
  if (!code) return "";
  const slug = slugify(title);
  return slug ? `${slug}-${code}` : String(code);
};

const communitySegment = (community) => {
  if (!community) return "";
  return toSlugParam(community.name, community.shortCode || community.id);
};

const postSegment = (entity) => {
  if (!entity) return "";
  return toSlugParam(entity.title, entity.shortCode || entity.id);
};

/** Same destinations as the member-app inbox, so every platform opens one place. */
export const notificationPath = (notification) => {
  const type = notification?.type;
  const community = notification?.community;
  const entity = notification?.entity;
  const communityPath = community
    ? `/communities/${communitySegment(community) || community.id}`
    : "";
  const managePath = community
    ? `/manage-community/${communitySegment(community) || community.id}`
    : "/manage-community";

  if (type === "join_request") {
    return `${managePath}?section=incoming`;
  }
  if (type === "join_request_approved" || type === "join_request_denied") {
    return "/communities?tab=requests";
  }
  if (type === "invite") {
    const inviteId = entity?.id;
    if (communityPath && inviteId) {
      return `${communityPath}?invite=${inviteId}`;
    }
    return "/communities?tab=invites";
  }
  if (type === "invite_accepted" || type === "invite_declined") {
    return `${managePath}?section=members`;
  }
  if (
    type === "comment" ||
    type === "reply" ||
    type === "like" ||
    type === "reshare" ||
    type === "mention"
  ) {
    if (communityPath && entity?.id) {
      const postPath = postSegment(entity);
      return `${communityPath}/posts/${postPath || entity.id}`;
    }
    if (entity?.id) return `/post-management/${entity.id}`;
    return "/";
  }
  if (type === "support_ticket") {
    return "/support";
  }
  if (
    type === "moderator_assigned" ||
    type === "moderator_revoked" ||
    type === "member_removed" ||
    type === "member_banned" ||
    type === "member_unbanned"
  ) {
    return communityPath || "/communities";
  }
  if (type === "listing_inquiry") {
    const listingPath = entity?.shortCode || entity?.id;
    if (listingPath) return `/marketplace/${listingPath}`;
    return "/marketplace/my-listings";
  }
  if (type === "direct_message") {
    const conversationId = entity?.id;
    if (conversationId) return `/messages/${conversationId}`;
    return "/messages";
  }
  return "/notifications";
};
