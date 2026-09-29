import { useEffect, useMemo, useRef, useState } from "react";
import api from "../services/http/client";

const readyPostal = (value) => {
  const compact = String(value || "").replace(/[\s-]/g, "");
  return /^[A-Z0-9]{4,12}$/.test(compact);
};

export default function LocationFields({
  value,
  onChange,
  inputClass,
  labelClass,
  onBusyChange,
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
  const onBusyRef = useRef(onBusyChange);
  const postalEditedRef = useRef(false);

  useEffect(() => {
    onChangeRef.current = onChange;
    onBusyRef.current = onBusyChange;
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

  const countryIso =
    countries.find((item) => item.name === value.country)?.isoCode || "";
  const stateIso = states.find((item) => item.name === value.state)?.isoCode || "";

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
      onBusyRef.current?.(true);
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
          onBusyRef.current?.(false);
        }
      }
    }, 500);
    return () => {
      clearTimeout(timer);
      controller.abort();
      setLookingUp(false);
      onBusyRef.current?.(false);
    };
  }, [value.zipCode, countryIso]);

  const countryOptions = useMemo(() => {
    const names = countries.map((item) => item.name);
    if (value.country && !names.includes(value.country)) {
      return [value.country, ...names];
    }
    return names;
  }, [countries, value.country]);

  const stateOptions = useMemo(() => {
    const names = states.map((item) => item.name);
    if (value.state && !names.includes(value.state)) return [value.state, ...names];
    return names;
  }, [states, value.state]);

  const cityOptions = useMemo(() => {
    const names = [...cities];
    for (const name of localities) {
      if (name && !names.includes(name)) names.unshift(name);
    }
    if (value.city && !names.includes(value.city)) names.unshift(value.city);
    return names;
  }, [cities, localities, value.city]);

  const setCountry = (country) => {
    setLocalities([]);
    setLookupError("");
    onChange({ ...value, country, state: "", city: "", zipCode: "" });
  };

  const setState = (state) => {
    setLocalities([]);
    setLookupError("");
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

  return (
    <div className="space-y-4">
      <div>
        <label className={labelClass} htmlFor="location-country">
          Country
        </label>
        <select
          id="location-country"
          value={value.country}
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

      <div>
        <label className={labelClass} htmlFor="location-postal">
          Postal code
        </label>
        <input
          id="location-postal"
          autoComplete="postal-code"
          value={value.zipCode}
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
              value={value.state}
              onChange={(event) => setState(event.target.value)}
              disabled={!value.country || statesLoading}
              className={inputClass}
            >
              <option value="">
                {statesLoading
                  ? "Loading states…"
                  : value.country
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
              value={value.city}
              onChange={(event) => onChange({ ...value, city: event.target.value })}
              disabled={!value.state || citiesLoading}
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
              onChange={(event) => onChange({ ...value, city: event.target.value })}
              placeholder={value.state ? "City" : "Select a state first"}
              disabled={!value.state && !stateIsText}
              className={inputClass}
            />
          )}
        </div>
      </div>
    </div>
  );
}
