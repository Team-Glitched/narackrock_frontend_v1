import assert from "node:assert/strict";
import test from "node:test";

import { profileSetupRequired } from "./profile-setup-required.ts";

test("requires setup for a newly created account", () => {
  assert.equal(profileSetupRequired(true, null), true);
});

test("recovers an account created before onboarding was completed", () => {
  assert.equal(profileSetupRequired(false, { primaryInstrument: null, explanation: null }), true);
});

test("does not repeat onboarding for a completed profile", () => {
  assert.equal(profileSetupRequired(false, { primaryInstrument: "Piano", explanation: "Composer" }), false);
});
