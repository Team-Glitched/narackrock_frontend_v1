import assert from "node:assert/strict";
import test from "node:test";
import { matchRoutes } from "react-router";
import { pageRoutes } from "../../features/navigation/route-config.ts";
import { appPath, isPreviewPath, notesPath, readId, safeReturnPath, viewPath } from "../../features/navigation/paths.ts";
import { routeBackPath } from "../../features/navigation/route-back.ts";
import { views } from "../../features/navigation/types.ts";

const routes = [{ path: "/", children: pageRoutes.map(route => ({ ...(route.path ? { path: route.path } : { index: true }), handle: route })) }, { path: "/preview", children: pageRoutes.map(route => ({ ...(route.path ? { path: route.path } : { index: true }), handle: route })) }];

test("every page has a directly addressable live and preview URL", () => {
  for (const page of pageRoutes) {
    const path = "/" + page.path.replace(/:[a-zA-Z]+Id/g, "7");
    for (const preview of [false, true]) assert.equal(matchRoutes(routes, appPath(path, preview)).at(-1).route.handle.id, page.id);
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

test("preview detection covers nested pages without capturing similarly named live paths", () => {
  assert.equal(isPreviewPath("/preview/studio/8"), true);
  assert.equal(isPreviewPath("/preview/"), true);
  assert.equal(isPreviewPath("/previewing"), false);
  assert.equal(appPath("/preview/search?q=hi", true), "/preview/search?q=hi");
  assert.equal(appPath("/preview?notifications=1", true), "/preview?notifications=1");
  assert.equal(appPath("/?notifications=1#inbox", true), "/preview?notifications=1#inbox");
  assert.equal(appPath("/preview?notifications=1", false), "/?notifications=1");
});

test("resource IDs reject unsafe and malformed values", () => {
  for (const id of [null, "", "0", "-1", "1.2", "1e2", "NaN", "9007199254740992"]) assert.equal(readId(id), null);
  assert.equal(readId("42"), 42);
});

test("return paths stay within the current mode and reject external destinations", () => {
  for (const path of ["https://example.com", "//example.com", "javascript:alert(1)", "/\\example.com"]) assert.equal(safeReturnPath(path, false), "/");
  assert.equal(safeReturnPath("/preview/profile", false), "/");
  assert.equal(safeReturnPath("/profile", true), "/preview");
  assert.equal(safeReturnPath("/preview/search?scope=people&q=hello", true), "/preview/search?scope=people&q=hello");
});

test("direct editor and community links have usable back destinations", () => {
  const page = id => pageRoutes.find(route => route.id === id);
  assert.equal(routeBackPath(page("communityMembers"), { galleryId: "4" }, new URLSearchParams()), "/communities/4/manage");
  assert.equal(routeBackPath(page("notes"), { projectId: "5", trackId: "6" }, new URLSearchParams("shortId=8")), "/studio/5?shortId=8");
  assert.equal(routeBackPath(page("import"), { projectId: "5" }, new URLSearchParams("trackId=6&clipId=7&shortId=8")), notesPath(5, 6, 7, 8));
});
