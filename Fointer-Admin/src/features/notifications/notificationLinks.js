import { communitySegment, postSegment } from '../../shared/services/entityLinks';

const ADMIN_TYPES = new Set(['content_report', 'channel_request', 'user_warning']);

const TYPE_LABELS = {
  content_report: 'Content report',
  channel_request: 'Channel request',
  user_warning: 'User warning',
};

export const isAdminNotification = (type) => ADMIN_TYPES.has(type);

export const notificationTypeLabel = (notification) => {
  const type = notification?.type;
  if (TYPE_LABELS[type]) return TYPE_LABELS[type];
  if (notification?.community?.name) return notification.community.name;
  return String(type || 'notification').replace(/_/g, ' ');
};

/** Admin portal notification → path (always admin routes). */
export const notificationPath = (notification) => {
  const type = notification?.type;
  const community = notification?.community;
  const entity = notification?.entity;
  const communityPath = community
    ? `/communities/${communitySegment(community) || community.id}`
    : '';

  if (type === 'channel_request' || type === 'support_ticket') {
    return '/support';
  }
  if (type === 'user_warning') return '/warnings';
  // Owned by Reporting & Analytics (API: /admin/reports, tab: analytics)
  if (type === 'content_report') return '/analytics';
  if (community) return communityPath || '/communities';

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
  }

  return '/notifications';
};
