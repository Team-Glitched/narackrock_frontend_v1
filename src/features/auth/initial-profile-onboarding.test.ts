import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const profileScreen = readFileSync(
  new URL("../profile/profile-screens.tsx", import.meta.url),
  "utf8",
);

import { pageRoutes } from "../navigation/route-config.ts";

test("collects a first-time user's profile in name, instrument, description order", () => {
  assert.match(profileScreen, /당신의 이름은 무엇인가요?/);
  assert.match(profileScreen, /당신의 주 악기는 무엇인가요?/);
  assert.match(profileScreen, /당신을 설명해주세요/);
  assert.match(profileScreen, /setStep\(1\)/);
  assert.match(profileScreen, /setStep\(2\)/);
  assert.match(
    profileScreen,
    /updateProfile\(\{\s*nickname: nickname.trim\(\),\s*primaryInstrument: instrument.trim\(\),\s*explanation: explanation.trim\(\),?\s*\}\)/,
  );
});

test("shows first-login onboarding without the regular header and footer", () => {
  const route = pageRoutes.find((page) => page.id === "onboarding")!;
  assert.equal("hideHeader" in route && route.hideHeader, true);
  assert.equal("hideFooter" in route && route.hideFooter, true);
});

test("returns to the name step when the nickname is actually duplicated", () => {
  assert.match(
    profileScreen,
    /cause instanceof ApiError &&\s*cause.errorCode === "DUPLICATE_NICKNAME"/,
  );
  assert.match(profileScreen, /setStep\(0\)/);
});
