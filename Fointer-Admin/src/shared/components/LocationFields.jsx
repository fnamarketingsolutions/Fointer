import { useEffect, useMemo, useRef, useState } from "react";
import api from "../services/http/client";

const readyPostal = (value) => {
  const compact = String(value || "").replace(/[\s-]/g, "");
  return /^[A-Z0-9]{4,12}$/.test(compact);
};

const normalizePlace = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/\s+/g, " ");

/** Resolve free-text / listing values against API rows (case + soft match). */
const resolveNamedRow = (rows, rawName) => {
  const name = normalizePlace(rawName);
  if (!name || !Array.isArray(rows) || !rows.length) return null;
  return (
    rows.find((item) => normalizePlace(item.name) === name) ||
    rows.find((item) => {
      const rowName = normalizePlace(item.name);
      return rowName.includes(name) || name.includes(rowName);
    }) ||
    null
  );
};

const resolveNamedString = (names, rawName) => {
  const name = normalizePlace(rawName);
  if (!name || !Array.isArray(names) || !names.length) return "";
  const exact = names.find((item) => normalizePlace(item) === name);
  if (exact) return exact;
  const soft = names.find((item) => {
    const rowName = normalizePlace(item);
    return rowName.includes(name) || name.includes(rowName);
  });
  return soft || "";
};

export default function LocationFields({
  value,
  onChange,
  inputClass,
  labelClass,
  showAddress = true,
  showPostal = true,
}) {
  const [countries, setCountries] = useState([]);
  const [countriesLoading, setCountriesLoading] = useState(true);
  const [states, setStates] = useState([]);
  const [statesLoading, setStatesLoading] = useState(false);
  const [cities, setCities] = useState([]);
  const [citiesLoading, setCitiesLoading] = useState(false);
  const [localities, setLocalities] = useState([]);
  const [lookupError, setLookupError] = useState("");
  const [lookingUp, setLookingUp] = useState(false);
  const onChangeRef = useRef(onChange);
  const postalEditedRef = useRef(false);
  const lastCanonicalRef = useRef("");

  useEffect(() => {
    onChangeRef.current = onChange;
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await api.get("/locations/countries");
        if (!cancelled) setCountries(response.data?.countries || []);
      } catch {
        if (!cancelled) setCountries([]);
      } finally {
        if (!cancelled) setCountriesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const resolvedCountry = resolveNamedRow(countries, value.country);
  const countryIso = resolvedCountry?.isoCode || "";
  const resolvedState = resolveNamedRow(states, value.state);
  const stateIso = resolvedState?.isoCode || "";

  // Keep parent value on canonical API names so dropdowns + promote geo stay in sync.
  useEffect(() => {
    if (countriesLoading || statesLoading || citiesLoading) return;
    const nextCountry = resolvedCountry?.name || String(value.country || "").trim();
    const nextState = resolvedState?.name || String(value.state || "").trim();
    const nextCity =
      resolveNamedString(
        [...cities, ...localities],
        value.city
      ) || String(value.city || "").trim();
    const key = `${nextCountry}|${nextState}|${nextCity}`;
    if (key === lastCanonicalRef.current) return;
    if (
      nextCountry === String(value.country || "").trim() &&
      nextState === String(value.state || "").trim() &&
      nextCity === String(value.city || "").trim()
    ) {
      lastCanonicalRef.current = key;
      return;
    }
    lastCanonicalRef.current = key;
    onChangeRef.current({
      ...value,
      country: nextCountry,
      state: nextState,
      city: nextCity,
    });
  }, [
    countriesLoading,
    statesLoading,
    citiesLoading,
    resolvedCountry,
    resolvedState,
    cities,
    localities,
    value,
  ]);

  useEffect(() => {
    if (!countryIso) {
      setStates([]);
      setStatesLoading(false);
      return undefined;
    }
    let cancelled = false;
    setStatesLoading(true);
    (async () => {
      try {
        const response = await api.get("/locations/states", {
          params: { country: countryIso },
        });
        if (!cancelled) setStates(response.data?.states || []);
      } catch {
        if (!cancelled) setStates([]);
      } finally {
        if (!cancelled) setStatesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [countryIso]);

  useEffect(() => {
    if (!countryIso || !stateIso) {
      setCities([]);
      setCitiesLoading(false);
      return undefined;
    }
    let cancelled = false;
    setCitiesLoading(true);
    (async () => {
      try {
        const response = await api.get("/locations/cities", {
          params: { country: countryIso, state: stateIso },
        });
        if (!cancelled) setCities(response.data?.cities || []);
      } catch {
        if (!cancelled) setCities([]);
      } finally {
        if (!cancelled) setCitiesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [countryIso, stateIso]);

  useEffect(() => {
    const postal = String(value.zipCode || "").trim().toUpperCase();
    if (!postalEditedRef.current || !readyPostal(postal)) return undefined;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLookingUp(true);
      setLookupError("");
      try {
        const response = await api.get(
          `/locations/postal/${encodeURIComponent(postal)}`,
          {
            params: countryIso ? { country: countryIso } : undefined,
            signal: controller.signal,
          }
        );
        const location = response.data?.location;
        if (!location) return;
        setLocalities(location.localities || []);
        onChangeRef.current({
          zipCode: location.zipCode || postal,
          country: location.country || value.country,
          state: location.state || "",
          city: location.city || "",
        });
      } catch (error) {
        if (error?.code === "ERR_CANCELED" || error?.name === "CanceledError") return;
        setLocalities([]);
        setLookupError(
          error?.response?.data?.message || "No address found for this postal code."
        );
      } finally {
        if (!controller.signal.aborted) {
          setLookingUp(false);
        }
      }
    }, 500);
    return () => {
      clearTimeout(timer);
      controller.abort();
      setLookingUp(false);
    };
  }, [value.zipCode, countryIso]);

  const countryOptions = useMemo(() => {
    const names = countries.map((item) => item.name);
    const current = resolvedCountry?.name || value.country;
    if (current && !names.includes(current)) {
      return [current, ...names];
    }
    return names;
  }, [countries, resolvedCountry, value.country]);

  const stateOptions = useMemo(() => {
    const names = states.map((item) => item.name);
    const current = resolvedState?.name || value.state;
    if (current && !names.includes(current)) return [current, ...names];
    return names;
  }, [states, resolvedState, value.state]);

  const cityOptions = useMemo(() => {
    const names = [...cities];
    for (const name of localities) {
      if (name && !names.includes(name)) names.unshift(name);
    }
    const canonicalCity =
      resolveNamedString(names, value.city) || value.city;
    if (canonicalCity && !names.includes(canonicalCity)) {
      names.unshift(canonicalCity);
    }
    return names;
  }, [cities, localities, value.city]);

  const setCountry = (country) => {
    setLocalities([]);
    setLookupError("");
    lastCanonicalRef.current = "";
    onChange({ ...value, country, state: "", city: "", zipCode: "" });
  };

  const setState = (state) => {
    setLocalities([]);
    setLookupError("");
    lastCanonicalRef.current = "";
    onChange({ ...value, state, city: "" });
  };

  const setZip = (raw) => {
    postalEditedRef.current = true;
    const zipCode = String(raw || "")
      .toUpperCase()
      .replace(/[^A-Z0-9 -]/g, "")
      .slice(0, 12);
    setLookupError("");
    onChange({ ...value, zipCode });
  };

  const stateIsText = Boolean(value.country) && !statesLoading && states.length === 0;

  const selectCountry = resolvedCountry?.name || value.country || "";
  const selectState = resolvedState?.name || value.state || "";
  const selectCity =
    resolveNamedString(cityOptions, value.city) || value.city || "";

  return (
    <div className="space-y-4">
      <div>
        <label className={labelClass} htmlFor="location-country">
          Country
        </label>
        <select
          id="location-country"
          value={selectCountry}
          onChange={(event) => setCountry(event.target.value)}
          disabled={countriesLoading}
          className={inputClass}
        >
          <option value="">
            {countriesLoading ? "Loading countries…" : "Select country"}
          </option>
          {countryOptions.map((country) => (
            <option key={country} value={country}>
              {country}
            </option>
          ))}
        </select>
      </div>

      {showAddress ? (
        <div>
          <label className={labelClass} htmlFor="location-address">
            Full address
          </label>
          <textarea
            id="location-address"
            rows={2}
            maxLength={300}
            autoComplete="street-address"
            value={value.address || ""}
            onChange={(event) =>
              onChange({ ...value, address: event.target.value.slice(0, 300) })
            }
            placeholder="House / flat, street, landmark"
            className={`${inputClass} resize-y min-h-[72px]`}
          />
          <p className="mt-1 text-[11px] text-fo-subtle text-right">
            {(value.address || "").length}/300
          </p>
        </div>
      ) : null}

      {showPostal ? (
        <div>
          <label className={labelClass} htmlFor="location-postal">
            Postal code
          </label>
          <input
            id="location-postal"
            autoComplete="postal-code"
            value={value.zipCode || ""}
            onChange={(event) => setZip(event.target.value)}
            placeholder="Postal or ZIP code"
            className={inputClass}
          />
          <p className="mt-1 text-[11px] text-fo-subtle">
            {lookingUp
              ? "Looking up this postal code…"
              : "Enter a postal code to fill country, state, and city."}
          </p>
          {lookupError ? (
            <p className="mt-1 text-[11px] text-red-400">{lookupError}</p>
          ) : null}
        </div>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={labelClass} htmlFor="location-state">
            State
          </label>
          {stateIsText ? (
            <input
              id="location-state"
              value={value.state}
              onChange={(event) => setState(event.target.value)}
              placeholder="State / province"
              className={inputClass}
            />
          ) : (
            <select
              id="location-state"
              value={selectState}
              onChange={(event) => setState(event.target.value)}
              disabled={!selectCountry || statesLoading}
              className={inputClass}
            >
              <option value="">
                {statesLoading
                  ? "Loading states…"
                  : selectCountry
                    ? "Select state"
                    : "Select a country first"}
              </option>
              {stateOptions.map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </select>
          )}
        </div>
        <div>
          <label className={labelClass} htmlFor="location-city">
            City
          </label>
          {cityOptions.length > 0 ? (
            <select
              id="location-city"
              value={selectCity}
              onChange={(event) => {
                lastCanonicalRef.current = "";
                onChange({ ...value, city: event.target.value });
              }}
              disabled={!selectState || citiesLoading}
              className={inputClass}
            >
              <option value="">
                {citiesLoading ? "Loading cities…" : "Select city"}
              </option>
              {cityOptions.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          ) : (
            <input
              id="location-city"
              value={value.city}
              onChange={(event) => {
                lastCanonicalRef.current = "";
                onChange({ ...value, city: event.target.value });
              }}
              placeholder={selectState ? "City" : "Select a state first"}
              disabled={!selectState && !stateIsText}
              className={inputClass}
            />
          )}
        </div>
      </div>
    </div>
  );
}
