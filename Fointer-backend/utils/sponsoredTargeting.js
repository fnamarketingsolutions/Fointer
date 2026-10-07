const matchesLocation = (allowed = [], value = "") =>
  !Array.isArray(allowed) ||
  allowed.length === 0 ||
  allowed.some(
    (candidate) =>
      String(candidate).trim().toLocaleLowerCase() ===
      String(value || "").trim().toLocaleLowerCase()
  );

export const matchesSponsoredGeo = (geo, listing) =>
  matchesLocation(geo?.countries, listing.country) &&
  matchesLocation(geo?.states, listing.state) &&
  matchesLocation(geo?.cities, listing.city);
