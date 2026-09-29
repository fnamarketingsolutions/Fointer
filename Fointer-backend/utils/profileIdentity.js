const GENDERS = new Set(["Male", "Female", "Other"]);
const MIN_AGE = 13;

export const parseGender = (value) => {
  const gender = String(value || "").trim();
  if (!GENDERS.has(gender)) return "";
  return gender;
};

export const parseDateOfBirth = (value) => {
  const raw = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return { error: "Enter a valid date of birth." };
  const [year, month, day] = raw.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return { error: "Enter a valid date of birth." };
  }
  const today = new Date();
  const todayUtc = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate()
  );
  if (date.getTime() > todayUtc) {
    return { error: "Date of birth cannot be in the future." };
  }
  let age = today.getUTCFullYear() - year;
  const monthDelta = today.getUTCMonth() - (month - 1);
  if (monthDelta < 0 || (monthDelta === 0 && today.getUTCDate() < day)) age -= 1;
  if (age < MIN_AGE) {
    return { error: `You must be at least ${MIN_AGE} years old.` };
  }
  if (year < 1900) return { error: "Enter a valid date of birth." };
  return { date, year };
};

export const formatDateOfBirth = (value) => {
  if (!value) return "";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};
