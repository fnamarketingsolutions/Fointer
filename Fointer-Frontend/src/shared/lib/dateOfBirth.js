export const dateOfBirthError = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "Date of birth is required.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return "Enter a valid date of birth.";

  const [year, month, day] = raw.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return "Enter a valid date of birth.";
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (date > today) return "Date of birth cannot be in the future.";

  let age = today.getFullYear() - year;
  const monthDelta = today.getMonth() - (month - 1);
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < day)) age -= 1;
  if (age < 13) return "You must be at least 13 years old.";
  if (year < 1900) return "Enter a valid date of birth.";
  return "";
};
