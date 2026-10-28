// Equalizer window (275x116, shade 275x14). Geometry from report O-25..O-28, builder notes B-4.
import { SkinWindow, inRect, type Rect } from './win';
import type { Player } from './audio';
import { snapValue, valueToDb, BAND_NAMES } from './eqf';

type Ctl = 'on' | 'auto' | 'presets' | 'close' | 'shadeBtn' | `s${number}` | 'svol' | 'sbal';
// slider index 0 = preamp (x=21), 1..10 bands x = 60 + 18*i (O-26)
const sliderX = (i: number) => (i === 0 ? 21 : 60 + 18 * i);
// PRESETS button position (217,18) 44x12 is NOT observed in the binary (assumption); sprite src (224,164)/(224,176).
const R: Record<string, Rect> = {
  on: [14, 18, 25, 12], auto: [39, 18, 33, 12], presets: [217, 18, 44, 12],
  close: [264, 3, 9, 9], shadeBtn: [254, 3, 9, 9],
  svol: [61, 4, 97, 7], sbal: [164, 4, 42, 7],
};

export class EqWindow extends SkinWindow {
  shade = false;
  pressed: Ctl | null = null;
  auto = false;
  grab = 5;
  tooltip = '';
  onPresets?: (x: number, y: number) => void;
  onClose?: () => void;
  getMainVolume?: () => number; setMainVolume?: (v: number) => void;
  getMainBalance?: () => number; setMainBalance?: (v: number) => void;
  constructor(public player: Player) { super('eq', 275, 116); }
  regionKey() { return this.shade ? 'equalizerws' : 'equalizer'; }

  value(i: number) { return i === 0 ? this.player.preampValue : this.player.bands[i - 1]; }
  setValue(i: number, v: number) {
    v = snapValue(v);
    if (i === 0) this.player.preampValue = v; else this.player.bands[i - 1] = v;
    this.player.applyEq();
    const db = valueToDb(v);
    const a = Math.abs(db);
    this.tooltip = `EQ: ${i === 0 ? 'PREAMP' : BAND_NAMES[i - 1]}: ${db > 0 ? '+' : db < 0 ? '-' : ''}${Math.floor(a)}.${Math.floor((a * 10) % 10)} db`;
    this.canvas.title = this.tooltip;
  }
  /** thumb y per O-26: 89 + trunc((v*13-819)*4/64) */
  thumbY(v: number) { return 89 + Math.trunc(((v * 13 - 819) * 4) / 64); }

  hit(x: number, y: number): Ctl | null {
    if (this.shade) {
      for (const c of ['close', 'shadeBtn', 'svol', 'sbal'] as const) if (inRect(x, y, R[c])) return c;
      return null;
    }
    for (const c of ['on', 'auto', 'presets', 'close', 'shadeBtn'] as const) if (inRect(x, y, R[c])) return c;
    for (let i = 0; i <= 10; i++) if (inRect(x, y, [sliderX(i), 38, 14, 63])) return `s${i}`;
    return null;
  }
  isTitleDrag(x: number, y: number) { return y < 14 && !this.hit(x, y); }

  private sliderFromY(y: number) { return ((y - this.grab - 38) * 64) / 52; } // inverse of O-26 thumb mapping
  onDown(x: number, y: number) {
    const c = this.hit(x, y); this.pressed = c;
    if (c && c.startsWith('s') && c !== 'shadeBtn' && c !== 'svol' && c !== 'sbal') {
      const i = +c.slice(1); const ty = this.thumbY(this.value(i));
      this.grab = y >= ty && y < ty + 11 ? y - ty : 5;
      this.setValue(i, this.sliderFromY(y));
    } else if (c === 'svol' || c === 'sbal') this.onMove(x, y);
  }
  onMove(x: number, y: number) {
    const c = this.pressed;
    if (!c) return;
    if (c === 'svol') this.setMainVolume?.(Math.max(0, Math.min(255, Math.round((x - 62) * 255 / 94))));
    else if (c === 'sbal') this.setMainBalance?.(Math.max(-127, Math.min(127, Math.round((x - 165) * 255 / 39) - 128)));
    else if (c.startsWith('s') && c !== 'shadeBtn') this.setValue(+c.slice(1), this.sliderFromY(y));
  }
  onUp(x: number, y: number) {
    const c = this.pressed; this.pressed = null;
    if (!c || this.hit(x, y) !== c) return;
    if (c === 'on') { this.player.eqOn = !this.player.eqOn; this.player.applyEq(); }
    else if (c === 'auto') this.auto = !this.auto;
    else if (c === 'presets') { const r = this.canvas.getBoundingClientRect(); this.onPresets?.(r.left + 217 * this.scale, r.top + 30 * this.scale); }
    else if (c === 'close') this.onClose?.();
    else if (c === 'shadeBtn') { this.shade = !this.shade; this.resize(275, this.shade ? 14 : 116); }
  }

  draw() {
    this.drawn = [];
    if (this.shade) return this.drawShade();
    this.blit('eqmain', 0, 0, 275, 116, 0, 0);
    this.drawn = [];
    this.blit('eqmain', 0, this.active ? 134 : 149, 275, 14, 0, 0); // O-28
    // shade toggle / close (O-28; pressed shade from eq_ex (1,38) — Med confidence)
    if (this.pressed === 'shadeBtn') this.blit('eq_ex', 1, 38, 9, 9, 254, 3);
    else this.blit('eqmain', 254, 137, 9, 9, 254, 3);
    this.blit('eqmain', 0, this.pressed === 'close' ? 125 : 116, 9, 9, 264, 3);
    // ON / AUTO (O-27)
    const p = this.player;
    this.blit('eqmain', 10 + (p.eqOn ? 118 : 0) + (this.pressed === 'on' ? 59 : 0), 119, 25, 12, 14, 18);
    this.blit('eqmain', 35 + (this.auto ? 118 : 0) + (this.pressed === 'auto' ? 59 : 0), 119, 33, 12, 39, 18);
    this.blit('eqmain', 224, this.pressed === 'presets' ? 176 : 164, 44, 12, 217, 18);
    this.drawGraph();
    for (let i = 0; i <= 10; i++) {
      const v = this.value(i), x = sliderX(i);
      const f = 27 - ((v * 28) >> 6);
      if (f < 14) this.blit('eqmain', 13 + f * 15, 164, 14, 63, x, 38);
      else this.blit('eqmain', 13 + (f - 14) * 15, 229, 14, 63, x, 38);
      this.blit('eqmain', 0, this.pressed === `s${i}` ? 176 : 164, 11, 11, x + 1, this.thumbY(v));
    }
  }

  /** O-27 response graph (Med): bg (86,17) 113x19 from (0,294); preamp line from (0,314);
   * curve colour from column (115,294+y). Spline is our own natural cubic through the 10 bands. */
  drawGraph() {
    this.blit('eqmain', 0, 294, 113, 19, 86, 17);
    const p = this.player;
    const py = Math.round(((63 - p.preampValue) * 18) / 63); // approximation of the ftol term
    this.blit('eqmain', 0, 314, 113, 1, 86, 35 - py);
    const ys = p.bands.map((v) => (v * 18) / 63);
    const n = ys.length, xs = ys.map((_, i) => (i * 108) / (n - 1));
    // natural cubic spline second derivatives
    const m = new Array(n).fill(0), u = new Array(n).fill(0);
    for (let i = 1; i < n - 1; i++) {
      const sig = (xs[i] - xs[i - 1]) / (xs[i + 1] - xs[i - 1]);
      const q = sig * m[i - 1] + 2;
      m[i] = (sig - 1) / q;
      u[i] = (6 * ((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]) - (ys[i] - ys[i - 1]) / (xs[i] - xs[i - 1])) / (xs[i + 1] - xs[i - 1]) - sig * u[i - 1]) / q;
    }
    for (let k = n - 2; k >= 0; k--) m[k] = m[k] * m[k + 1] + u[k];
    const evalAt = (x: number) => {
      let k = Math.min(n - 2, Math.floor(x / (108 / (n - 1))));
      const h = xs[k + 1] - xs[k], a = (xs[k + 1] - x) / h, b = (x - xs[k]) / h;
      return a * ys[k] + b * ys[k + 1] + ((a * a * a - a) * m[k] + (b * b * b - b) * m[k + 1]) * h * h / 6;
    };
    let prev = -1;
    for (let i = 0; i <= 108; i++) {
      const y = Math.max(0, Math.min(18, Math.round(evalAt(i))));
      const a = prev < 0 ? y : Math.min(prev, y), b = prev < 0 ? y : Math.max(prev, y);
      for (let yy = a; yy <= b; yy++) this.blit('eqmain', 115, 294 + yy, 1, 1, 88 + i, 17 + yy);
      prev = y;
    }
  }

  drawShade() {
    this.blit('eq_ex', 0, this.active ? 0 : 15, 275, 14, 0, 0);
    const vol = this.getMainVolume?.() ?? 200, bal = this.getMainBalance?.() ?? 0;
    this.blit('eq_ex', Math.floor((vol * 3) / 256) * 3 + 1, 30, 3, 7, Math.floor((vol * 94) / 255) + 61, 4);
    const bv = bal + 128;
    this.blit('eq_ex', Math.floor((bv * 3) / 256) * 3 + 11, 30, 3, 7, Math.floor((bv * 39) / 255) + 164, 4);
    this.blit('eq_ex', this.pressed === 'shadeBtn' ? 1 : 254, this.pressed === 'shadeBtn' ? 47 : 3, 9, 9, 254, 3);
    this.blit('eq_ex', 11, this.pressed === 'close' ? 47 : 38, 9, 9, 264, 3);
  }
}
