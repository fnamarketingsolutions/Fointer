import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fetchPublicSiteContact } from "../shared/services/siteContact";

const EMPTY = { contactEmail: "", contactPhone: "", contactAddress: "" };

const SiteContactContext = createContext({
  ...EMPTY,
  refresh: () => {},
});

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

  useEffect(() => {
    refresh();
  }, [refresh]);

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

const EMAIL_CLASS = "text-[#F8A201] font-mono hover:underline";

export function SiteEmail({ className = EMAIL_CLASS }) {
  const { contactEmail } = useSiteContact();
  if (!contactEmail) {
    return (
      <Link to="/contact-us" className={className}>
        Contact Us
      </Link>
    );
  }
  return (
    <a href={`mailto:${contactEmail}`} className={className}>
      {contactEmail}
    </a>
  );
}

export function SiteEmailPlain({ className = "text-xs text-gray-400 font-mono" }) {
  const { contactEmail } = useSiteContact();
  if (!contactEmail) {
    return (
      <span className={className}>
        Email Inquiry: see{" "}
        <Link to="/contact-us" className="text-[#F8A201] hover:underline">
          Contact Us
        </Link>
      </span>
    );
  }
  return (
    <span className={className}>Email Inquiry: {contactEmail}</span>
  );
}

export function SitePhone({ className = "" }) {
  const { contactPhone } = useSiteContact();
  if (!contactPhone) return null;
  const href = `tel:${contactPhone.replace(/[^\d+]/g, "")}`;
  return (
    <a href={href} className={className}>
      {contactPhone}
    </a>
  );
}
