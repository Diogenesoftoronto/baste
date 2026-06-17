/**
 * Fast image dimension reader
 *
 * Parses width/height from PNG, JPEG, GIF, AVIF and WebP headers
 * without loading an external dependency.
 */

const HDR = {
  png: [0x89, 0x50, 0x4e, 0x47] as number[],
  gif: [0x47, 0x49, 0x46, 0x38] as number[],
  webp: [0x52, 0x49, 0x46, 0x46] as number[],
};

function match(buf: Uint8Array, sig: readonly number[]): boolean {
  for (let i = 0; i < sig.length; i++) {
    if (buf[i] !== sig[i]) return false;
  }
  return true;
}

function u16be(buf: Uint8Array, off: number): number {
  return (buf[off] << 8) | buf[off + 1];
}

function u32be(buf: Uint8Array, off: number): number {
  return (buf[off] << 24) | (buf[off + 1] << 16) | (buf[off + 2] << 8) | buf[off + 3];
}

function u16le(buf: Uint8Array, off: number): number {
  return buf[off] | (buf[off + 1] << 8);
}

function u32le(buf: Uint8Array, off: number): number {
  return buf[off] | (buf[off + 1] << 8) | (buf[off + 2] << 16) | (buf[off + 3] << 24);
}

function parsePng(buf: Uint8Array):
  { width: number; height: number } | undefined {
  if (!match(buf, HDR.png)) return undefined;
  const ihdr = 16;
  if (buf.length < ihdr + 8) return undefined;
  return { width: u32be(buf, ihdr), height: u32be(buf, ihdr + 4) };
}

function parseGif(buf: Uint8Array):
  { width: number; height: number } | undefined {
  if (!match(buf, HDR.gif)) return undefined;
  if (buf.length < 10) return undefined;
  return { width: u16le(buf, 6), height: u16le(buf, 8) };
}

function parseJpeg(buf: Uint8Array):
  { width: number; height: number } | undefined {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return undefined;
  let i = 2;
  while (i < buf.length - 1) {
    if (buf[i] !== 0xff) { i++; continue; }
    const marker = buf[i + 1];
    if (marker === 0xd9 || marker === 0xda) break;
    if (
      marker === 0xc0 || marker === 0xc2 ||
      marker === 0xc1 || marker === 0xc3 ||
      marker === 0xc5 || marker === 0xc6 ||
      marker === 0xc7 || marker === 0xc9 ||
      marker === 0xca || marker === 0xcb ||
      marker === 0xcd || marker === 0xce ||
      marker === 0xcf
    ) {
      if (buf.length < i + 10) return undefined;
      return { width: u16be(buf, i + 7), height: u16be(buf, i + 5) };
    }
    if (marker === 0xd8 || marker === 0x01 || marker === 0x00) {
      i += 2;
      continue;
    }
    if (buf.length < i + 4) return undefined;
    const len = u16be(buf, i + 2);
    i += 2 + len;
  }
  return undefined;
}

function parseWebp(buf: Uint8Array):
  { width: number; height: number } | undefined {
  if (buf.length < 30) return undefined;
  if (!match(buf, HDR.webp)) return undefined;
  const chunk = String.fromCharCode(buf[12], buf[13], buf[14], buf[15]);
  if (chunk === "VP8 ") {
    return { width: u16le(buf, 26) & 0x3fff, height: u16le(buf, 28) & 0x3fff };
  }
  if (chunk === "VP8L") {
    const b0 = buf[21];
    const b1 = buf[22];
    const b2 = buf[23];
    const b3 = buf[24];
    const w = 1 + ((b0 | (b1 << 8) | ((b2 & 0x3f) << 16)));
    const h = 1 + (((b2 >> 6) | (b3 << 2) | ((buf[25] & 0x0f) << 10)));
    return { width: w, height: h };
  }
  return undefined;
}

/**
 * Parse first few bytes of raw image data to extract dimensions.
 * Returns `undefined` if format is not recognised or buffer too small.
 */
export function parseImageDimensions(buf: Uint8Array):
  { width: number; height: number; format: string } | undefined {
  if (match(buf, HDR.png)) {
    const d = parsePng(buf);
    return d ? { ...d, format: "png" } : undefined;
  }
  if (match(buf, HDR.gif)) {
    const d = parseGif(buf);
    return d ? { ...d, format: "gif" } : undefined;
  }
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    const d = parseJpeg(buf);
    return d ? { ...d, format: "jpeg" } : undefined;
  }
  if (match(buf, HDR.webp)) {
    const d = parseWebp(buf);
    return d ? { ...d, format: "webp" } : undefined;
  }
  return undefined;
}

/**
 * Parse image dimensions from a Buffer (e.g. after fetch).
 * Only needs the first ~64 bytes for most formats.
 */
export function parseImageDimensionsFromBuffer(buffer: Buffer):
  { width: number; height: number; format: string } | undefined {
  return parseImageDimensions(new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength));
}
