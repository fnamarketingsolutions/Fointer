import { City, Country, State } from "country-state-city";

const countries = Country.getAllCountries()
  .map(({ name, isoCode }) => ({ name, isoCode }))
  .sort((a, b) => a.name.localeCompare(b.name));

const normalizePlace = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/\s+/g, " ");

const matchState = (countryCode, stateName, stateIso) => {
  const rows = State.getStatesOfCountry(countryCode);
  const iso = String(stateIso || "").trim().toUpperCase();
  if (iso) {
    const byIso = rows.find((item) => item.isoCode.toUpperCase() === iso);
    if (byIso) return byIso;
  }
  const name = normalizePlace(stateName);
  if (!name) return null;
  return (
    rows.find((item) => normalizePlace(item.name) === name) ||
    rows.find((item) => {
      const rowName = normalizePlace(item.name);
      return rowName.includes(name) || name.includes(rowName);
    }) ||
    null
  );
};

const cityNames = (countryCode, stateCode) => {
  const names = City.getCitiesOfState(countryCode, stateCode).map((item) => item.name);
  return [...new Set(names)].sort((a, b) => a.localeCompare(b));
};

export const listCountries = (_req, res) => {
  return res.status(200).json({ success: true, countries });
};

export const listStates = (req, res) => {
  const country = String(req.query.country || "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(country)) {
    return res.status(400).json({
      success: false,
      message: "Choose a valid country.",
    });
  }
  const states = State.getStatesOfCountry(country)
    .map(({ name, isoCode }) => ({ name, isoCode }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return res.status(200).json({ success: true, states });
};

export const listCities = (req, res) => {
  const country = String(req.query.country || "").trim().toUpperCase();
  const state = String(req.query.state || "").trim();
  if (!/^[A-Z]{2}$/.test(country) || !/^[A-Za-z0-9-]{1,10}$/.test(state)) {
    return res.status(400).json({
      success: false,
      message: "Choose a valid country and state.",
    });
  }
  return res.status(200).json({
    success: true,
    cities: cityNames(country, state),
  });
};

const placeNames = (places, key) => [
  ...new Set(
    places
      .map((place) => String(place?.[key] || "").trim())
      .filter(Boolean)
  ),
];

const lookupZippopotam = async (countryCode, code) => {
  const variants = [...new Set([code.replace(/\s+/g, ""), code])];
  for (const variant of variants) {
    const response = await fetch(
      `https://api.zippopotam.us/${countryCode.toLowerCase()}/${encodeURIComponent(variant)}`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (response.status === 404) continue;
    if (!response.ok) {
      throw new Error("Postal lookup failed.");
    }
    const data = await response.json();
    const places = Array.isArray(data.places) ? data.places : [];
    if (!places.length) continue;
    const resolvedCountry = String(data["country abbreviation"] || countryCode).toUpperCase();
    const country = Country.getCountryByCode(resolvedCountry);
    const matched = matchState(
      resolvedCountry,
      places[0].state,
      places[0]["state abbreviation"]
    );
    const localities = placeNames(places, "place name");
    return {
      zipCode: String(data["post code"] || code),
      country: country?.name || data.country || "",
      countryCode: resolvedCountry,
      state: matched?.name || places[0].state || "",
      stateCode: matched?.isoCode || places[0]["state abbreviation"] || "",
      city: localities[0] || "",
      localities,
    };
  }
  return null;
};

const lookupNominatim = async (code, countryCode) => {
  const params = new URLSearchParams({
    postalcode: code,
    format: "jsonv2",
    addressdetails: "1",
    limit: "5",
  });
  if (countryCode) params.set("countrycodes", countryCode.toLowerCase());
  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?${params}`,
    {
      headers: {
        Accept: "application/json",
        "User-Agent": "Fointer/1.0 (https://fointer.net)",
      },
      signal: AbortSignal.timeout(8000),
    }
  );
  if (!response.ok) {
    throw new Error("Postal lookup failed.");
  }
  const rows = await response.json();
  if (!Array.isArray(rows) || rows.length === 0) return null;

  const address = rows[0]?.address || {};
  const resolvedCountry = String(address.country_code || countryCode || "").toUpperCase();
  const country = Country.getCountryByCode(resolvedCountry);
  const isoCandidates = [
    "ISO3166-2-lvl8",
    "ISO3166-2-lvl7",
    "ISO3166-2-lvl6",
    "ISO3166-2-lvl5",
    "ISO3166-2-lvl4",
  ]
    .map((key) => String(address[key] || "").split("-").pop())
    .filter(Boolean);
  let matched = null;
  for (const iso of isoCandidates) {
    matched = matchState(resolvedCountry, "", iso);
    if (matched) break;
  }
  if (!matched) matched = matchState(resolvedCountry, address.state, "");

  const localities = [
    ...new Set(
      rows
        .map((row) => {
          const item = row.address || {};
          return (
            item.city ||
            item.town ||
            item.village ||
            item.municipality ||
            item.suburb ||
            ""
          );
        })
        .map((name) => String(name).trim())
        .filter(Boolean)
    ),
  ];

  return {
    zipCode: address.postcode || code,
    country: country?.name || address.country || "",
    countryCode: resolvedCountry,
    state: matched?.name || address.state || "",
    stateCode: matched?.isoCode || "",
    city: localities[0] || "",
    localities,
  };
};

export const lookupPostal = async (req, res) => {
  const code = String(req.params.code || "").trim();
  const country = String(req.query.country || "").trim().toUpperCase();
  if (!/^[A-Za-z0-9][A-Za-z0-9 -]{1,11}$/.test(code)) {
    return res.status(400).json({
      success: false,
      message: "Enter a valid postal code.",
    });
  }
  if (country && !/^[A-Z]{2}$/.test(country)) {
    return res.status(400).json({
      success: false,
      message: "Choose a valid country.",
    });
  }

  try {
    const location = country
      ? (await lookupZippopotam(country, code)) || (await lookupNominatim(code, country))
      : await lookupNominatim(code);
    if (!location) {
      return res.status(404).json({
        success: false,
        message: "No address found for this postal code.",
      });
    }
    return res.status(200).json({ success: true, location });
  } catch {
    return res.status(502).json({
      success: false,
      message: "Could not look up that postal code. Try again.",
    });
  }
};
