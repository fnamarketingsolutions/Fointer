/** Gender, age range, and postal code are the required profile identity. */
export const isProfileIdentityComplete = (user) =>
  Boolean(
    String(user?.gender || "").trim()
    && String(user?.ageRange || "").trim()
    && String(user?.zipCode || "").trim()
  );

export const isProfilePage = (pathname) => pathname === "/profile";
