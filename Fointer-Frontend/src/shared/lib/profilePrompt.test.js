import assert from "node:assert/strict";
import test from "node:test";
import { isProfileIdentityComplete, isProfilePage } from "./profilePrompt.js";

test("a profile is complete only when gender, age range, and postal code are saved", () => {
  assert.equal(isProfileIdentityComplete(null), false);
  assert.equal(isProfileIdentityComplete({ gender: "Female", ageRange: "25–34 years" }), false);
  assert.equal(
    isProfileIdentityComplete({
      gender: "Female",
      ageRange: "25–34 years",
      zipCode: "110001",
    }),
    true
  );
  assert.equal(
    isProfileIdentityComplete({
      gender: "  ",
      ageRange: "25–34 years",
      zipCode: "110001",
    }),
    false
  );
});

test("the prompt stays off the profile page", () => {
  assert.equal(isProfilePage("/profile"), true);
  assert.equal(isProfilePage("/feed"), false);
  assert.equal(isProfilePage("/users/ada"), false);
});
