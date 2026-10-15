import assert from "node:assert/strict";
import { test } from "node:test";
import { contentLink, parseContentLink } from "./content-link.ts";

test("creates and resolves production links to the exact post or short", () => {
  const post = contentLink({ kind: "post", id: 42 });
  const short = contentLink({ kind: "short", id: 17 });
  assert.equal(post, "https://narackrock.com/?post=42");
  assert.equal(short, "https://narackrock.com/?short=17");
  assert.deepEqual(parseContentLink(new URL(post).search), { kind: "post", id: 42 });
  assert.deepEqual(parseContentLink(new URL(short).search), { kind: "short", id: 17 });
});

test("ignores invalid or unsafe content IDs", () => {
  assert.equal(parseContentLink("?post=-1"), null);
  assert.equal(parseContentLink("?short=1.5"), null);
  assert.equal(parseContentLink("?post=9007199254740992"), null);
  assert.throws(() => contentLink({ kind: "post", id: 0 }));
});
