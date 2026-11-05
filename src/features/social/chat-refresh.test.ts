import assert from "node:assert/strict";
import test from "node:test";
import { setImmediate } from "node:timers/promises";
import { createChatRefresh } from "./chat-refresh.ts";


test("concurrent inbox events coalesce into one trailing REST refresh", async () => {
  const first = Promise.withResolvers<number>();
  const second = Promise.withResolvers<number>();
  let calls = 0;
  const results: number[] = [];
  const errors: unknown[] = [];
  const refresh = createChatRefresh({
    load: () => ++calls === 1 ? first.promise : second.promise,
    isCurrent: () => true,
    onSuccess: (value) => results.push(value),
    onError: (cause) => errors.push(cause),
  });
  refresh.request();
  refresh.request();
  refresh.request();
  assert.equal(calls, 1);
  first.resolve(1);
  await setImmediate();
  assert.equal(calls, 2);
  second.resolve(2);
  await setImmediate();
  assert.deepEqual(results, [1, 2]);
  assert.deepEqual(errors, []);
  refresh.dispose();
});

test("account replacement ignores old REST data and queued refreshes", async () => {
  const pending = Promise.withResolvers<string[]>();
  let account = 1;
  let calls = 0;
  const rows: string[][] = [];
  const errors: unknown[] = [];
  const refresh = createChatRefresh({
    load: () => { calls++; return pending.promise; },
    isCurrent: () => account === 1,
    onSuccess: (value) => rows.push(value),
    onError: (cause) => errors.push(cause),
  });
  refresh.request();
  refresh.request();
  account = 2;
  pending.resolve(["private old account data"]);
  await setImmediate();
  refresh.request();
  assert.equal(calls, 1);
  assert.deepEqual(rows, []);
  assert.deepEqual(errors, []);
});

test("disposal ignores stale errors even after switching back to the first account", async () => {
  const pending = Promise.withResolvers<number>();
  const errors: unknown[] = [];
  const refresh = createChatRefresh({
    load: () => pending.promise,
    isCurrent: () => true,
    onSuccess: () => assert.fail("disposed success"),
    onError: (cause) => errors.push(cause),
  });
  refresh.request();
  refresh.dispose();
  pending.reject(new Error("old request"));
  await setImmediate();
  assert.deepEqual(errors, []);
});

test("a failed refresh retains a queued refresh and permits explicit recovery", async () => {
  let calls = 0;
  const results: number[] = [];
  const errors: unknown[] = [];
  const refresh = createChatRefresh({
    load: async () => { if (++calls === 1) throw new Error("offline"); return calls; },
    isCurrent: () => true,
    onSuccess: (value) => results.push(value),
    onError: (cause) => errors.push(cause),
  });
  refresh.request();
  refresh.request();
  await setImmediate();
  assert.equal(errors.length, 1);
  assert.deepEqual(results, [2]);
  refresh.request();
  await setImmediate();
  assert.deepEqual(results, [2, 3]);
  refresh.dispose();
});
