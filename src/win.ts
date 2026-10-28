// Generic skinned window: one canvas at native size, CSS-scaled by an integer factor.
import type { BitmapName, Region, Skin } from './skin';

export type Rect = [number, number, number, number];
export const inRect = (x: number, y: number, r: Rect) => x >= r[0] && y >= r[1] && x < r[0] + r[2] && y < r[1] + r[3];

export abstract class SkinWindow {
  el: HTMLDivElement;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  skin!: Skin;
  scale = 1;
  w: number; h: number;
  active = false;
  /** dest rects blitted this frame (used by the pixel-diff check) */
  drawn: Rect[] = [];
  onActivate?: () => void;
  private dragOff: [number, number] | null = null;

  constructor(public id: string, w: number, h: number) {
    this.w = w; this.h = h;
    this.el = document.createElement('div');
    this.el.className = 'wa-window'; this.el.id = id;
    this.canvas = document.createElement('canvas');
    this.canvas.width = w; this.canvas.height = h;
    this.el.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d')!;
    this.ctx.imageSmoothingEnabled = false;
    this.canvas.addEventListener('pointerdown', (e) => this.pointer(e, 'down'));
    this.canvas.addEventListener('pointermove', (e) => this.pointer(e, 'move'));
    this.canvas.addEventListener('pointerup', (e) => this.pointer(e, 'up'));
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  resize(w: number, h: number) {
    if (w === this.w && h === this.h) return;
    this.w = w; this.h = h; this.canvas.width = w; this.canvas.height = h;
    this.ctx.imageSmoothingEnabled = false;
    this.applyLayout();
  }
  setScale(s: number) { this.scale = s; this.applyLayout(); }
  applyLayout() {
    this.canvas.style.width = `${this.w * this.scale}px`;
    this.canvas.style.height = `${this.h * this.scale}px`;
    this.applyRegion();
  }
  abstract regionKey(): string;
  /** region.txt as CSS clip-path (O-15). Polygons are combined with evenodd fill (assumption, U-04). */
  applyRegion() {
    const r: Region | null | undefined = this.skin?.regions?.[this.regionKey()];
    if (!r) { this.el.style.clipPath = ''; return; }
    let p = 0; let d = '';
    const s = this.scale;
    for (const n of r.numPoints) {
      if (n <= 0) continue;
      for (let i = 0; i < n && p + 1 < r.points.length; i++, p += 2)
        d += `${i === 0 ? 'M' : 'L'}${r.points[p] * s},${r.points[p + 1] * s} `;
      d += 'Z ';
    }
    this.el.style.clipPath = d ? `path(evenodd, "${d.trim()}")` : '';
  }
  move(x: number, y: number) { this.el.style.left = `${x}px`; this.el.style.top = `${y}px`; }

  blit(name: BitmapName, sx: number, sy: number, w: number, h: number, dx: number, dy: number) {
    const b = this.skin.bmp[name];
    if (!b || w <= 0 || h <= 0) return;
    // clip src to the bitmap (smaller custom skins)
    const cw = Math.min(w, b.width - sx), ch = Math.min(h, b.height - sy);
    if (cw <= 0 || ch <= 0) return;
    this.ctx.drawImage(b, sx, sy, cw, ch, dx, dy, cw, ch);
    this.drawn.push([dx, dy, cw, ch]);
  }

  private pointer(e: PointerEvent, kind: 'down' | 'move' | 'up') {
    const r = this.canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - r.left) / this.scale), y = Math.floor((e.clientY - r.top) / this.scale);
    if (kind === 'down') {
      this.canvas.setPointerCapture(e.pointerId);
      this.onActivate?.();
      if (this.isTitleDrag(x, y)) {
        const er = this.el.getBoundingClientRect();
        this.dragOff = [e.clientX - er.left, e.clientY - er.top]; return;
      }
      this.onDown(x, y, e);
    } else if (kind === 'move') {
      if (this.dragOff) { this.move(e.clientX - this.dragOff[0], e.clientY - this.dragOff[1]); return; }
      this.onMove(x, y, e);
    } else {
      if (this.dragOff) { this.dragOff = null; return; }
      this.onUp(x, y, e);
    }
  }
  abstract isTitleDrag(x: number, y: number): boolean;
  abstract onDown(x: number, y: number, e: PointerEvent): void;
  abstract onMove(x: number, y: number, e: PointerEvent): void;
  abstract onUp(x: number, y: number, e: PointerEvent): void;
  abstract draw(now: number): void;
}
