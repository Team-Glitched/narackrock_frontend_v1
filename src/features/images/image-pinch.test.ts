import assert from "node:assert/strict";
import test from "node:test";
import { cropSourceRect, defaultCrop, pinchCrop } from "./image-crop.ts";

test("pinching scales the image around the point between the fingers while allowing movement", () => {
  const from = { x: 90, y: 120 };
  const to = { x: 110, y: 135 };
  const before = cropSourceRect(defaultCrop(), 1000, 800);
  const crop = pinchCrop(defaultCrop(), 2, from, to, 1000, 800, 300);
  assert.equal(crop.zoom, 2);
  const after = cropSourceRect(crop, 1000, 800);
  assert.ok(
    Math.abs(before.sx + (from.x / 300) * before.size - (after.sx + (to.x / 300) * after.size)) <
      1e-9,
  );
  assert.ok(
    Math.abs(before.sy + (from.y / 300) * before.size - (after.sy + (to.y / 300) * after.size)) <
      1e-9,
  );
});

test("pinching in and out stays within zoom limits and never exposes empty image edges", () => {
  for (const [width, height] of [
    [1600, 900],
    [600, 1000],
    [512, 512],
  ]) {
    for (const scale of [0.01, 0.5, 1, 2, 100]) {
      const crop = pinchCrop(
        { zoom: 2, x: 0.5, y: 0.5 },
        scale,
        { x: 150, y: 150 },
        { x: -1000, y: 1000 },
        width,
        height,
        300,
      );
      assert.ok(crop.zoom >= 1 && crop.zoom <= 4);
      const { sx, sy, size } = cropSourceRect(crop, width, height);
      assert.ok(sx >= -1e-9 && sy >= -1e-9);
      assert.ok(sx + size <= width + 1e-9 && sy + size <= height + 1e-9);
    }
  }
});
