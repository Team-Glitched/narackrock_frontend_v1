import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

let server, compositionQuery;
const originalWindow = globalThis.window,
  originalFetch = globalThis.fetch;
before(async () => {
  globalThis.window = {
    localStorage: { getItem: () => null },
    location: { origin: "http://studio.test" },
  };
  const root = fileURLToPath(new URL("../../..", import.meta.url));
  server = await createServer({
    root,
    configFile: false,
    resolve: { alias: { "@": `${root}/src` } },
    server: { middlewareMode: true, watch: null, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] },
    appType: "custom",
  });
  ({ compositionQuery } = await server.ssrLoadModule(
    "/src/features/composition/composition-queries.ts",
  ));
});
after(async () => {
  globalThis.window = originalWindow;
  globalThis.fetch = originalFetch;
  await server?.close();
});

test("approved, own working copy and different requests never share a timeline cache entry", () => {
  const keys = ["working", "approved", { contributionId: 7 }, { contributionId: 8 }].map((view) =>
    JSON.stringify(compositionQuery(1, 10, view).queryKey),
  );
  assert.equal(new Set(keys).size, 4);
});

test("timeline reads send the selected view to the server", async () => {
  const urls = [];
  globalThis.fetch = async (url) => {
    urls.push(String(url));
    return new Response(JSON.stringify({ success: true, data: { tracks: [] } }), { status: 200 });
  };
  for (const view of ["working", "approved", { contributionId: 7 }])
    await compositionQuery(1, 10, view).queryFn({ signal: new AbortController().signal });
  assert.deepEqual(urls, [
    "/api/v1/projects/10/tracks?view=WORKING",
    "/api/v1/projects/10/tracks?view=APPROVED",
    "/api/v1/projects/10/tracks?contributionId=7",
  ]);
});
