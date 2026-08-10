import { Link } from "react-router-dom";
import { SITE_LINKS } from "../constants/siteLinks";

/** Reddit-style muted wrap links for the right rail. */
export default function SiteLinksFooter({
  onNavigate,
  activeSegment,
  className = "",
}) {
  return (
    <div className={`space-y-3 ${className}`}>
      <nav className="flex flex-wrap gap-x-3 gap-y-1.5">
        {SITE_LINKS.map((link) => {
          const active = activeSegment === link.segment;
          return (
            <Link
              key={link.to}
              to={link.to}
              onClick={onNavigate}
              className={`text-[11px] transition-colors ${
                active
                  ? "text-[#D4AF37]"
                  : "text-[#8C8070] hover:text-[#D4AF37]"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
      <p className="text-[10px] text-[#5C5348]">
        Fointer © {new Date().getFullYear()}. All rights reserved.
      </p>
    </div>
  );
}
