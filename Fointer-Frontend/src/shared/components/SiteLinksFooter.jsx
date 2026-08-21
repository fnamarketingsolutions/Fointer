import { Link } from "react-router-dom";
import {
  LuFacebook as Facebook,
  LuInstagram as Instagram,
  LuLinkedin as Linkedin,
  LuMail as Mail,
  LuMapPin as MapPin,
  LuPhone as Phone,
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

function SocialNav() {
  return (
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
  );
}

function FooterLinks({ onNavigate, activeSegment }) {
  return (
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
  );
}

function ContactDetails() {
  const { contactEmail, contactPhone, contactAddress } = useSiteContact();
  const telHref = contactPhone
    ? `tel:${contactPhone.replace(/[^\d+]/g, "")}`
    : "";
  const rows = [
    contactPhone
      ? {
          key: "phone",
          icon: Phone,
          label: "Phone",
          value: contactPhone,
          href: telHref,
        }
      : null,
    contactAddress
      ? {
          key: "location",
          icon: MapPin,
          label: "Location",
          value: contactAddress,
        }
      : null,
    contactEmail
      ? {
          key: "email",
          icon: Mail,
          label: "Email",
          value: contactEmail,
          href: `mailto:${contactEmail}`,
        }
      : null,
  ].filter(Boolean);

  if (!rows.length) return null;

  return (
    <div className="w-full sm:w-auto sm:min-w-[240px] sm:max-w-[280px]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#A69B8D] mb-3">
        Contact
      </p>
      <ul className="space-y-3">
        {rows.map((row) => {
          const Icon = row.icon;
          const ValueTag = row.href ? "a" : "span";
          const valueProps = row.href ? { href: row.href } : {};
          return (
            <li key={row.key} className="flex items-start gap-3">
              <span className="inline-flex w-7 h-7 shrink-0 items-center justify-center rounded-md border border-[#2A241E] text-[#D4AF37]">
                <Icon size={13} />
              </span>
              <div className="min-w-0 pt-0.5">
                <p className="text-[10px] uppercase tracking-[0.14em] text-[#5C5348] leading-none mb-1">
                  {row.label}
                </p>
                <ValueTag
                  {...valueProps}
                  className="block text-[12px] leading-snug text-[#C8BFB3] hover:text-[#D4AF37] transition-colors break-words"
                >
                  {row.value}
                </ValueTag>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Reddit-style muted wrap links for the right rail, or a two-column site footer. */
export default function SiteLinksFooter({
  onNavigate,
  activeSegment,
  className = "",
  variant = "rail",
}) {
  if (variant === "site") {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-8">
          <div className="space-y-3 min-w-0 flex-1">
            <FooterLinks onNavigate={onNavigate} activeSegment={activeSegment} />
            <SocialNav />
          </div>
          <ContactDetails />
        </div>
        <p className="text-[10px] text-[#5C5348]">
          Fointer © {new Date().getFullYear()}. All rights reserved.
        </p>
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <FooterLinks onNavigate={onNavigate} activeSegment={activeSegment} />
      <SocialNav />
      <p className="text-[10px] text-[#5C5348]">
        Fointer © {new Date().getFullYear()}. All rights reserved.
      </p>
    </div>
  );
}
