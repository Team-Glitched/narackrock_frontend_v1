import test from "node:test";
import assert from "node:assert/strict";
import { devicePortrait, subscribeDeviceOrientation } from "./device-orientation.ts";

function phone(type: string | undefined = "portrait-primary") {
  const events = new EventTarget();
  const pointer = Object.assign(new EventTarget(), { matches: true });
  const orientation = Object.assign(new EventTarget(), { type: type as string | undefined });
  const screen = { orientation, width: 390, height: 844 };
  const target = Object.assign(events, {
    screen,
    innerWidth: 390,
    innerHeight: 844,
    matchMedia: () => pointer,
    localStorage: { getItem: () => "landscape" },
  });
  return { target: target as unknown as Window, screen, pointer, orientation };
}

test("phones follow both physical orientations and ignore the old layout preference", () => {
  const { target, orientation } = phone();
  for (const type of [
    "portrait-primary",
    "portrait-secondary",
    "landscape-primary",
    "landscape-secondary",
  ]) {
    orientation.type = type;
    assert.equal(devicePortrait(target), type.startsWith("portrait"));
  }
});

test("opening the keyboard never turns a portrait phone into landscape", () => {
  const { target, orientation, screen } = phone();
  Object.assign(target, { innerHeight: 260 });
  assert.equal(devicePortrait(target), true);
  // No ScreenOrientation API: screen dimensions still exclude the keyboard.
  orientation.type = undefined;
  assert.equal(devicePortrait(target), true);
  Object.assign(screen, { width: 844, height: 390 });
  assert.equal(devicePortrait(target), false);
});

test("older iOS uses its orientation angle, including reverse landscape", () => {
  const { target, orientation } = phone();
  orientation.type = undefined;
  for (const angle of [0, 180, 90, -90]) {
    Object.assign(target, { orientation: angle });
    assert.equal(devicePortrait(target), Math.abs(angle) !== 90);
  }
});

test("desktop and unknown screen sizes default to portrait", () => {
  const { target, pointer, screen } = phone("landscape-primary");
  pointer.matches = false;
  assert.equal(devicePortrait(target), true);
  pointer.matches = true;
  Object.assign(screen, { orientation: undefined, width: 0, height: 0 });
  assert.equal(devicePortrait(target), true);
});

test("rotation subscriptions update on rotation/resize and fully detach on page exit", () => {
  const { target, orientation, pointer } = phone();
  const seen: boolean[] = [];
  const unsubscribe = subscribeDeviceOrientation(() => seen.push(devicePortrait(target)), target);
  orientation.type = "landscape-primary";
  orientation.dispatchEvent(new Event("change"));
  orientation.type = "portrait-primary";
  target.dispatchEvent(new Event("orientationchange"));
  target.dispatchEvent(new Event("resize"));
  pointer.dispatchEvent(new Event("change"));
  assert.deepEqual(seen, [false, true, true, true]);
  unsubscribe();
  orientation.dispatchEvent(new Event("change"));
  target.dispatchEvent(new Event("orientationchange"));
  target.dispatchEvent(new Event("resize"));
  pointer.dispatchEvent(new Event("change"));
  assert.equal(seen.length, 4);
});
