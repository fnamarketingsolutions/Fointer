import { COMMUNITY_TYPE_LABELS } from '../constants/community';

export const formatCommunityType = (type) =>
  COMMUNITY_TYPE_LABELS[type] || type || 'Public';
