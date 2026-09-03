import api from './http/client';
import { toSlugParam } from '../utils/slug';

const RESOLVE_PATHS = {
  community: (code) => `/communities/resolve/${code}`,
  post: (code) => `/posts/resolve/${code}`,
};

const caches = {
  community: new Map(),
  post: new Map(),
};

const isObjectId = (value) => /^[a-f\d]{24}$/i.test(String(value ?? ''));

/**
 * Every list already knows both the code and the id, so recording the pair
 * when a link is built means navigating from a list never needs a lookup.
 */
const primeEntityId = (kind, code, id) => {
  if (!code || !id || isObjectId(code)) return;
  caches[kind]?.set(String(code), String(id));
};

/** Synchronous answer when one is available, otherwise null. */
export const peekEntityId = (kind, code) => {
  if (!code) return null;
  const value = String(code);
  if (isObjectId(value)) return value;
  return caches[kind]?.get(value) || null;
};

export const resolveEntityId = async (kind, code) => {
  const known = peekEntityId(kind, code);
  if (known) return known;
  if (!code) return null;

  const value = String(code);
  const response = await api.get(RESOLVE_PATHS[kind](value));
  const id = response.data?.id ? String(response.data.id) : null;
  if (id) caches[kind]?.set(value, id);
  return id;
};

const buildSegment = (kind, entity, title) => {
  if (!entity) return '';
  const code = entity.shortCode || entity.id;
  primeEntityId(kind, entity.shortCode, entity.id);
  return toSlugParam(title, code);
};

export const communitySegment = (community) =>
  buildSegment('community', community, community?.name);

export const postSegment = (post) => buildSegment('post', post, post?.title);
