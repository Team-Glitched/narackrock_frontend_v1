import assert from 'node:assert/strict';
import { test } from 'node:test';
import { openSourceApi } from './opensource.ts';

test('search encodes keywords and unwraps the server page', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (url) => {
    assert.equal(new URL(url, 'http://localhost').searchParams.get('keyword'), '기타 & bass');
    return Response.json({ success: true, data: { page: 0, size: 20, hasNext: false, items: [] } });
  };
  try { assert.deepEqual((await openSourceApi.list('기타 & bass')).items, []); }
  finally { globalThis.fetch = original; }
});
test('unavailable saved records preserve null source', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ success: true, data: { items: [{ openSourceId: 7, availability: 'UNAVAILABLE', source: null }] } });
  try { assert.equal((await openSourceApi.saved()).items[0].source, null); }
  finally { globalThis.fetch = original; }
});
test('save uses idempotent methods and publication patches preserve null', async () => {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => { calls.push({ url, ...init }); return Response.json({ success: true, data: {} }); };
  try {
    await openSourceApi.save(42, true); await openSourceApi.save(42, false);
    await openSourceApi.update(42, { description: null, thumbnailMediaFileId: null });
    assert.deepEqual(calls.map(x => x.method), ['PUT', 'DELETE', 'PATCH']);
    assert.deepEqual(JSON.parse(calls[2].body), { description: null, thumbnailMediaFileId: null });
  } finally { globalThis.fetch = original; }
});
test('ambiguous reaction failure is never automatically replayed', async () => {
  const original = globalThis.fetch; let count = 0;
  globalThis.fetch = async () => { count++; throw new TypeError('network unavailable'); };
  try { await assert.rejects(openSourceApi.react(42, 'likes')); assert.equal(count, 1); }
  finally { globalThis.fetch = original; }
});
