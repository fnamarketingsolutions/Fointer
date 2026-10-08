const normalizePlace = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/\s+/g, " ");

const matchesLocation = (allowed = [], value = "") => {
  if (!Array.isArray(allowed) || allowed.length === 0) return true;
  const needle = normalizePlace(value);
  if (!needle) return false;
  return allowed.some((candidate) => {
    const hay = normalizePlace(candidate);
    if (!hay) return false;
    return hay === needle || hay.includes(needle) || needle.includes(hay);
  });
};

const isGeoEmpty = (geo) =>
  !geo ||
  ((!geo.countries || !geo.countries.length) &&
    (!geo.states || !geo.states.length) &&
    (!geo.cities || !geo.cities.length));

/** Normalize seller-chosen promote location into geo snapshot arrays. */
export const normalizePromoteLocation = ({ country, state, city } = {}) => {
  const countryName = String(country || "").trim().slice(0, 100);
  const stateName = String(state || "").trim().slice(0, 100);
  const cityName = String(city || "").trim().slice(0, 100);
  if (!countryName || !stateName || !cityName) {
    throw new Error("Choose a country, state, and city for this promotion.");
  }
  return {
    countries: [countryName],
    states: [stateName],
    cities: [cityName],
  };
};

/**
 * Package availability (5.6 geolocation on packages).
 * Empty package geo = global tier (Starter/Medium/Full) — available everywhere.
 * Non-empty = package only sellable when promote location matches allow-list.
 */
export const packageAvailableForLocation = (packageGeo, location) => {
  if (isGeoEmpty(packageGeo)) return true;
  const country = location?.country ?? location?.countries?.[0];
  const state = location?.state ?? location?.states?.[0];
  const city = location?.city ?? location?.cities?.[0];
  return (
    matchesLocation(packageGeo.countries, country) &&
    matchesLocation(packageGeo.states, state) &&
    matchesLocation(packageGeo.cities, city)
  );
};

/**
 * Placement audience geo (seller-chosen at checkout) vs viewer profile.
 * Empty / unknown viewer → show (marketplace-wide).
 * Only enforce levels the viewer has filled so partial profiles stay in sync.
 */
export const matchesSponsoredAudience = (geo, viewer) => {
  if (isGeoEmpty(geo)) return true;
  if (!viewer) return true;
  const country = String(viewer.country || "").trim();
  const state = String(viewer.state || "").trim();
  const city = String(viewer.city || "").trim();
  if (!country && !state && !city) return true;
  if (country && !matchesLocation(geo.countries, country)) return false;
  if (state && !matchesLocation(geo.states, state)) return false;
  if (city && !matchesLocation(geo.cities, city)) return false;
  return true;
};
