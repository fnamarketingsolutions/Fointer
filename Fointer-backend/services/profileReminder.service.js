import User from "../models/user.js";
import { getPublicFrontendUrl } from "../utils/publicAppUrls.js";
import {
  PROFILE_REMINDER_INTERVAL_MS,
  profileReminderDue,
} from "../utils/profileReminder.js";
import { sendProfileReminderEmail } from "../utils/sendVerificationEmail.js";

const SWEEP_INTERVAL_MS = 60 * 60 * 1000;
const SWEEP_BATCH = 50;
let timer = null;
let starter = null;

const profileUrl = () => `${getPublicFrontendUrl()}/profile`;

const reminderFilter = (now) => ({
  role: "user",
  isEmailVerified: true,
  status: { $nin: ["suspended", "banned"] },
  email: { $nin: [null, ""] },
  $and: [
    {
      $or: [
        { gender: { $in: [null, ""] } },
        { ageRange: { $in: [null, ""] } },
        { zipCode: { $in: [null, ""] } },
      ],
    },
    {
      $or: [
        { profileReminderSentAt: null },
        { profileReminderSentAt: { $exists: false } },
        { profileReminderSentAt: { $lte: new Date(now - PROFILE_REMINDER_INTERVAL_MS) } },
      ],
    },
  ],
});

/** Sends one reminder when it is due. A failed send leaves the account eligible to retry. */
export const sendProfileReminderIfDue = async (user, now = Date.now()) => {
  if (!user?._id || !profileReminderDue(user, now)) return false;
  const previous = user.profileReminderSentAt || null;
  const claimed = await User.updateOne(
    {
      _id: user._id,
      ...reminderFilter(now),
    },
    { $set: { profileReminderSentAt: new Date(now) } }
  );
  if (claimed.modifiedCount !== 1) return false;
  try {
    await sendProfileReminderEmail({
      to: user.email,
      name: user.name,
      actionUrl: profileUrl(),
    });
    return true;
  } catch (error) {
    await User.updateOne(
      { _id: user._id },
      { $set: { profileReminderSentAt: previous } }
    );
    throw error;
  }
};

export const sendDueProfileReminders = async (now = Date.now()) => {
  const users = await User.find(reminderFilter(now))
    .sort({ profileReminderSentAt: 1, createdAt: 1 })
    .limit(SWEEP_BATCH);
  let sent = 0;
  for (const user of users) {
    try {
      if (await sendProfileReminderIfDue(user, now)) sent += 1;
    } catch (error) {
      console.error("[profile-reminder]", error?.message || error);
    }
  }
  return sent;
};

/** Checks hourly. Each account still receives at most one reminder every six days. */
export const startProfileReminderSchedule = () => {
  if (timer) return;
  const run = () => {
    sendDueProfileReminders().catch((error) => {
      console.error("[profile-reminder] sweep:", error?.message || error);
    });
  };
  starter = setTimeout(run, 30_000);
  timer = setInterval(run, SWEEP_INTERVAL_MS);
  starter.unref?.();
  timer.unref?.();
};
