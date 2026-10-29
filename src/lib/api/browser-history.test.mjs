import assert from "node:assert/strict";
import test from "node:test";
import { createMemoryRouter } from "react-router";
import { pageRoutes } from "../../features/navigation/route-config.ts";

function makeRouter(initialEntries) {
  const children = () => pageRoutes.map(route => ({ ...(route.path ? { path: route.path } : { index: true }), id: route.id, handle: route }));
  return createMemoryRouter([{ path: "/", children: children() }], { initialEntries });
}

test("router back and forward restore search context and the selected post", async () => {
  const router = makeRouter(["/search?scope=posts&q=piano&galleryId=7"]);
  try {
    await router.navigate("/communities/7/posts/12", { state: { from: "/search?scope=posts&q=piano&galleryId=7" } });
    assert.equal(router.state.matches.at(-1).params.postId, "12");
    await router.navigate(-1);
    assert.equal(router.state.location.search, "?scope=posts&q=piano&galleryId=7");
    await router.navigate(1);
    assert.equal(router.state.location.pathname, "/communities/7/posts/12");
  } finally { router.dispose(); }
});

test("typing replaces search history entries and a new branch replaces the forward path", async () => {
  const router = makeRouter(["/"]);
  try {
    await router.navigate("/search?scope=songs");
    for (const q of ["p", "pi", "piano"]) await router.navigate(`/search?scope=songs&q=${q}`, { replace: true });
    await router.navigate("/abyss/4");
    await router.navigate(-1);
    assert.equal(router.state.location.search, "?scope=songs&q=piano");
    await router.navigate("/sources/8");
    await router.navigate(-1);
    await router.navigate(-1);
    assert.equal(router.state.location.pathname, "/");
  } finally { router.dispose(); }
});

test("editor links open directly and preserve their selection through browser navigation", async () => {
  const router = makeRouter(["/studio/42/tracks/3/notes?clipId=9&shortId=7"]);
  try {
    assert.equal(router.state.matches.at(-1).route.handle.id, "notes");
    assert.deepEqual(router.state.matches.at(-1).params, { projectId: "42", trackId: "3" });
    await router.navigate("/studio/42?shortId=7");
    await router.navigate(-1);
    assert.equal(router.state.location.pathname, "/studio/42/tracks/3/notes");
    assert.equal(router.state.location.search, "?clipId=9&shortId=7");
  } finally { router.dispose(); }
});
