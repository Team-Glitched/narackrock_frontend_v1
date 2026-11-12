import assert from "node:assert/strict";
import test from "node:test";
import type { ShortsPageDto } from "@/lib/api/contracts";
import { findNextFeedShort } from "./next-feed-short.ts";

function page(shortId: number, nextCursor: number | null): ShortsPageDto {
  return {
    items: [{ shortId } as ShortsPageDto["items"][number]],
    page: { nextCursor, hasMore: nextCursor !== null, size: 1 },
  };
}

function fixture(first: ShortsPageDto, ...responses: ShortsPageDto[]) {
  const data = { pages: [first], pageParams: [undefined] as (number | undefined)[] };
  return {
    feed: { data, hasNextPage: first.page.hasMore },
    fetchNextPage: async () => {
      const cursor = data.pages.at(-1)?.page.nextCursor;
      const response = responses.shift();
      assert.ok(response);
      data.pages.push(response);
      data.pageParams.push(cursor ?? undefined);
      return { data, hasNextPage: response.page.hasMore, isFetchNextPageError: false };
    },
  };
}

test("skips an overlapping page and selects the first unseen short", async () => {
  const { feed, fetchNextPage } = fixture(page(1, 10), page(1, 20), page(2, null));
  const result = await findNextFeedShort(feed, fetchNextPage, new Set([1]), new AbortController().signal);
  assert.deepEqual(result, { kind: "found", short: { shortId: 2 } });
  assert.deepEqual(feed.data.pageParams, [undefined, 10, 20]);
});

test("reaches the end after a final overlapping page", async () => {
  const { feed, fetchNextPage } = fixture(page(1, 10), page(1, null));
  assert.deepEqual(
    await findNextFeedShort(feed, fetchNextPage, new Set([1]), new AbortController().signal),
    { kind: "end" },
  );
});

test("fails without requesting the same cursor twice", async () => {
  const { feed, fetchNextPage } = fixture(page(1, 10), page(1, 10));
  assert.deepEqual(
    await findNextFeedShort(feed, fetchNextPage, new Set([1]), new AbortController().signal),
    { kind: "failed" },
  );
  assert.deepEqual(feed.data.pageParams, [undefined, 10]);
});

test("discards a page when the selection changes during the request", async () => {
  const { feed, fetchNextPage } = fixture(page(1, 10), page(2, null));
  const controller = new AbortController();
  const result = await findNextFeedShort(feed, async () => {
    controller.abort();
    return fetchNextPage();
  }, new Set([1]), controller.signal);
  assert.deepEqual(result, { kind: "cancelled" });
});
