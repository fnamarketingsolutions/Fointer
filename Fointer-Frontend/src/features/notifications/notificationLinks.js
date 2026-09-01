import { communitySegment, postSegment } from '../../shared/services/entityLinks';

const SYSTEM_TYPES = new Set([
  'join_request',
  'join_request_approved',
  'join_request_denied',
  'invite',
  'invite_accepted',
  'invite_declined',
  'moderator_assigned',
  'moderator_revoked',
  'member_removed',
  'member_banned',
  'member_unbanned',
  'support_ticket',
]);

const ADMIN_TYPES = new Set(['content_report', 'channel_request']);

export const TYPE_LABELS = {
  content_report: 'Content report',
  channel_request: 'Channel request',
  support_ticket: 'Support',
};

export const isSystemNotification = (type) => SYSTEM_TYPES.has(type);

export const isAdminNotification = (type) => ADMIN_TYPES.has(type);

export const notificationTypeLabel = (notification) => {
  const type = notification?.type;
  if (TYPE_LABELS[type]) return TYPE_LABELS[type];
  if (notification?.community?.name) return notification.community.name;
  return String(type || 'notification').replace(/_/g, ' ');
};

/**
 * Platform-neutral notification → web path. Native apps should use
 * `type` + `entity` + `community` instead of this helper.
 */
export const notificationPath = (notification, { isAdmin = false } = {}) => {
  const type = notification?.type;
  const community = notification?.community;
  const entity = notification?.entity;
  const communityPath = community
    ? `/communities/${communitySegment(community) || community.id}`
    : '';
  const managePath = community
    ? `/manage-community/${communitySegment(community) || community.id}`
    : '/manage-community';

  const adminCommunityPath = community
    ? `/admin/communities/${communitySegment(community) || community.id}`
    : '/admin/communities';

  if (isAdmin) {
    if (type === 'channel_request' || type === 'support_ticket') {
      return '/admin/support';
    }
    if (type === 'content_report') return '/admin/analytics';
    if (community) return adminCommunityPath;
    return '/admin';
  }

  if (type === 'join_request') {
    return `${managePath}?section=incoming`;
  }
  if (type === 'join_request_approved' || type === 'join_request_denied') {
    return '/communities?tab=requests';
  }
  if (type === 'invite') {
    const inviteId = entity?.id;
    if (communityPath && inviteId) {
      return `${communityPath}?invite=${inviteId}`;
    }
    return '/communities?tab=invites';
  }
  if (type === 'invite_accepted' || type === 'invite_declined') {
    return `${managePath}?section=members`;
  }
  if (
    type === 'comment' ||
    type === 'reply' ||
    type === 'like' ||
    type === 'reshare' ||
    type === 'mention'
  ) {
    if (communityPath && entity?.id) {
      const postPath = postSegment({
        id: entity.id,
        shortCode: entity.shortCode,
        title: entity.title,
      });
      return `${communityPath}/posts/${postPath || entity.id}`;
    }
    if (entity?.id) return `/post-management/${entity.id}`;
    return '/';
  }
  if (type === 'support_ticket') {
    return '/support';
  }
  if (
    type === 'moderator_assigned' ||
    type === 'moderator_revoked' ||
    type === 'member_removed' ||
    type === 'member_banned' ||
    type === 'member_unbanned'
  ) {
    return communityPath || '/communities';
  }
  return '/notifications';
};
