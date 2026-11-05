import assert from "node:assert/strict";
import test from "node:test";
import { shareLink } from "./share-link.ts";

test("sharing capability outcomes preserve cancellation and offer manual fallback", async (t) => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  t.after(() => { if (original) Object.defineProperty(globalThis, "navigator", original); else Reflect.deleteProperty(globalThis, "navigator"); });
  function browser(value: object) { Object.defineProperty(globalThis, "navigator", { configurable: true, value }); }
  let copies = 0;
  browser({ share: async () => {}, clipboard: { writeText: async () => { copies++; } } });
  assert.deepEqual(await shareLink("Song", "https://example.com/s/1"), { status: "shared" });
  assert.equal(copies, 0);
  browser({ share: async () => { throw new DOMException("cancel", "AbortError"); }, clipboard: { writeText: async () => { copies++; } } });
  assert.deepEqual(await shareLink("Song", "https://example.com/s/1"), { status: "cancelled" });
  assert.equal(copies, 0);
  let copied = "";
  browser({ share: async () => { throw new Error("unsupported payload"); }, clipboard: { writeText: async (url: string) => { copied = url; } } });
  assert.deepEqual(await shareLink("Song", "https://example.com/s/1"), { status: "copied" });
  assert.equal(copied, "https://example.com/s/1");
  browser({ clipboard: { writeText: async () => { throw new Error("denied"); } } });
  const manual = { status: "manual", title: "Song", url: "https://example.com/s/1" };
  assert.deepEqual(await shareLink("Song", manual.url), manual);
  browser({});
  assert.deepEqual(await shareLink("Song", manual.url), manual);
});
