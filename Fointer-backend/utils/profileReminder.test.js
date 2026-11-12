import assert from "node:assert/strict";
import test from "node:test";
import {
  PROFILE_REMINDER_INTERVAL_MS,
  isProfileReminderRecipient,
  profileReminderDue,
} from "./profileReminder.js";

const member = (overrides = {}) => ({
  email: "ada@example.com",
  role: "user",
  isEmailVerified: true,
  status: "active",
  gender: "",
  ageRange: "",
  zipCode: "",
  ...overrides,
});

test("a finished profile is not reminded", () => {
  const user = member({
    gender: "Female",
    ageRange: "25–34 years",
    zipCode: "110001",
  });
  assert.equal(isProfileReminderRecipient(user), false);
  assert.equal(profileReminderDue(user), false);
});

test("the first reminder is due the day a verified account is created", () => {
  assert.equal(profileReminderDue(member()), true);
  assert.equal(profileReminderDue(member({ isEmailVerified: false })), false);
  assert.equal(profileReminderDue(member({ status: "banned" })), false);
  assert.equal(profileReminderDue(member({ role: "admin" })), false);
});

test("the next reminder waits six days after the last one", () => {
  const now = Date.parse("2026-11-17T12:00:00.000Z");
  const sentAt = new Date(now - PROFILE_REMINDER_INTERVAL_MS + 60_000);
  assert.equal(profileReminderDue(member({ profileReminderSentAt: sentAt }), now), false);
  const dueAt = new Date(now - PROFILE_REMINDER_INTERVAL_MS);
  assert.equal(profileReminderDue(member({ profileReminderSentAt: dueAt }), now), true);
});
