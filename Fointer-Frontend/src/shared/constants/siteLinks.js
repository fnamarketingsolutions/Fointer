/** Static / legal pages shown in the dashboard shell for every visitor. */
export const SITE_LINKS = [
  { label: "About Us", to: "/dashboard/about", segment: "about" },
  { label: "Contact Us", to: "/dashboard/contact-us", segment: "contact-us" },
  { label: "How To Use", to: "/dashboard/how-to-use", segment: "how-to-use" },
  {
    label: "Code Of Conduct",
    to: "/dashboard/code-of-conduct",
    segment: "code-of-conduct",
  },
  {
    label: "Network Use Cases",
    to: "/dashboard/network-use-cases",
    segment: "network-use-cases",
  },
  {
    label: "Privacy Policy",
    to: "/dashboard/privacy-policy",
    segment: "privacy-policy",
  },
  {
    label: "Terms and Conditions",
    to: "/dashboard/terms-and-conditions",
    segment: "terms-and-conditions",
  },
  {
    label: "User Agreement",
    to: "/dashboard/user-agreement",
    segment: "user-agreement",
  },
  {
    label: "Content Policy",
    to: "/dashboard/content-policy",
    segment: "content-policy",
  },
  {
    label: "Cookie Notice",
    to: "/dashboard/cookie-policy",
    segment: "cookie-policy",
  },
];

export const SITE_SEGMENTS = new Set(SITE_LINKS.map((l) => l.segment));
