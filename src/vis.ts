// Visualizer (report O-13, O-30..O-35, builder notes B-5, hypothesis H-01).
// Renders into a 76x16 palette-index buffer, then to ImageData with the skin's 24 viscolors.

export interface VisConfig {
  mode: 0 | 1 | 2;          // config_sa: 0 off, 1 analyzer, 2 scope (click cycles 1->2->0->1)
  analyzerStyle: 0 | 1 | 2; // safire bits 0-1: 0 normal, 1 fire, 2 line
  scopeStyle: 0 | 1 | 2;    // safire bits 2-3: 0 dots, 1 lines, 2 solid
  thin: boolean;            // safire bit 0x20: thin (75 cols) vs thick (groups of 4)
  falloff: number;          // config_safalloff index 0..4 (default 2)
  peaks: boolean;           // config_sa_peaks (default on)
  peakFalloff: number;      // config_sa_peak_falloff index 0..4 (default 1)
  /** VERTICAL BASELINE OFFSET (open unknown U-01 / H-01): number of rows the bar/scope
   * baseline sits BELOW the bottom visible row. Code reading of fcn.0040e150 puts the base
   * at DIB row 14 while the visible window is rows 16..31 -> default 2. 0 = bars sit on row 15. */
  baselineOffset: number;
}
// O-30 defaults: config_sa=1, safire=4 (normal colours, scope=lines, thick), safalloff=2, peaks=1, peak_falloff=1
export const defaultVisConfig = (): VisConfig => ({
  mode: 1, analyzerStyle: 0, scopeStyle: 1, thin: false, falloff: 2, peaks: true, peakFalloff: 1, baselineOffset: 2,
});

const FALL = [3, 6, 12, 16, 32];          // O-32, 1/16-row units per frame
const PEAK_MUL = [1.05, 1.1, 1.2, 1.4, 1.6]; // O-32
export const VIS_W = 76, VIS_H = 16, COLS = 75;

export class Visualizer {
  buf = new Uint8Array(VIS_W * VIS_H);
  level16 = new Int32Array(COLS);
  peak256 = new Float64Array(COLS);
  peakVel = new Float64Array(COLS).fill(3);
  cfg: VisConfig;
  private freq: Uint8Array<ArrayBuffer> | null = null;
  private time: Uint8Array<ArrayBuffer> | null = null;
  constructor(cfg: VisConfig) { this.cfg = cfg; }

  private set(x: number, k: number, idx: number) {
    // k = rows above the baseline (0 = baseline row). Baseline is baselineOffset rows below row 15.
    const row = VIS_H - 1 + this.cfg.baselineOffset - k;
    if (row < 0 || row >= VIS_H || x < 0 || x >= VIS_W) return;
    this.buf[row * VIS_W + x] = idx;
  }

  /** Background per O-33: dotted rows (index 1 on even x, 0 on odd x) alternate with black rows.
   * Bottom visible row (15) is a dotted row in the code reading (DIB row 16). */
  clear() {
    for (let y = 0; y < VIS_H; y++) for (let x = 0; x < VIS_W; x++)
      this.buf[y * VIS_W + x] = ((VIS_H - 1 - y) % 2 === 0) && (x % 2 === 0) ? 1 : 0;
  }

  /**
   * HYPOTHESIS (U-02): audio -> 75 analyzer bins. The original bins come from the input/vis
   * pipeline which was not analysed. Here: AnalyserNode byte spectrum, log-spaced grouping
   * of FFT bins from ~40 Hz to ~16 kHz into 75 columns (max per group), byte/16 -> 0..15.
   */
  private spectrum75(an: AnalyserNode): Uint8Array {
    const n = an.frequencyBinCount;
    if (!this.freq || this.freq.length !== n) this.freq = new Uint8Array(n);
    an.getByteFrequencyData(this.freq);
    const out = new Uint8Array(COLS);
    const sr = an.context.sampleRate, binHz = sr / an.fftSize;
    const f0 = 40, f1 = 16000;
    for (let i = 0; i < COLS; i++) {
      const lo = f0 * Math.pow(f1 / f0, i / COLS), hi = f0 * Math.pow(f1 / f0, (i + 1) / COLS);
      let a = Math.floor(lo / binHz), b = Math.max(a, Math.floor(hi / binHz));
      let m = 0; for (let j = a; j <= b && j < n; j++) m = Math.max(m, this.freq[j]);
      out[i] = m >> 4;
    }
    return out;
  }

  private scope75(an: AnalyserNode): Int8Array {
    const n = an.fftSize;
    if (!this.time || this.time.length !== n) this.time = new Uint8Array(n);
    an.getByteTimeDomainData(this.time);
    const out = new Int8Array(COLS);
    const step = Math.floor(Math.min(n, 576) / COLS); // ~576-sample window like the vis SDK (assumption)
    for (let i = 0; i < COLS; i++) out[i] = (this.time[i * step] - 128) >> 4; // -8..7
    return out;
  }

  /** one frame; `an` null => silence (stopped) */
  frame(an: AnalyserNode | null, playing: boolean) {
    this.clear();
    const c = this.cfg;
    if (c.mode === 0) return;
    if (c.mode === 1) {
      const spec = an && playing ? this.spectrum75(an) : new Uint8Array(COLS);
      const fall = FALL[Math.min(4, c.falloff)], mul = PEAK_MUL[Math.min(4, c.peakFalloff)];
      for (let x = 0; x < COLS; x++) {
        let v: number;
        if (!c.thin) { const g = x & ~3; v = ((spec[g] ?? 0) + (spec[g + 1] ?? 0) + (spec[g + 2] ?? 0) + (spec[g + 3] ?? 0)) >> 2; }
        else v = spec[x];
        if (v > 15) v = 15;
        if (v * 16 < this.level16[x]) { this.level16[x] -= fall; v = this.level16[x] >> 4; }
        else this.level16[x] = v * 16;
        if (this.level16[x] < 0) this.level16[x] = 0;
        if (v < 0) v = 0;
        if (this.peak256[x] <= v * 256) { this.peak256[x] = v * 256; this.peakVel[x] = 3.0; }
        if (c.thin || (x & 3) !== 3) {
          const st = c.analyzerStyle;
          if (st === 2) for (let k = 0; k < v; k++) this.set(x, k, 17 - v);          // line
          else { const top = st === 1 ? v + 2 : 17; for (let k = 0; k < v; k++) this.set(x, k, top - k); } // fire / normal
          const pr = Math.floor(this.peak256[x] / 256);
          if (c.peaks && pr >= 0 && pr < 16) this.set(x, pr, 23);
        }
        this.peak256[x] -= Math.trunc(this.peakVel[x]);
        this.peakVel[x] *= mul;
        if (this.peak256[x] < 0) this.peak256[x] = 0;
      }
    } else if (c.mode === 2) {
      if (!an || !playing) return;
      const s = this.scope75(an);
      let prev = -1;
      for (let x = 0; x < COLS; x++) {
        const row = Math.max(0, Math.min(15, s[x] + 8));
        const col = 18 + Math.abs((row >> 1) - 4); // O-34
        if (c.scopeStyle === 0) this.set(x, row, col);
        else if (c.scopeStyle === 1) {
          if (prev < 0) prev = row;
          const a = Math.min(prev, row), b = Math.max(prev, row);
          for (let k = a; k <= b; k++) this.set(x, k, col);
        } else {
          if (row < 8) for (let k = row; k < 8; k++) this.set(x, k, col);
          else for (let k = 8; k <= row; k++) this.set(x, k, col);
        }
        prev = row;
      }
    }
  }

  /** O-35 (approx): 38x5 windowshade analyzer, every other column, 0..15 -> 0..5 rows. */
  shadeImage(pal: [number, number, number][]): ImageData {
    const W = 38, H = 5, img = new ImageData(W, H);
    for (let x = 0; x < W; x++) {
      const v = Math.min(5, Math.round((this.level16[x * 2] >> 4) * 5 / 15));
      for (let y = 0; y < H; y++) {
        const on = this.cfg.mode === 1 && (H - 1 - y) < v;
        const idx = on ? 17 - Math.round((H - 1 - y) * 15 / 4) : (y % 2 === 0 && x % 2 === 0 ? 1 : 0);
        const [r, g, b] = pal[idx] ?? [0, 0, 0];
        const o = (y * W + x) * 4; img.data[o] = r; img.data[o + 1] = g; img.data[o + 2] = b; img.data[o + 3] = 255;
      }
    }
    return img;
  }

  toImageData(pal: [number, number, number][], img: ImageData) {
    const d = img.data;
    for (let i = 0; i < this.buf.length; i++) {
      const [r, g, b] = pal[this.buf[i]] ?? [0, 0, 0];
      d[i * 4] = r; d[i * 4 + 1] = g; d[i * 4 + 2] = b; d[i * 4 + 3] = 255;
    }
  }
}
