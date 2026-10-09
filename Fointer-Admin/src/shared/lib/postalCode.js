export const postalCodeError = (value) => {
  const code = String(value || "").trim();
  if (!code) return "";
  if (!/^[A-Za-z0-9][A-Za-z0-9 -]{1,11}$/.test(code)) {
    return "Enter a valid postal code.";
  }
  return "";
};
