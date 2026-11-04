import assert from "node:assert/strict";
import { test } from "node:test";
import { canonicalShareLink } from "./content-link.ts";

const origin = "http://127.0.0.1:5173";

test("legacy server short links resolve to the app's abyss route for the same short", () => {
  assert.equal(canonicalShareLink("short", 17, "https://narackrock.com/shorts/17", origin), `${origin}/abyss/17`);
  assert.equal(canonicalShareLink("source", 3, "http://localhost:5173/opensource/3/", origin), `${origin}/sources/3`);
});

test("a link that names another entity or is not http(s) is rejected", () => {
  assert.throws(() => canonicalShareLink("post", 4, "https://narackrock.com/posts/40", origin));
  assert.throws(() => canonicalShareLink("post", 4, "javascript:alert(4)//4", origin));
  assert.throws(() => canonicalShareLink("post", 4, "/posts/4", origin));
});
