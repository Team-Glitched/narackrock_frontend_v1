import assert from "node:assert/strict";
import test from "node:test";
import { matchRoutes } from "react-router";
import { pageRoutes } from "../../features/navigation/route-config.ts";
import { notesPath, readId, safeReturnPath, viewPath } from "../../features/navigation/paths.ts";
import { routeBackPath } from "../../features/navigation/route-back.ts";
import { views } from "../../features/navigation/types.ts";

const routes = [{ path: "/", children: pageRoutes.map(route => ({ ...(route.path ? { path: route.path } : { index: true }), handle: route })) }];

test("every page has a directly addressable URL", () => {
  for (const page of pageRoutes) {
    const path = "/" + page.path.replace(/:[a-zA-Z]+Id/g, "7");
    assert.equal(matchRoutes(routes, path).at(-1).route.handle.id, page.id);
  }
});

test("static creation and management paths take precedence over resource IDs", () => {
  for (const [path, id] of [["/posts/new", "createPost"], ["/communities/manage", "ownedCommunities"], ["/communities/joined", "joined"], ["/studio/new", "studioNew"], ["/sources/new", "createSource"]]) assert.equal(matchRoutes(routes, path).at(-1).route.handle.id, id);
});

test("existing navigation callbacks all resolve to actual router pages", () => {
  for (const view of views) {
    const path = viewPath(view, { id: 9, galleryId: 4, projectId: 5, trackId: 6, clipId: 7, shortId: 8 });
    assert.ok(matchRoutes(routes, path), `${view}: ${path}`);
  }
});

test("retired demo URLs do not match application pages", () => {
  for (const path of ["/preview", "/preview/", "/preview/search?q=hi", "/preview/studio/8"]) assert.equal(matchRoutes(routes, path), null);
});

test("resource IDs reject unsafe and malformed values", () => {
  for (const id of [null, "", "0", "-1", "1.2", "1e2", "NaN", "9007199254740992"]) assert.equal(readId(id), null);
  assert.equal(readId("42"), 42);
});

test("return paths keep local query and hash while rejecting external destinations", () => {
  for (const path of ["https://example.com", "//example.com", "javascript:alert(1)", "/\\example.com", "/\n/example.com", "/folder/..//example.com"]) assert.equal(safeReturnPath(path), "/");
  assert.equal(safeReturnPath(undefined, "/settings"), "/settings");
  assert.equal(safeReturnPath("/search?scope=people&q=hello#results"), "/search?scope=people&q=hello#results");
});

test("direct editor and community links have usable back destinations", () => {
  const page = id => pageRoutes.find(route => route.id === id);
  assert.equal(routeBackPath(page("communityMembers"), { galleryId: "4" }, new URLSearchParams()), "/communities/4/manage");
  assert.equal(routeBackPath(page("notes"), { projectId: "5", trackId: "6" }, new URLSearchParams("shortId=8")), "/studio/5?shortId=8");
  assert.equal(routeBackPath(page("import"), { projectId: "5" }, new URLSearchParams("trackId=6&clipId=7&shortId=8")), notesPath(5, 6, 7, 8));
});
