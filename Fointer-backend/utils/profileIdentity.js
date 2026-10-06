const GENDERS = new Set(["Male", "Female", "Other"]);
const AGE_RANGES = new Set([
  "13–17 years",
  "18–24 years",
  "25–34 years",
  "35–44 years",
  "45–54 years",
  "55–64 years",
  "65+ years",
]);

export const parseGender = (value) => {
  const gender = String(value || "").trim();
  if (!GENDERS.has(gender)) return "";
  return gender;
};

export const parseAgeRange = (value) => {
  const ageRange = String(value || "").trim();
  return AGE_RANGES.has(ageRange) ? ageRange : "";
};
