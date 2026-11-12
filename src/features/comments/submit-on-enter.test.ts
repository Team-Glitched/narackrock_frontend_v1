import assert from "node:assert/strict";
import test from "node:test";
import { shouldSubmitOnEnter } from "./submit-on-enter.ts";

const enter = { key: "Enter", shiftKey: false, isComposing: false, keyCode: 13 };

test("plain Enter submits the comment", () => {
  assert.equal(shouldSubmitOnEnter(enter), true);
});

test("Shift+Enter keeps inserting a line break", () => {
  assert.equal(shouldSubmitOnEnter({ ...enter, shiftKey: true }), false);
});

test("Enter that finishes Korean IME composition does not submit", () => {
  assert.equal(shouldSubmitOnEnter({ ...enter, isComposing: true }), false);
  // Safari and some Android keyboards report composition only through keyCode 229.
  assert.equal(shouldSubmitOnEnter({ ...enter, keyCode: 229 }), false);
});

test("other keys never submit", () => {
  assert.equal(shouldSubmitOnEnter({ ...enter, key: "a", keyCode: 65 }), false);
});

test("touch keyboards keep Enter as a line break and send with the button", () => {
  assert.equal(shouldSubmitOnEnter(enter, true), false);
});
