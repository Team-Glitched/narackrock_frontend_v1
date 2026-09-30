import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const profileScreen = readFileSync(
  new URL("../profile/profile-screens.tsx", import.meta.url),
  "utf8",
);
const page = readFileSync(new URL("../../app/page.tsx", import.meta.url), "utf8");

test("collects a first-time user's profile in name, instrument, description order", () => {
  assert.match(profileScreen, /당신의 이름은 무엇인가요\?/);
  assert.match(profileScreen, /당신의 주 악기는 무엇인가요\?/);
  assert.match(profileScreen, /당신을 설명해주세요/);
  assert.match(profileScreen, /setStep\(1\)/);
  assert.match(profileScreen, /setStep\(2\)/);
  assert.match(profileScreen, /updateProfile\(\{ nickname: nickname\.trim\(\), primaryInstrument: instrument\.trim\(\), explanation: explanation\.trim\(\) \}\)/);
});

test("shows first-login onboarding without the regular header and footer", () => {
  assert.match(page, /const onboardingView = Boolean\(pendingProfileSetup\)/);
  assert.match(page, /const noHeader = authView \|\| onboardingView/);
  assert.match(page, /!authView && !onboardingView && <Footer/);
});
