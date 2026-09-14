import { COMMUNITY_TYPE_LABELS } from '../constants/community';

export const formatCommunityType = (type) =>
  COMMUNITY_TYPE_LABELS[type] || type || 'Public';

/** Strip leading list markers like `1.`, `2)`, `3]` so UI numbering is not doubled. */
export const stripRuleNumberPrefix = (text) =>
  String(text || '')
    .replace(/^\d+[\.\])]\s*/, '')
    .trim();

export const parseCommunityRules = (rules) =>
  String(rules || '')
    .split('\n')
    .map((line) => stripRuleNumberPrefix(line.trim()))
    .filter(Boolean);
