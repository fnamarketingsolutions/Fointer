import { COMMUNITY_TYPE_LABELS } from '../constants/community';

export const formatCommunityType = (type) =>
  COMMUNITY_TYPE_LABELS[type] || type || 'Public';

export const parseTags = (tags) =>
  tags
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
