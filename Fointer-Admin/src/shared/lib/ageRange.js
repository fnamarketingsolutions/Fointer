export const AGE_RANGES = [
  "13–17 years",
  "18–24 years",
  "25–34 years",
  "35–44 years",
  "45–54 years",
  "55–64 years",
  "65+ years",
];

export const ageRangeError = (value) =>
  AGE_RANGES.includes(String(value || "").trim())
    ? ""
    : "Select an age range.";
