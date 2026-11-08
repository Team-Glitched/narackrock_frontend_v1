import test from "node:test";
import assert from "node:assert/strict";
import { clampCrop, cropDisplay, cropSourceRect, defaultCrop, panCrop } from "./thumbnail-crop.ts";

const inside = (rect: { sx: number; sy: number; size: number }, width: number, height: number) =>
  rect.sx >= -1e-9 && rect.sy >= -1e-9 && rect.sx + rect.size <= width + 1e-9 && rect.sy + rect.size <= height + 1e-9;

test("default crop is the centred square that a circular avatar shows today", () => {
  assert.deepEqual(cropSourceRect(defaultCrop(), 1600, 900), { sx: 350, sy: 0, size: 900 });
  assert.deepEqual(cropSourceRect(defaultCrop(), 600, 1000), { sx: 0, sy: 200, size: 600 });
});

test("panning and zooming never move the square outside the image", () => {
  for (const [width, height] of [[1600, 900], [600, 1000], [512, 512]]) {
    let crop = defaultCrop();
    for (const [dx, dy] of [[5000, 0], [-5000, 0], [0, 5000], [0, -5000], [37, -91]]) {
      crop = panCrop(crop, dx, dy, width, height, 220);
      assert.ok(inside(cropSourceRect(crop, width, height), width, height), `${width}x${height} pan ${dx},${dy}`);
    }
    for (const zoom of [0, 1, 2.5, 4, 99]) {
      const rect = cropSourceRect(clampCrop({ ...crop, zoom }, width, height), width, height);
      assert.ok(inside(rect, width, height), `${width}x${height} zoom ${zoom}`);
    }
  }
});

test("dragging the image right reveals its left side, and zoom is limited to 1–4×", () => {
  const zoomed = clampCrop({ zoom: 2, x: 0.5, y: 0.5 }, 1000, 1000);
  assert.ok(panCrop(zoomed, 50, 0, 1000, 1000, 200).x < 0.5);
  assert.equal(clampCrop({ zoom: 0.2, x: 0.5, y: 0.5 }, 100, 100).zoom, 1);
  assert.equal(clampCrop({ zoom: 10, x: 0.5, y: 0.5 }, 100, 100).zoom, 4);
});

test("malformed restored values fall back to a valid centred crop", () => {
  assert.deepEqual(clampCrop({ zoom: Number.NaN, x: "a" as unknown as number }, 400, 200), { zoom: 1, x: 0.5, y: 0.5 });
  assert.deepEqual(clampCrop(null, 400, 200), { zoom: 1, x: 0.5, y: 0.5 });
});

test("display placement makes the crop fill the viewport exactly", () => {
  const crop = clampCrop({ zoom: 2, x: 0.3, y: 0.6 }, 1000, 800);
  const { sx, sy, size } = cropSourceRect(crop, 1000, 800);
  const shown = cropDisplay(crop, 1000, 800, 200);
  const scale = 200 / size;
  assert.equal(shown.left, -sx * scale);
  assert.equal(shown.top, -sy * scale);
  assert.equal(shown.width, 1000 * scale);
});
