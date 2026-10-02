import { test } from "node:test";
import assert from "node:assert/strict";
import { parseImageDimensionsFromBuffer } from "../dist/src/shared/img-dims.js";

function u8(arr: number[]): Uint8Array {
  return new Uint8Array(arr);
}

test("parseImageDimensionsFromBuffer: PNG", () => {
  // Minimal valid PNG IHDR chunk
  const buf = u8([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG signature
    0x00, 0x00, 0x00, 0x0d, // IHDR length (13)
    0x49, 0x48, 0x44, 0x52, // IHDR
    0x00, 0x00, 0x02, 0x80, // width 640
    0x00, 0x00, 0x01, 0x90, // height 400
    0x08, 0, 0, 0, 0, 0,    // bit depth, color type, compression, filter, interlace, CRC start
  ]);
  const result = parseImageDimensionsFromBuffer(Buffer.from(buf));
  assert.ok(result);
  assert.equal(result!.format, "png");
  assert.equal(result!.width, 640);
  assert.equal(result!.height, 400);
});

test("parseImageDimensionsFromBuffer: unknown bytes return undefined", () => {
  const result = parseImageDimensionsFromBuffer(Buffer.from("hello world"));
  assert.equal(result, undefined);
});

test("parseImageDimensionsFromBuffer: buffer too small returns undefined", () => {
  const result = parseImageDimensionsFromBuffer(Buffer.from([0x89, 0x50]));
  assert.equal(result, undefined);
});

test("parseImageDimensionsFromBuffer: GIF", () => {
  const buf = u8([
    0x47, 0x49, 0x46, 0x38, 0x39, 0x61,
    0x40, 0x00, // width 64 (little-endian)
    0x1a, 0x00, // height 26
  ]);
  const result = parseImageDimensionsFromBuffer(Buffer.from(buf));
  assert.ok(result);
  assert.equal(result!.format, "gif");
  assert.equal(result!.width, 64);
  assert.equal(result!.height, 26);
});

test("parseImageDimensionsFromBuffer: JPEG SOF0", () => {
  const buf = u8([
    0xff, 0xd8, // JPEG signature
    0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, // APP0 JFIF marker (16 bytes length)
    0xff, 0xc0, 0x00, 0x0b, // SOF0 marker + 11 bytes length (minimum is 11 for baseline)
    0x08, // precision
    0x00, 0x0f, // height 15
    0x00, 0x10, // width 16
    0x01, 0x01, 0x11, 0x00, // components, h, v, quant table id
  ]);
  const result = parseImageDimensionsFromBuffer(Buffer.from(buf));
  assert.ok(result);
  assert.equal(result!.format, "jpeg");
  assert.equal(result!.width, 16);
  assert.equal(result!.height, 15);
});


