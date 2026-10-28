// Minimal Windows BMP decoder written for this project.
// Supports: BITMAPCOREHEADER (12), BITMAPINFOHEADER (40) and V2..V5 (52/56/108/124),
// 1/4/8/16/24/32 bpp, BI_RGB, BI_RLE8, BI_RLE4, BI_BITFIELDS, bottom-up and top-down.
// The file header (14 bytes, "BM") is optional so raw DIB resources also decode.

export interface DecodedImage { width: number; height: number; data: Uint8ClampedArray }

export function decodeBmp(buf: ArrayBuffer | Uint8Array): DecodedImage {
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  let base = 0;
  let pixelOffset = -1;
  if (u8[0] === 0x42 && u8[1] === 0x4d) { pixelOffset = dv.getUint32(10, true); base = 14; }
  const hsize = dv.getUint32(base, true);
  let width: number, height: number, bpp: number, compression = 0, clrUsed = 0;
  let palEntrySize = 4;
  let masks: number[] | null = null;
  if (hsize === 12) {
    width = dv.getUint16(base + 4, true); height = dv.getInt16(base + 6, true);
    bpp = dv.getUint16(base + 10, true); palEntrySize = 3;
  } else if (hsize >= 40) {
    width = dv.getInt32(base + 4, true); height = dv.getInt32(base + 8, true);
    bpp = dv.getUint16(base + 14, true); compression = dv.getUint32(base + 16, true);
    clrUsed = dv.getUint32(base + 32, true);
    if (compression === 3 || compression === 6) {
      if (hsize >= 52) masks = [dv.getUint32(base + 40, true), dv.getUint32(base + 44, true), dv.getUint32(base + 48, true),
        hsize >= 56 ? dv.getUint32(base + 52, true) : 0];
      else masks = [dv.getUint32(base + 40, true), dv.getUint32(base + 44, true), dv.getUint32(base + 48, true), 0];
    }
  } else throw new Error(`BMP: unsupported header size ${hsize}`);
  const topDown = height < 0; height = Math.abs(height);
  if (width <= 0 || height <= 0 || width > 8192 || height > 8192) throw new Error('BMP: bad dimensions');

  // palette
  const palStart = base + hsize + (hsize === 40 && masks ? 12 : 0);
  let ncolors = 0;
  if (bpp <= 8) ncolors = clrUsed || (1 << bpp);
  const pal = new Uint8Array(256 * 3);
  for (let i = 0; i < ncolors && i < 256; i++) {
    const o = palStart + i * palEntrySize;
    if (o + 2 >= u8.length) break;
    pal[i * 3] = u8[o + 2]; pal[i * 3 + 1] = u8[o + 1]; pal[i * 3 + 2] = u8[o];
  }
  if (pixelOffset < 0) pixelOffset = palStart + ncolors * palEntrySize;

  const out = new Uint8ClampedArray(width * height * 4);
  const put = (x: number, y: number, r: number, g: number, b: number, a = 255) => {
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    const yy = topDown ? y : height - 1 - y; // y is the file row index
    const o = (yy * width + x) * 4;
    out[o] = r; out[o + 1] = g; out[o + 2] = b; out[o + 3] = a;
  };
  const putIdx = (x: number, y: number, idx: number) => put(x, y, pal[idx * 3], pal[idx * 3 + 1], pal[idx * 3 + 2]);
  // default: opaque black (RLE "skipped" pixels)
  for (let i = 3; i < out.length; i += 4) out[i] = 255;

  if (compression === 1 || compression === 2) {
    // RLE8 / RLE4
    const rle4 = compression === 2;
    let p = pixelOffset, x = 0, y = 0;
    while (p + 1 < u8.length && y < height) {
      const n = u8[p++], c = u8[p++];
      if (n > 0) {
        for (let i = 0; i < n; i++) {
          const idx = rle4 ? ((i & 1) ? (c & 15) : (c >> 4)) : c;
          putIdx(x++, y, idx);
        }
      } else if (c === 0) { x = 0; y++; }
      else if (c === 1) break;
      else if (c === 2) { x += u8[p++]; y += u8[p++]; }
      else {
        const cnt = c;
        if (rle4) {
          for (let i = 0; i < cnt; i++) { const b = u8[p + (i >> 1)]; putIdx(x++, y, (i & 1) ? (b & 15) : (b >> 4)); }
          const bytes = (cnt + 1) >> 1; p += bytes + (bytes & 1);
        } else {
          for (let i = 0; i < cnt; i++) putIdx(x++, y, u8[p + i]);
          p += cnt + (cnt & 1);
        }
      }
    }
    return { width, height, data: out };
  }

  const stride = Math.floor((width * bpp + 31) / 32) * 4;
  const maskInfo = (m: number) => {
    if (!m) return { shift: 0, bits: 0 };
    let shift = 0; while (!((m >>> shift) & 1)) shift++;
    let bits = 0; while ((m >>> (shift + bits)) & 1) bits++;
    return { shift, bits };
  };
  let mi: { shift: number; bits: number }[] = [];
  if (bpp === 16 || bpp === 32) {
    const m = masks ?? (bpp === 16 ? [0x7c00, 0x03e0, 0x001f, 0] : [0xff0000, 0xff00, 0xff, 0]);
    mi = m.map(maskInfo);
  }
  const scale = (v: number, bits: number) => bits === 0 ? 0 : bits >= 8 ? v >>> (bits - 8) : Math.round(v * 255 / ((1 << bits) - 1));
  for (let y = 0; y < height; y++) {
    const row = pixelOffset + y * stride;
    if (row >= u8.length) break;
    for (let x = 0; x < width; x++) {
      switch (bpp) {
        case 1: putIdx(x, y, (u8[row + (x >> 3)] >> (7 - (x & 7))) & 1); break;
        case 4: putIdx(x, y, (x & 1) ? (u8[row + (x >> 1)] & 15) : (u8[row + (x >> 1)] >> 4)); break;
        case 8: putIdx(x, y, u8[row + x]); break;
        case 24: { const o = row + x * 3; put(x, y, u8[o + 2], u8[o + 1], u8[o]); break; }
        case 16: case 32: {
          const v = bpp === 16 ? dv.getUint16(row + x * 2, true) : dv.getUint32(row + x * 4, true);
          const ch = mi.map((m) => scale((v >>> m.shift) & ((1 << m.bits) - 1 || 0), m.bits));
          put(x, y, ch[0], ch[1], ch[2], 255);
          break;
        }
        default: throw new Error(`BMP: unsupported bpp ${bpp}`);
      }
    }
  }
  return { width, height, data: out };
}
