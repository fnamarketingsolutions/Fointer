export const PROFILE_REMINDER_INTERVAL_MS = 6 * 24 * 60 * 60 * 1000;

export const isProfileIdentityComplete = (user) =>
  Boolean(
    String(user?.gender || "").trim()
    && String(user?.ageRange || "").trim()
    && String(user?.zipCode || "").trim()
  );

/** Verified members with an unfinished profile. Completed profiles are excluded. */
export const isProfileReminderRecipient = (user) => {
  if (!user?.email) return false;
  if (String(user.role || "user").toLowerCase().trim() !== "user") return false;
  if (!user.isEmailVerified) return false;
  if (user.status === "suspended" || user.status === "banned") return false;
  return !isProfileIdentityComplete(user);
};

/**
 * The first reminder is due as soon as the account is eligible.
 * Later reminders wait six days after the last one that was sent.
 */
export const profileReminderDue = (user, now = Date.now()) => {
  if (!isProfileReminderRecipient(user)) return false;
  const sentAt = user.profileReminderSentAt ? new Date(user.profileReminderSentAt).getTime() : null;
  if (!Number.isFinite(sentAt)) return true;
  return now - sentAt >= PROFILE_REMINDER_INTERVAL_MS;
};
