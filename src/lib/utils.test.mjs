import assert from "node:assert/strict";
import test from "node:test";
import { cn } from "./utils.ts";

test("keeps an app text size alongside its foreground color", () => {
  assert.equal(cn("text-body font-medium", "text-app-fg"), "text-body font-medium text-app-fg");
});

test("replaces app text sizes without discarding the foreground color", () => {
  assert.equal(cn("text-label text-app-muted", "text-caption"), "text-app-muted text-caption");
});

test("lets variants override dimensions and descendant typography", () => {
  assert.equal(cn("size-[30px]", "size-5"), "size-5");
  assert.equal(cn("[&>strong]:text-label", "[&>strong]:text-body [&>strong]:text-app-fg"), "[&>strong]:text-body [&>strong]:text-app-fg");
});
