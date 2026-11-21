import assert from "node:assert/strict";
import test from "node:test";
import { defaultCrop, renderThumbnail } from "./image-crop.ts";

test("uploads exactly the selected square, caps resolution, and preserves alpha-capable formats", async (t) => {
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  const originalDecoder = Object.getOwnPropertyDescriptor(globalThis, "createImageBitmap");
  t.after(() => {
    if (originalDocument) Object.defineProperty(globalThis, "document", originalDocument);
    else Reflect.deleteProperty(globalThis, "document");
    if (originalDecoder) Object.defineProperty(globalThis, "createImageBitmap", originalDecoder);
    else Reflect.deleteProperty(globalThis, "createImageBitmap");
  });
  let closed = 0;
  let dimensions = [3000, 2000];
  let encoding: string | undefined;
  let drawing: number[] = [];
  let fail = false;
  const bitmap = {
    get width() {
      return dimensions[0];
    },
    get height() {
      return dimensions[1];
    },
    close() {
      closed++;
    },
  };
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => ({
      imageSmoothingQuality: "low",
      drawImage: (_image: unknown, ...args: number[]) => {
        drawing = args;
      },
    }),
    toBlob: (callback: BlobCallback, type?: string) => {
      encoding = type;
      callback(fail ? null : new Blob(["encoded"], { type }));
    },
  };
  Object.defineProperty(globalThis, "createImageBitmap", {
    configurable: true,
    value: async () => bitmap,
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: { createElement: () => canvas },
  });

  for (const [type, expected, extension] of [
    ["image/jpeg", "image/jpeg", "jpg"],
    ["image/png", "image/png", "png"],
    ["image/webp", "image/webp", "webp"],
    ["image/gif", "image/png", "png"],
  ]) {
    const result = await renderThumbnail(new File(["source"], "photo.original.gif", { type }), {
      zoom: 2,
      x: 0.4,
      y: 0.6,
    });
    assert.equal(result.type, expected);
    assert.equal(result.name, `photo.original-thumbnail.${extension}`);
    assert.deepEqual(drawing, [700, 700, 1000, 1000, 0, 0, 1000, 1000]);
    assert.equal(encoding, expected);
  }
  await renderThumbnail(new File(["source"], "large.jpg", { type: "image/jpeg" }), defaultCrop());
  assert.deepEqual([canvas.width, canvas.height], [1024, 1024]);
  dimensions = [80, 60];
  await renderThumbnail(new File(["source"], "small.png", { type: "image/png" }), defaultCrop());
  assert.deepEqual([canvas.width, canvas.height], [60, 60]);
  fail = true;
  await assert.rejects(
    renderThumbnail(new File(["source"], "bad.png"), defaultCrop()),
    /이미지를 편집하지 못했습니다/,
  );
  assert.equal(closed, 7, "decoded image memory is released after both success and failure");
});
