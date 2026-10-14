import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * Mirrors backend resolveEligibleAdPlacements rules used by the website.
 * Sponsored marketplace listings are never part of this map.
 */
const resolveEligibleAdPlacements = ({
  adFreeActive,
  placementConfig = {},
  providerConfigured = false,
} = {}) => {
  const ids = [
    'home_feed',
    'community_feed',
    'marketplace_browse',
    'feed_banner',
  ];
  if (adFreeActive || !providerConfigured) {
    return Object.fromEntries(ids.map((id) => [id, false]));
  }
  return Object.fromEntries(ids.map((id) => [id, Boolean(placementConfig[id])]));
};

test('active subscription hides only third-party display placements', () => {
  const placements = resolveEligibleAdPlacements({
    adFreeActive: true,
    providerConfigured: true,
    placementConfig: {
      home_feed: true,
      community_feed: true,
      marketplace_browse: true,
      feed_banner: true,
    },
  });
  assert.equal(placements.home_feed, false);
  assert.equal(placements.marketplace_browse, false);
});

test('organic and sponsored marketplace categories stay outside removable ads', () => {
  const nonRemovable = [
    'organic_posts',
    'community_content',
    'direct_messages',
    'sponsored_marketplace_listings',
    'fointer_first_party_banners',
  ];
  const removable = Object.keys(
    resolveEligibleAdPlacements({
      adFreeActive: false,
      providerConfigured: true,
      placementConfig: { home_feed: true },
    })
  );
  for (const category of nonRemovable) {
    assert.equal(removable.includes(category), false);
  }
});

test('expired entitlement restores eligible placements when provider is configured', () => {
  const placements = resolveEligibleAdPlacements({
    adFreeActive: false,
    providerConfigured: true,
    placementConfig: {
      home_feed: true,
      community_feed: false,
      marketplace_browse: true,
      feed_banner: true,
    },
  });
  assert.equal(placements.home_feed, true);
  assert.equal(placements.community_feed, false);
  assert.equal(placements.marketplace_browse, true);
});
