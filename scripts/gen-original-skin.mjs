// Procedural generator for the ORIGINAL built-in skin of winamp-web ("Gunmetal").
// Every pixel here is drawn from code: rectangles, bevels, gradients, a hand-made 4x5
// bitmap font and seven-segment digits. No pixel data from any other skin is read.
// Only sheet sizes and sprite rectangles (functional layout facts, report B-1/B-2/B-4)
// are shared with the classic skin format, so any classic .wsz still loads on top.
//
//   node scripts/gen-original-skin.mjs   -> public/skins/original/*.bmp|txt + public/skins/original.wsz
import { mkdirSync, writeFileSync } from 'node:fs';
import { zipSync } from 'fflate';

const OUT = new URL('../public/skins/original/', import.meta.url).pathname;
const WSZ = new URL('../public/skins/original.wsz', import.meta.url).pathname;

// ---------------------------------------------------------------- palette
const C = {
  body: [60, 64, 71], bodyHi: [112, 118, 127], bodyLo: [28, 30, 34], edge: [12, 13, 15],
  face: [82, 88, 97], faceHi: [158, 165, 174], faceLo: [22, 24, 28], faceDn: [52, 56, 62],
  lcd: [7, 11, 9], lcdEdge: [36, 40, 44],
  glow: [128, 238, 166], glowDim: [24, 46, 33], ghost: [18, 34, 25],
  label: [168, 175, 184], labelLo: [36, 38, 42], glyph: [212, 218, 224],
  amber: [236, 176, 64], red: [226, 74, 58],
};
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));

// ---------------------------------------------------------------- raster
class Img {
  constructor(w, h, fill = C.body) { this.w = w; this.h = h; this.d = new Uint8Array(w * h * 3); this.rect(0, 0, w, h, fill); }
  px(x, y, c) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const o = (y * this.w + x) * 3; this.d[o] = c[0]; this.d[o + 1] = c[1]; this.d[o + 2] = c[2];
  }
  rect(x, y, w, h, c) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.px(i, j, c); }
  hline(x, y, w, c) { this.rect(x, y, w, 1, c); }
  vline(x, y, h, c) { this.rect(x, y, 1, h, c); }
  vgrad(x, y, w, h, c0, c1) { for (let j = 0; j < h; j++) this.hline(x, y + j, w, mix(c0, c1, h > 1 ? j / (h - 1) : 0)); }
  /** raised (or sunken) 1px bevel around a filled face */
  bevel(x, y, w, h, face, hi, lo, sunken = false) {
    if (face) this.rect(x, y, w, h, face);
    const a = sunken ? lo : hi, b = sunken ? hi : lo;
    this.hline(x, y, w, a); this.vline(x, y, h, a);
    this.hline(x, y + h - 1, w, b); this.vline(x + w - 1, y, h, b);
  }
  /** sunken LCD well: dark outer line, LCD interior */
  well(x, y, w, h, fill = C.lcd) {
    this.bevel(x, y, w, h, fill, C.bodyHi, C.bodyLo, true);
    this.rect(x + 1, y + 1, w - 2, h - 2, fill);
  }
  /** brushed-metal fill: deterministic horizontal streaks */
  brushed(x, y, w, h, base, amp = 5) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const n = hash((y + j) * 131 + Math.floor((x + i) / 9)) * 0.7 + hash((y + j) * 977 + x + i) * 0.3;
      const d = Math.round((n - 0.5) * 2 * amp);
      this.px(x + i, y + j, base.map((v) => Math.max(0, Math.min(255, v + d))));
    }
  }
  mask(rows, x, y, c) { rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) if (r[i] === '#') this.px(x + i, y + j, c); }); }
  text(s, x, y, c) { for (const ch of s) { this.mask(FONT[ch] ?? FONT[' '], x, y, c); x += 5; } }
  copy(src, sx, sy, w, h, dx, dy) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const o = ((sy + j) * src.w + sx + i) * 3; this.px(dx + i, dy + j, [src.d[o], src.d[o + 1], src.d[o + 2]]);
    }
  }
  /** 24-bit bottom-up BMP (BITMAPINFOHEADER) so the app's own decoder is exercised */
  bmp() {
    const stride = (this.w * 3 + 3) & ~3, size = 54 + stride * this.h;
    const b = Buffer.alloc(size);
    b.write('BM', 0, 'ascii'); b.writeUInt32LE(size, 2); b.writeUInt32LE(54, 10);
    b.writeUInt32LE(40, 14); b.writeInt32LE(this.w, 18); b.writeInt32LE(this.h, 22);
    b.writeUInt16LE(1, 26); b.writeUInt16LE(24, 28); b.writeUInt32LE(stride * this.h, 34);
    b.writeInt32LE(2835, 38); b.writeInt32LE(2835, 42);
    for (let y = 0; y < this.h; y++) {
      const row = 54 + (this.h - 1 - y) * stride;
      for (let x = 0; x < this.w; x++) {
        const o = (y * this.w + x) * 3, p = row + x * 3;
        b[p] = this.d[o + 2]; b[p + 1] = this.d[o + 1]; b[p + 2] = this.d[o];
      }
    }
    return b;
  }
}
function hash(n) { n = (n ^ 61) ^ (n >>> 16); n = Math.imul(n, 9); n ^= n >>> 4; n = Math.imul(n, 0x27d4eb2d); n ^= n >>> 15; return ((n >>> 0) % 1000) / 1000; }

// ---------------------------------------------------------------- 4x5 font (own design; 5x6 cells)
const F = (s) => s.split(' ');
const FONT = {
  A: F('.##. #..# #### #..# #..#'), B: F('###. #..# ###. #..# ###.'), C: F('.### #... #... #... .###'),
  D: F('###. #..# #..# #..# ###.'), E: F('#### #... ###. #... ####'), F: F('#### #... ###. #... #...'),
  G: F('.### #... #.## #..# .###'), H: F('#..# #..# #### #..# #..#'), I: F('###. .#.. .#.. .#.. ###.'),
  J: F('..## ...# ...# #..# .##.'), K: F('#..# #.#. ##.. #.#. #..#'), L: F('#... #... #... #... ####'),
  M: F('#..# #### #### #..# #..#'), N: F('#..# ##.# #.## #..# #..#'), O: F('.##. #..# #..# #..# .##.'),
  P: F('###. #..# ###. #... #...'), Q: F('.##. #..# #..# #.#. .#.#'), R: F('###. #..# ###. #.#. #..#'),
  S: F('.### #... .##. ...# ###.'), T: F('###. .#.. .#.. .#.. .#..'), U: F('#..# #..# #..# #..# .##.'),
  V: F('#..# #..# #..# .##. .##.'), W: F('#..# #..# #### #### #..#'), X: F('#..# #..# .##. #..# #..#'),
  Y: F('#.#. #.#. .#.. .#.. .#..'), Z: F('#### ..#. .#.. #... ####'),
  0: F('.##. #.## ##.# #..# .##.'), 1: F('.#.. ##.. .#.. .#.. ###.'), 2: F('###. ...# .##. #... ####'),
  3: F('###. ...# .##. ...# ###.'), 4: F('#..# #..# #### ...# ...#'), 5: F('#### #... ###. ...# ###.'),
  6: F('.##. #... ###. #..# .##.'), 7: F('#### ...# ..#. .#.. .#..'), 8: F('.##. #..# .##. #..# .##.'),
  9: F('.##. #..# .### ...# .##.'),
  '\x01': F('.... .... .... .... #.#.'), '.': F('.... .... .... .... .#..'), ':': F('.... .#.. .... .#.. ....'),
  '(': F('..#. .#.. .#.. .#.. ..#.'), ')': F('.#.. ..#. ..#. ..#. .#..'), '-': F('.... .... ###. .... ....'),
  "'": F('.#.. .#.. .... .... ....'), '!': F('.#.. .#.. .#.. .... .#..'), _: F('.... .... .... .... ####'),
  '+': F('.... .#.. ###. .#.. ....'), '\\': F('#... #... .#.. ..#. ..#.'), '/': F('..#. ..#. .#.. #... #...'),
  '[': F('.##. .#.. .#.. .#.. .##.'), ']': F('.##. ..#. ..#. ..#. .##.'), '~': F('.... .#.# #.#. .... ....'),
  '&': F('.#.. #.#. .#.. #.#. .#.#'), '%': F('#..# ..#. .#.. #... #..#'), ',': F('.... .... .... .#.. #...'),
  '=': F('.... ###. .... ###. ....'), $: F('.### ##.. .##. ..## ###.'), '#': F('#.#. #### #.#. #### #.#.'),
  'Å': F('.#.. .##. #..# #### #..#'), 'Ö': F('#..# .##. #..# #..# .##.'), 'Ä': F('#..# .##. #..# #### #..#'),
  '?': F('###. ...# .##. .... .#..'), '*': F('.... #.#. .#.. #.#. ....'), '"': F('#.#. #.#. .... .... ....'),
  '@': F('.##. #.## #.## #... .###'), ' ': F('.... .... .... .... ....'),
};

// ---------------------------------------------------------------- shared widgets
function button(img, x, y, w, h, pressed) {
  if (pressed) {
    img.bevel(x, y, w, h, null, C.edge, C.faceHi, false);
    img.vgrad(x + 1, y + 1, w - 2, h - 2, C.faceDn, mix(C.faceDn, C.body, 0.5));
    img.hline(x + 1, y + 1, w - 2, C.faceLo); img.vline(x + 1, y + 1, h - 2, C.faceLo);
  } else {
    img.vgrad(x, y, w, h, mix(C.face, C.faceHi, 0.25), mix(C.face, C.faceLo, 0.35));
    img.bevel(x, y, w, h, null, C.faceHi, C.edge);
    img.hline(x + 1, y + h - 2, w - 2, C.faceLo); img.vline(x + w - 2, y + 1, h - 2, C.faceLo);
  }
}
function led(img, x, y, on) { img.rect(x, y, 3, 3, on ? C.glow : C.glowDim); if (on) img.px(x, y, [220, 255, 230]); }
function smallBtn(img, x, y, rows, pressed) {
  button(img, x, y, 9, 9, pressed);
  img.mask(rows, x + 2 + (pressed ? 1 : 0), y + 2 + (pressed ? 1 : 0), pressed ? C.glow : C.glyph);
}
const G = {
  menu: F('##### ..... ##### ..... #####'), min: F('..... ..... ..... ..... #####'),
  close: F('#...# .#.#. ..#.. .#.#. #...#'), shade: F('##### ..... .###. ..#.. .....'),
  unshade: F('..... ..#.. .###. ..... #####'),
};
function titleStrip(img, x, y, w, active, label, opts = {}) {
  const top = active ? [96, 104, 116] : [70, 72, 76], bot = active ? [40, 44, 52] : [42, 43, 46];
  img.vgrad(x, y, w, 14, top, bot);
  img.hline(x, y, w, active ? [150, 158, 170] : [100, 102, 106]); img.hline(x, y + 13, w, C.edge);
  const tw = label ? label.length * 5 - 1 : 0;
  const tx = x + Math.floor((w - tw) / 2);
  const gaps = opts.gaps ?? [[x + 18, (label ? tx - 5 : x + w - 34) - (x + 18)], [tx + tw + 5, x + w - 34 - (tx + tw + 5)]];
  for (const [gx, gw] of gaps) {
    if (gw <= 0) continue;
    for (const gy of [4, 7, 10]) { img.hline(gx, y + gy - 1, gw, active ? [30, 34, 40] : [36, 37, 40]); img.hline(gx, y + gy, gw, active ? [128, 136, 148] : [88, 90, 94]); }
  }
  if (label) img.text(label, tx, y + 4, active ? C.glow : [150, 154, 160]);
}

// ---------------------------------------------------------------- main.bmp 275x116
const main = new Img(275, 116);
main.brushed(0, 0, 275, 116, C.body);
main.bevel(0, 0, 275, 116, null, C.bodyHi, C.edge);
main.hline(1, 114, 273, C.bodyLo); main.vline(273, 1, 114, C.bodyLo);
main.well(8, 20, 96, 48);                         // display: clutterbar, play state, time, vis
main.hline(22, 41, 80, C.lcdEdge);                // divider between time and vis
main.well(108, 23, 160, 14);                      // song title marquee (111..264, y 27)
main.well(109, 40, 19, 11);                       // kbps digits (111..125)
main.text('KBPS', 130, 43, C.label);
main.well(154, 40, 14, 11);                       // khz digits (156..165)
main.text('KHZ', 170, 43, C.label);
main.well(210, 39, 59, 16);                       // mono / stereo indicators
main.well(15, 71, 250, 12, C.bodyLo);             // seek groove surround
main.text('VOL', 116, 52, C.labelLo); main.text('BAL', 189, 52, C.labelLo);
main.hline(10, 85, 255, C.bodyLo); main.hline(10, 86, 255, C.bodyHi);
// speaker grille (decoration, bottom right)
for (let j = 0; j < 4; j++) for (let i = 0; i < 6; i++) {
  const gx = 243 + i * 4 + (j & 1) * 2, gy = 90 + j * 4;
  main.px(gx, gy, C.edge); main.px(gx + 1, gy + 1, C.bodyHi);
}

// ---------------------------------------------------------------- titlebar.bmp 344x87
const tb = new Img(344, 87, C.bodyLo);
for (const [gx, gy, g] of [[0, 0, 'menu'], [9, 0, 'min'], [18, 0, 'close']]) { smallBtn(tb, gx, gy, G[g], false); smallBtn(tb, gx, gy + 9, G[g], true); }
smallBtn(tb, 0, 18, G.shade, false); smallBtn(tb, 9, 18, G.shade, true);
smallBtn(tb, 0, 27, G.unshade, false); smallBtn(tb, 9, 27, G.unshade, true);
tb.well(0, 36, 17, 7); tb.hline(2, 39, 13, C.glowDim);                     // shade-mode mini seek
[C.glow, mix(C.glow, C.amber, 0.5), C.amber].forEach((c, i) => { tb.rect(17 + i * 3, 36, 3, 7, c); tb.vline(17 + i * 3 + 2, 36, 7, mix(c, C.edge, 0.5)); });
const LABEL = 'WEB CLASSIC PLAYER';
titleStrip(tb, 27, 0, 275, true, LABEL); titleStrip(tb, 27, 15, 275, false, LABEL);
for (const [yy, act] of [[29, true], [42, false]]) {             // windowshade strips
  titleStrip(tb, 27, yy, 275, act, '', { gaps: [[27 + 18, 50], [27 + 162, 60]] });
  tb.well(27 + 77, yy + 4, 41, 7); tb.well(27 + 124, yy + 3, 34, 8);
}
titleStrip(tb, 27, 57, 275, true, LABEL); titleStrip(tb, 27, 72, 275, false, LABEL);
for (let n = 0; n < 5; n++) for (const yy of [0, 44]) {       // clutterbar O A I D V
  const x = 304 + n * 8;
  tb.bevel(x, yy, 8, 43, C.bodyLo, C.bodyHi, C.edge, true);
  'OAIDV'.split('').forEach((ch, k) => {
    const lit = yy === 44 ? k === 1 || k === 3 : false, hot = n > 0 && k === n - 1;
    tb.mask(FONT[ch], x + 2, yy + 2 + k * 8, hot ? C.glow : lit ? mix(C.glow, C.label, 0.5) : C.label);
  });
}

// ---------------------------------------------------------------- cbuttons.bmp 136x36
const cb = new Img(136, 36, C.bodyLo);
function tri(img, x0, cy, half, dir, c) { // dir 1 = right, -1 = left
  for (let r = -half; r <= half; r++) {
    const len = half + 1 - Math.abs(r);
    for (let i = 0; i < len; i++) img.px(dir > 0 ? x0 + i : x0 + half - i, cy + r, c);
  }
}
const transport = [
  [0, 23, (x, y, c) => { cb.rect(x - 5, y - 3, 2, 7, c); tri(cb, x - 3, y, 3, -1, c); tri(cb, x + 1, y, 3, -1, c); }],
  [23, 23, (x, y, c) => tri(cb, x - 2, y, 4, 1, c)],
  [46, 23, (x, y, c) => { cb.rect(x - 4, y - 4, 3, 9, c); cb.rect(x + 1, y - 4, 3, 9, c); }],
  [69, 23, (x, y, c) => cb.rect(x - 4, y - 4, 8, 8, c)],
  [92, 22, (x, y, c) => { tri(cb, x - 5, y, 3, 1, c); tri(cb, x - 1, y, 3, 1, c); cb.rect(x + 3, y - 3, 2, 7, c); }],
];
for (const [sx, w, draw] of transport) for (const pr of [0, 1]) {
  button(cb, sx, pr * 18, w, 18, !!pr);
  draw(sx + Math.floor(w / 2) + pr, pr * 18 + 9 + pr, pr ? C.glow : C.glyph);
}
for (const pr of [0, 1]) {
  button(cb, 114, pr * 16, 22, 16, !!pr);
  const c = pr ? C.glow : C.glyph, x = 125 + pr, y = pr * 16 + 4 + pr;
  for (let r = 0; r < 4; r++) cb.hline(x - r - 1, y + r, 2 * r + 2, c);
  cb.rect(x - 4, y + 6, 8, 2, c);
}

// ---------------------------------------------------------------- playpaus.bmp 42x9
const pp = new Img(42, 9, C.lcd);
tri(pp, 2, 4, 4, 1, C.glow);
pp.rect(10, 1, 3, 7, C.amber); pp.rect(14, 1, 3, 7, C.amber);
pp.rect(20, 2, 5, 5, C.label);
pp.rect(36, 2, 2, 5, C.glow); pp.rect(39, 2, 2, 5, C.red);

// ---------------------------------------------------------------- monoster.bmp 58x24
const ms = new Img(58, 24, C.lcd);
for (const [lit, yy] of [[true, 0], [false, 12]]) {
  const c = lit ? C.glow : C.glowDim;
  ms.text('STEREO', 0, yy + 3, c); ms.text('MONO', 29 + 5, yy + 3, c);
}

// ---------------------------------------------------------------- shufrep.bmp 92x85
const sr = new Img(92, 85, C.bodyLo);
for (const on of [0, 1]) for (const pr of [0, 1]) {
  const y = on * 30 + pr * 15, o = pr;
  button(sr, 0, y, 28, 15, !!pr); led(sr, 4 + o, y + 6 + o, !!on); sr.text('REP', 10 + o, y + 5 + o, on ? C.glow : C.glyph);
  button(sr, 28, y, 47, 15, !!pr); led(sr, 32 + o, y + 6 + o, !!on); sr.text('SHUFFLE', 38 + o, y + 5 + o, on ? C.glow : C.glyph);
}
for (const [yy, on] of [[61, false], [73, true]]) for (const [x, label, pr] of [[0, 'EQ', 0], [46, 'EQ', 1], [23, 'PL', 0], [69, 'PL', 1]]) {
  button(sr, x, yy, 23, 12, !!pr); led(sr, x + 4 + pr, yy + 4 + pr, on); sr.text(label, x + 10 + pr, yy + 3 + pr, on ? C.glow : C.glyph);
}

// ---------------------------------------------------------------- numbers.bmp 99x13 (seven-segment, own design)
const nb = new Img(99, 13, C.lcd);
const SEG = { a: [2, 1, 5, 1], b: [6, 1, 2, 6], c: [6, 6, 2, 6], d: [2, 11, 5, 1], e: [1, 6, 2, 6], f: [1, 1, 2, 6], g: [2, 6, 5, 1] };
const DIG = ['abcdef', 'bc', 'abged', 'abgcd', 'fgbc', 'afgcd', 'afgedc', 'abc', 'abcdefg', 'abcdfg'];
for (let d = 0; d <= 10; d++) {
  const x0 = d * 9;
  for (const s of 'abcdefg') { const [x, y, w, h] = SEG[s]; nb.rect(x0 + x, y, w, h, C.ghost); }
  if (d < 10) for (const s of DIG[d]) { const [x, y, w, h] = SEG[s]; nb.rect(x0 + x, y, w, h, C.glow); }
}

// ---------------------------------------------------------------- text.bmp 155x18
const tx = new Img(155, 18, C.lcd);
'ABCDEFGHIJKLMNOPQRSTUVWXYZ"@'.split('').forEach((ch, i) => tx.mask(FONT[ch], i * 5, 0, C.glow));
'0123456789\x01.:()-\'!_+\\/[]~&%,=$#'.split('').forEach((ch, i) => tx.mask(FONT[ch], i * 5, 6, C.glow));
'ÅÖÄ?*'.split('').forEach((ch, i) => tx.mask(FONT[ch], i * 5, 12, C.glow));

// ---------------------------------------------------------------- posbar.bmp 307x10
const pb = new Img(307, 10, C.bodyLo);
pb.well(0, 0, 248, 10); pb.hline(2, 4, 244, C.glowDim); pb.hline(2, 5, 244, C.ghost);
for (const [x, pr] of [[248, 0], [278, 1]]) {
  button(pb, x, 0, 29, 10, !!pr);
  for (let i = 0; i < 3; i++) { pb.vline(x + 11 + i * 3, 2, 6, pr ? C.glow : C.faceLo); pb.vline(x + 12 + i * 3, 2, 6, pr ? C.glowDim : C.faceHi); }
}

// ---------------------------------------------------------------- volume.bmp / balance.bmp 68x433
function knob(img, x, y, pressed) {
  button(img, x, y, 14, 11, pressed);
  img.vline(x + 6, y + 3, 5, pressed ? C.glow : C.faceLo); img.vline(x + 7, y + 3, 5, pressed ? C.glowDim : C.faceHi);
}
const vol = new Img(68, 433, C.body);
for (let k = 0; k < 28; k++) {
  const y = k * 15; vol.well(0, y + 3, 68, 7);
  const fill = Math.round((k / 27) * 64);
  if (fill > 0) vol.vgrad(2, y + 5, fill, 3, mix(C.glowDim, C.glow, 0.35 + 0.65 * k / 27), mix(C.ghost, C.glowDim, 1));
}
knob(vol, 0, 422, true); knob(vol, 15, 422, false);
const bal = new Img(68, 433, C.body);
for (let k = 0; k < 28; k++) {
  const y = k * 15; bal.well(9, y + 3, 38, 7); bal.vline(28, y + 4, 5, C.lcdEdge);
  const half = Math.round((k / 27) * 17), c = mix(C.glow, C.amber, k / 27);
  if (half > 0) { bal.rect(28 - half, y + 5, half, 3, c); bal.rect(28, y + 5, half, 3, c); }
}
knob(bal, 0, 422, true); knob(bal, 15, 422, false);

// ---------------------------------------------------------------- eqmain.bmp 275x315
const eqm = new Img(275, 315, C.bodyLo);
eqm.brushed(0, 0, 275, 116, C.body);
eqm.bevel(0, 0, 275, 116, null, C.bodyHi, C.edge);
const sx = (i) => (i === 0 ? 21 : 60 + 18 * i);
eqm.text('PREAMP', 14, 104, C.label);
['60', '170', '310', '600', '1K', '3K', '6K', '12K', '14K', '16K'].forEach((l, i) => {
  const cx = sx(i + 1) + 7; eqm.text(l, cx - Math.floor((l.length * 5 - 1) / 2), 104, C.label);
});
eqm.text('+20DB', 44, 40, C.label); eqm.text('+0DB', 49, 67, C.label); eqm.text('-20DB', 44, 94, C.label);
eqm.well(85, 16, 115, 21);
eqm.hline(10, 34, 66, C.bodyLo); eqm.hline(10, 35, 66, C.bodyHi);
smallBtn(eqm, 0, 116, G.close, false); smallBtn(eqm, 0, 125, G.close, true);
for (const on of [0, 1]) for (const pr of [0, 1]) {
  const off = on * 118 + pr * 59;
  button(eqm, 10 + off, 119, 25, 12, !!pr); led(eqm, 14 + off + pr, 123 + pr, !!on); eqm.text('ON', 20 + off + pr, 122 + pr, on ? C.glow : C.glyph);
  button(eqm, 35 + off, 119, 33, 12, !!pr); led(eqm, 39 + off + pr, 123 + pr, !!on); eqm.text('AUTO', 45 + off + pr, 122 + pr, on ? C.glow : C.glyph);
}
for (const [yy, act] of [[134, true], [149, false]]) { titleStrip(eqm, 0, yy, 275, act, 'EQUALIZER'); smallBtn(eqm, 254, yy + 3, G.shade, false); }
// slider thumbs
for (const [yy, pr] of [[164, false], [176, true]]) {
  button(eqm, 0, yy, 11, 11, pr);
  eqm.hline(2, yy + 5, 7, pr ? C.glow : C.faceLo); eqm.hline(2, yy + 6, 7, pr ? C.glowDim : C.faceHi);
}
// 28 slider frames (f 0 = -20 dB ... 27 = +20 dB)
for (let f = 0; f < 28; f++) {
  const x = 13 + 15 * (f % 14), y = f < 14 ? 164 : 229;
  eqm.rect(x, y, 14, 63, C.body);
  eqm.well(x + 4, y + 1, 6, 61);
  const lvl = Math.round((f / 27) * 57), c = mix([40, 150, 120], [210, 236, 90], f / 27);
  if (lvl > 0) eqm.rect(x + 6, y + 60 - lvl, 2, lvl, c);
  eqm.hline(x + 1, y + 31, 2, C.label); eqm.hline(x + 11, y + 31, 2, C.label);
}
for (const [yy, pr] of [[164, false], [176, true]]) { button(eqm, 224, yy, 44, 12, pr); eqm.text('PRESETS', 229 + (pr ? 1 : 0), yy + 3 + (pr ? 1 : 0), pr ? C.glow : C.glyph); }
// graph: background, preamp line, curve colour column
eqm.rect(0, 294, 113, 19, C.lcd);
for (let x = 0; x < 113; x += 12) for (let y = 294; y < 313; y += 2) eqm.px(x, y, C.ghost);
for (let x = 0; x < 113; x += 2) eqm.px(x, 303, C.glowDim);
eqm.hline(0, 314, 113, mix(C.amber, C.lcd, 0.35));
for (let y = 0; y < 19; y++) eqm.px(115, 294 + y, mix([230, 250, 140], [70, 200, 150], y / 18));

// ---------------------------------------------------------------- eq_ex.bmp 275x56
const eqx = new Img(275, 56, C.bodyLo);
for (const [yy, act] of [[0, true], [15, false]]) {
  titleStrip(eqx, 0, yy, 275, act, '', { gaps: [[18, 36], [212, 30]] });
  eqx.text('EQ', 6, yy + 4, act ? C.glow : C.label);
  eqx.well(60, yy + 4, 99, 7); eqx.well(163, yy + 4, 45, 7);
  smallBtn(eqx, 254, yy + 3, G.unshade, false);
}
[C.glow, mix(C.glow, C.amber, 0.5), C.amber].forEach((c, i) => { eqx.rect(1 + i * 3, 30, 3, 7, c); eqx.rect(11 + i * 3, 30, 3, 7, mix(c, C.glyph, 0.3)); });
smallBtn(eqx, 1, 38, G.shade, true); smallBtn(eqx, 1, 47, G.unshade, true);
smallBtn(eqx, 11, 38, G.close, false); smallBtn(eqx, 11, 47, G.close, true);

// ---------------------------------------------------------------- text files
const vis = [
  [6, 10, 8], [26, 40, 32],                                         // 0 background, 1 grid dots
  ...Array.from({ length: 16 }, (_, i) => mix([214, 255, 150], [18, 112, 70], i / 15)), // 2 (top) .. 17 (bottom)
  ...Array.from({ length: 5 }, (_, i) => mix([196, 255, 214], [56, 150, 104], i / 4)),  // 18 .. 22 oscilloscope
  [236, 244, 236],                                                  // 23 peak dots
];
const viscolor = vis.map((c, i) => `${c.join(',')}, // ${['background', 'grid dots'][i] ?? (i < 18 ? `analyzer ${i - 1}` : i < 23 ? `scope ${i - 17}` : 'peaks')}`).join('\r\n') + '\r\n';
const pledit = '[Text]\r\nNormal=#80EEA6\r\nCurrent=#FFFFFF\r\nNormalBG=#070B09\r\nSelectedBG=#24402E\r\nFont=Arial\r\n';
const readme = 'Gunmetal - the built-in skin of winamp-web.\r\nOriginal artwork, generated procedurally by scripts/gen-original-skin.mjs.\r\nIt contains no artwork from Nullsoft or any other skin.\r\n';

// ---------------------------------------------------------------- write
mkdirSync(OUT, { recursive: true });
const sheets = { main, titlebar: tb, cbuttons: cb, playpaus: pp, monoster: ms, shufrep: sr, numbers: nb, text: tx,
  posbar: pb, volume: vol, balance: bal, eqmain: eqm, eq_ex: eqx };
const zip = {};
for (const [n, img] of Object.entries(sheets)) { const b = img.bmp(); writeFileSync(`${OUT}${n}.bmp`, b); zip[`${n}.bmp`] = new Uint8Array(b); }
for (const [n, s] of [['viscolor.txt', viscolor], ['pledit.txt', pledit], ['readme.txt', readme]]) {
  writeFileSync(`${OUT}${n}`, s, 'latin1'); zip[n] = new Uint8Array(Buffer.from(s, 'latin1'));
}
writeFileSync(WSZ, zipSync(zip, { level: 9, mtime: new Date('2026-01-01T00:00:00Z') }));
console.log(`wrote ${Object.keys(zip).length} files to ${OUT} and ${WSZ}`);
