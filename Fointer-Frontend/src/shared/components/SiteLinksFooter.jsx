import { Link } from "react-router-dom";
import {
  LuFacebook as Facebook,
  LuInstagram as Instagram,
  LuLinkedin as Linkedin,
  LuYoutube as Youtube,
} from "react-icons/lu";
import { SITE_LINKS, SOCIAL_LINKS } from "../constants/siteLinks";
import { useSiteContact } from "../../context/SiteContactContext";

function XIcon({ size = 14 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.74l7.727-8.835L1.254 2.25H8.08l4.253 5.622L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

const SOCIAL_ICONS = {
  instagram: Instagram,
  facebook: Facebook,
  linkedin: Linkedin,
  x: XIcon,
  youtube: Youtube,
};

/** Reddit-style muted wrap links for the right rail. */
export default function SiteLinksFooter({
  onNavigate,
  activeSegment,
  className = "",
}) {
  const { contactEmail, contactPhone } = useSiteContact();
  const telHref = contactPhone
    ? `tel:${contactPhone.replace(/[^\d+]/g, "")}`
    : "";

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

      <nav className="flex flex-wrap items-center gap-2" aria-label="Social media">
        {SOCIAL_LINKS.map((item) => {
          const Icon = SOCIAL_ICONS[item.id];
          const ready = Boolean(item.href);
          const iconClass =
            "inline-flex items-center justify-center w-8 h-8 rounded-lg border border-[#2A241E] text-[#8C8070] transition-colors";

          if (!ready) {
            return (
              <span
                key={item.id}
                className={`${iconClass} cursor-default`}
                title={`${item.label} — coming soon`}
                aria-label={`${item.label} (coming soon)`}
              >
                {Icon ? <Icon size={14} /> : null}
              </span>
            );
          }

          return (
            <a
              key={item.id}
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              className={`${iconClass} hover:text-[#D4AF37] hover:border-[#D4AF37]/40`}
              title={item.label}
              aria-label={item.label}
            >
              {Icon ? <Icon size={14} /> : null}
            </a>
          );
        })}
      </nav>

      {(contactEmail || contactPhone) ? (
        <p className="text-[11px] text-[#8C8070] space-x-2">
          {contactEmail ? (
            <a
              href={`mailto:${contactEmail}`}
              className="hover:text-[#D4AF37] transition-colors"
            >
              {contactEmail}
            </a>
          ) : null}
          {contactEmail && contactPhone ? <span>·</span> : null}
          {contactPhone ? (
            <a href={telHref} className="hover:text-[#D4AF37] transition-colors">
              {contactPhone}
            </a>
          ) : null}
        </p>
      ) : null}

      <p className="text-[10px] text-[#5C5348]">
        Fointer © {new Date().getFullYear()}. All rights reserved.
      </p>
    </div>
  );
}
