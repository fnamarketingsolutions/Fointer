import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { fetchPublicSiteContact } from "../shared/services/siteContact";

const EMPTY = { contactEmail: "", contactPhone: "", contactAddress: "" };

const SiteContactContext = createContext({
  ...EMPTY,
  refresh: () => {},
});

/**
 * Holds public contact after an explicit refresh (e.g. System Settings save).
 * No eager fetch on mount — Admin does not render contact UI.
 */
export function SiteContactProvider({ children }) {
  const [contact, setContact] = useState(EMPTY);

  const refresh = useCallback(async () => {
    try {
      const data = await fetchPublicSiteContact();
      setContact({
        contactEmail: data?.contact?.contactEmail || "",
        contactPhone: data?.contact?.contactPhone || "",
        contactAddress: data?.contact?.contactAddress || "",
      });
    } catch {
      setContact(EMPTY);
    }
  }, []);

  const value = useMemo(
    () => ({ ...contact, refresh }),
    [contact, refresh]
  );

  return (
    <SiteContactContext.Provider value={value}>
      {children}
    </SiteContactContext.Provider>
  );
}

export function useSiteContact() {
  return useContext(SiteContactContext);
}
