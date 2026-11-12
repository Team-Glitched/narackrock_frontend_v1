import assert from "node:assert/strict";
import test from "node:test";
import { hasSignedInBefore, rememberSignedIn } from "./returning-user.ts";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
  };
}

test("treats a browser without a sign-in record as a first visit", () => {
  assert.equal(hasSignedInBefore(memoryStorage()), false);
  assert.equal(hasSignedInBefore(undefined), false);
});

test("remembers that this browser has signed in", () => {
  const storage = memoryStorage();
  rememberSignedIn(storage);
  assert.equal(hasSignedInBefore(storage), true);
});

test("falls back to a first visit when storage is unavailable", () => {
  const broken = {
    getItem: () => {
      throw new Error("blocked");
    },
    setItem: () => {
      throw new Error("blocked");
    },
  };
  assert.doesNotThrow(() => rememberSignedIn(broken));
  assert.equal(hasSignedInBefore(broken), false);
});
