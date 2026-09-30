import assert from "node:assert/strict";
import { test } from "node:test";
import { validatePostImage } from "./post-image.ts";

test("accepts the image formats supported by the media API", () => {
  for (const type of ["image/jpeg", "image/png", "image/webp", "image/gif"]) {
    assert.doesNotThrow(() => validatePostImage(new File(["image"], "post-image", { type })));
  }
});

test("rejects non-image files", () => {
  assert.throws(
    () => validatePostImage(new File(["audio"], "song.mp3", { type: "audio/mpeg" })),
    /JPG, PNG, WEBP, GIF/,
  );
});

test("rejects files larger than the backend upload limit", () => {
  const tooLarge = { type: "image/png", size: 100 * 1024 * 1024 + 1 };
  assert.throws(() => validatePostImage(tooLarge), /100MB/);
});
