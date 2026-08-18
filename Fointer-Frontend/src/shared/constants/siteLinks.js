/** Static / legal pages — public URLs (not under /dashboard). */
export const SITE_LINKS = [
  { label: "About Us", to: "/about", segment: "about" },
  { label: "Contact Us", to: "/contact-us", segment: "contact-us" },
  { label: "How To Use", to: "/how-to-use", segment: "how-to-use" },
  {
    label: "Code Of Conduct",
    to: "/code-of-conduct",
    segment: "code-of-conduct",
  },
  {
    label: "Network Use Cases",
    to: "/network-use-cases",
    segment: "network-use-cases",
  },
  {
    label: "Privacy Policy",
    to: "/privacy-policy",
    segment: "privacy-policy",
  },
  {
    label: "Terms and Conditions",
    to: "/terms-and-conditions",
    segment: "terms-and-conditions",
  },
  {
    label: "User Agreement",
    to: "/user-agreement",
    segment: "user-agreement",
  },
  {
    label: "Content Policy",
    to: "/content-policy",
    segment: "content-policy",
  },
  {
    label: "Cookie Notice",
    to: "/cookie-policy",
    segment: "cookie-policy",
  },
];

export const SITE_SEGMENTS = new Set(SITE_LINKS.map((l) => l.segment));
