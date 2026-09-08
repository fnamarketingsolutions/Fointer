export const LISTING_CATEGORIES = [
  { value: "electronics", label: "Electronics" },
  { value: "vehicles", label: "Vehicles" },
  { value: "furniture", label: "Furniture" },
  { value: "clothing", label: "Clothing" },
  { value: "sports", label: "Sports & Outdoors" },
  { value: "books", label: "Books & Media" },
  { value: "toys", label: "Toys & Games" },
  { value: "home_garden", label: "Home & Garden" },
  { value: "health_beauty", label: "Health & Beauty" },
  { value: "services", label: "Services" },
  { value: "other", label: "Other" },
];

export const LISTING_CONDITIONS = [
  { value: "new", label: "New" },
  { value: "like_new", label: "Like New" },
  { value: "good", label: "Good" },
  { value: "fair", label: "Fair" },
  { value: "poor", label: "Poor" },
];

export const LISTING_STATUSES = [
  { value: "active", label: "Active" },
  { value: "sold", label: "Sold" },
  { value: "draft", label: "Draft" },
  { value: "removed", label: "Removed" },
];

export const categoryLabel = (value) =>
  LISTING_CATEGORIES.find((c) => c.value === value)?.label || value;

export const conditionLabel = (value) =>
  LISTING_CONDITIONS.find((c) => c.value === value)?.label || value;

export const statusLabel = (value) =>
  LISTING_STATUSES.find((s) => s.value === value)?.label || value;

export const formatPrice = (price, currency = "USD") => {
  const amount = Number(price);
  if (!Number.isFinite(amount)) return "";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
    }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
};

export const formatLocation = (listing = {}) => {
  return [listing.city, listing.state, listing.country]
    .filter(Boolean)
    .join(", ");
};
