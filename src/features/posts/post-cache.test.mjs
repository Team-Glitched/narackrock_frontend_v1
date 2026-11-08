import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { QueryClient } from "@tanstack/react-query";
import { createServer } from "vite";

let server;
let posts;
let shorts;

before(async () => {
  // Load the production query helpers with the same @ alias as the app, without a browser or a backend.
  const root = fileURLToPath(new URL("../../..", import.meta.url));
  server = await createServer({
    root,
    configFile: false,
    resolve: { alias: { "@": `${root}/src` } },
    server: { middlewareMode: true, watch: null },
    optimizeDeps: { noDiscovery: true, include: [] },
    appType: "custom",
  });
  posts = await server.ssrLoadModule("/src/features/posts/post-queries.ts");
  shorts = await server.ssrLoadModule("/src/features/abyss/abyss-queries.ts");
});

after(async () => {
  await server?.close();
});

function clientFor(t) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity, staleTime: 30_000 } },
  });
  t.after(() => client.clear());
  return client;
}

function delayedRead(client, queryKey, snapshot) {
  const response = Promise.withResolvers();
  let signal;
  const request = client.fetchQuery({
    queryKey,
    staleTime: 0,
    queryFn: (context) => {
      signal = context.signal;
      return response.promise;
    },
  }).catch(() => {});
  return {
    get aborted() { return signal.aborted; },
    async complete() {
      response.resolve(snapshot);
      await request;
    },
  };
}

test("a delayed detail or list read cannot undo a confirmed post reaction", async (t) => {
  const client = clientFor(t);
  const detailKey = posts.postKeys.detail(7, 42);
  const listKey = posts.postKeys.list(7, 1, "LATEST", null);
  const detail = { postId: 42, title: "post", isLiked: false, isDisliked: false, likeCount: 0, dislikeCount: 0 };
  const list = { pages: [{ posts: [{ postId: 42, likeCount: 0 }], totalCount: 1 }], pageParams: [0] };
  client.setQueryData(detailKey, detail);
  client.setQueryData(listKey, list);
  const detailRead = delayedRead(client, detailKey, detail);
  const listRead = delayedRead(client, listKey, list);

  await posts.applyPostReaction(client, 7, 42, { isLiked: true, isDisliked: false, likeCount: 1, dislikeCount: 0 });
  await Promise.all([detailRead.complete(), listRead.complete()]);

  assert.equal(detailRead.aborted, true);
  assert.equal(listRead.aborted, true);
  assert.equal(client.getQueryData(detailKey).isLiked, true);
  assert.equal(client.getQueryData(detailKey).likeCount, 1);
  assert.equal(client.getQueryData(detailKey).title, "post");
  assert.equal(client.getQueryData(listKey).pages[0].posts[0].likeCount, 1);
});

test("a delayed post detail read cannot restore a removed bookmark", async (t) => {
  const client = clientFor(t);
  const key = posts.postKeys.detail(7, 42);
  const detail = { postId: 42, isBookmarked: true };
  client.setQueryData(key, detail);
  const read = delayedRead(client, key, detail);

  await posts.applyPostBookmark(client, 7, 42, false);
  await read.complete();

  assert.equal(read.aborted, true);
  assert.equal(client.getQueryData(key).isBookmarked, false);
});

test("unsaving a short updates every feed page and its detail immediately, even with delayed reads", async (t) => {
  const client = clientFor(t);
  const feedKey = shorts.shortKeys.feed(7);
  const detailKey = shorts.shortKeys.detail(7, 42);
  const short = { shortId: 42, isBookmarked: true, likeCount: 3 };
  const other = { shortId: 43, isBookmarked: true };
  const feed = { pages: [{ items: [other] }, { items: [short] }], pageParams: [undefined, 43] };
  client.setQueryData(feedKey, feed);
  client.setQueryData(detailKey, short);
  client.setQueryData(shorts.shortKeys.feed(8), feed);
  const feedRead = delayedRead(client, feedKey, feed);
  const detailRead = delayedRead(client, detailKey, short);

  await shorts.updateCachedShort(client, 7, 42, (item) => ({ ...item, isBookmarked: false }));
  await Promise.all([feedRead.complete(), detailRead.complete()]);

  assert.equal(feedRead.aborted, true);
  assert.equal(detailRead.aborted, true);
  assert.equal(client.getQueryData(detailKey).isBookmarked, false);
  assert.equal(client.getQueryData(detailKey).likeCount, 3);
  assert.equal(client.getQueryData(feedKey).pages[0].items[0].isBookmarked, true);
  assert.equal(client.getQueryData(shorts.shortKeys.feed(8)).pages[1].items[0].isBookmarked, true);
  // Returning within staleTime must show the confirmed removal without needing a refetch.
  const returned = await client.fetchInfiniteQuery({
    ...shorts.shortsFeedQuery(7),
    queryFn: () => { throw new Error("a fresh feed should be read from the cache"); },
  });
  assert.equal(returned.pages[1].items[0].isBookmarked, false);
  assert.deepEqual(returned.pageParams, feed.pageParams);
});

test("confirmed changes do not create incomplete details or feeds that were never loaded", async (t) => {
  const client = clientFor(t);
  await posts.applyPostReaction(client, 7, 42, { isLiked: true, isDisliked: false, likeCount: 1, dislikeCount: 0 });
  await posts.applyPostBookmark(client, 7, 42, false);
  await shorts.updateCachedShort(client, 7, 42, (short) => ({ ...short, isBookmarked: false }));
  assert.equal(client.getQueryData(posts.postKeys.detail(7, 42)), undefined);
  assert.equal(client.getQueryData(shorts.shortKeys.detail(7, 42)), undefined);
  assert.equal(client.getQueryData(shorts.shortKeys.feed(7)), undefined);
});
