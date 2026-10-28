// Main window (275x116, shade 275x14). Geometry from report O-17..O-22, O-36, builder notes B-2.
import { SkinWindow, inRect, type Rect } from './win';
import type { Player } from './audio';
import { Visualizer, VIS_W, VIS_H } from './vis';
import { glyph } from './text';

type Ctl = 'menu' | 'min' | 'shadeBtn' | 'close' | 'prev' | 'play' | 'pause' | 'stop' | 'next' | 'eject'
  | 'shuffle' | 'repeat' | 'eqBtn' | 'plBtn' | 'volume' | 'balance' | 'seek' | 'time' | 'vis' | 'sseek';

const R: Record<Ctl, Rect> = {
  menu: [6, 3, 9, 9], min: [244, 3, 9, 9], shadeBtn: [254, 3, 9, 9], close: [264, 3, 9, 9],
  prev: [16, 88, 23, 18], play: [39, 88, 23, 18], pause: [62, 88, 23, 18], stop: [85, 88, 23, 18], next: [108, 88, 22, 18],
  eject: [136, 89, 22, 16], shuffle: [164, 89, 47, 15], repeat: [210, 89, 28, 15],
  eqBtn: [219, 58, 23, 12], plBtn: [242, 58, 23, 12],
  volume: [107, 57, 68, 13], balance: [177, 57, 38, 13], seek: [16, 72, 248, 10],
  time: [36, 26, 63, 13], vis: [24, 43, 76, 16], sseek: [226, 4, 17, 7],
};

export class MainWindow extends SkinWindow {
  shade = false;
  pressed: Ctl | null = null;
  hover: Ctl | null = null;
  shuffle = false; repeat = false; eqVisible = true; plOn = false;
  remaining = false;
  volume = 200; balance = 0;
  seekDrag: number | null = null; // 0..255 while dragging
  grab = 0;
  titleOffset = 0; lastScroll = 0;
  scrollStepPx = 1; scrollMs = 40; // H-06: assumption, configurable via ?scrollStep / ?scrollMs
  visImg = new ImageData(VIS_W, VIS_H);
  visCanvas = document.createElement('canvas');
  vis: Visualizer;
  lastVis = 0;
  onEject?: () => void;
  onToggleEq?: (v: boolean) => void;
  onShade?: () => void;
  constructor(public player: Player, vis: Visualizer) {
    super('main', 275, 116);
    this.vis = vis;
    this.visCanvas.width = VIS_W; this.visCanvas.height = VIS_H;
  }
  regionKey() { return this.shade ? 'windowshade' : 'normal'; }

  hit(x: number, y: number): Ctl | null {
    const list: Ctl[] = this.shade ? ['menu', 'min', 'shadeBtn', 'close', 'sseek']
      : ['menu', 'min', 'shadeBtn', 'close', 'prev', 'play', 'pause', 'stop', 'next', 'eject', 'shuffle', 'repeat',
        'eqBtn', 'plBtn', 'volume', 'balance', 'seek', 'time', 'vis'];
    for (const c of list) if (inRect(x, y, R[c])) return c;
    return null;
  }
  isTitleDrag(x: number, y: number) { return y < 14 && !this.hit(x, y); }

  private volFromX(x: number) { return Math.max(0, Math.min(255, Math.round((x - 107 - this.grab) * 255 / 51))); }
  private balFromX(x: number) { return Math.max(-127, Math.min(127, Math.round(((x - 177 - this.grab) - 12) * 127 / 12))); }
  private seekFromX(x: number) { return Math.max(0, Math.min(255, Math.round((x - 16 - this.grab) * 256 / 219))); }

  onDown(x: number, y: number) {
    const c = this.hit(x, y);
    this.pressed = c;
    if (c === 'volume') {
      const tx = 107 + Math.trunc(this.volume * 51 / 255);
      this.grab = x >= tx && x < tx + 14 ? x - tx : 7;
      this.volume = this.volFromX(x); this.player.setVolume(this.volume);
    } else if (c === 'balance') {
      const tx = 177 + Math.trunc(this.balance * 12 / 127) + 12;
      this.grab = x >= tx && x < tx + 14 ? x - tx : 7;
      this.balance = this.balFromX(x); this.player.setBalance(this.balance);
    } else if (c === 'seek' && this.player.duration > 0) {
      const tx = 16 + Math.trunc(this.seekPos() * 219 / 256);
      this.grab = x >= tx && x < tx + 29 ? x - tx : 14;
      this.seekDrag = this.seekFromX(x);
    }
  }
  onMove(x: number, y: number) {
    void y;
    if (this.pressed === 'volume') { this.volume = this.volFromX(x); this.player.setVolume(this.volume); }
    else if (this.pressed === 'balance') {
      let b = this.balFromX(x); if (Math.abs(b) < 8) b = 0; // centre snap: assumption
      this.balance = b; this.player.setBalance(b);
    } else if (this.pressed === 'seek' && this.seekDrag !== null) this.seekDrag = this.seekFromX(x);
  }
  onUp(x: number, y: number) {
    const c = this.pressed; this.pressed = null;
    if (!c) return;
    const inside = this.hit(x, y) === c;
    const p = this.player;
    if (c === 'seek') { if (this.seekDrag !== null) p.seek(this.seekDrag / 256); this.seekDrag = null; return; }
    if (c === 'sseek') { if (p.duration) p.seek(Math.max(0, Math.min(1, (x - 226) / 17))); return; }
    if (!inside) return;
    switch (c) {
      case 'play': if (p.state === 'paused') p.pause(); else p.play(); break;
      case 'pause': p.pause(); break;
      case 'stop': p.stop(); break;
      case 'prev': p.seek(0); break;
      case 'next': break; // no playlist (out of scope)
      case 'eject': this.onEject?.(); break;
      case 'shuffle': this.shuffle = !this.shuffle; break;
      case 'repeat': this.repeat = !this.repeat; break;
      case 'eqBtn': this.eqVisible = !this.eqVisible; this.onToggleEq?.(this.eqVisible); break;
      case 'plBtn': this.plOn = !this.plOn; break;
      case 'shadeBtn': this.shade = !this.shade; this.resize(275, this.shade ? 14 : 116); this.onShade?.(); break;
      case 'time': this.remaining = !this.remaining; break;
      case 'vis': this.vis.cfg.mode = (this.vis.cfg.mode === 1 ? 2 : this.vis.cfg.mode === 2 ? 0 : 1); break;
      default: break;
    }
  }

  seekPos(): number {
    const p = this.player;
    if (this.seekDrag !== null) return this.seekDrag;
    return p.duration > 0 ? Math.min(255, Math.floor(p.position / p.duration * 256)) : 0;
  }

  titleText(): string {
    const p = this.player;
    if (!p.title) return 'Winamp 2.81';
    const d = Math.round(p.duration);
    return d > 0 ? `1. ${p.title} (${Math.floor(d / 60)}:${String(d % 60).padStart(2, '0')})` : `1. ${p.title}`;
  }

  draw(now: number) {
    this.drawn = [];
    const ctx = this.ctx;
    ctx.imageSmoothingEnabled = false;
    if (this.shade) return this.drawShade(now);
    this.blit('main', 0, 0, 275, 116, 0, 0);
    this.drawn = []; // background is not a "sprite" for the diff mask
    // titlebar (O-18): src (27,0) active, (27,15) inactive
    this.blit('titlebar', 27, this.active ? 0 : 15, 275, 14, 0, 0);
    this.drawTitleButtons();
    // clutterbar (O-36): default state
    this.blit('titlebar', 304, 0, 8, 43, 10, 22);
    this.drawPlayState();
    this.drawTime(now);
    this.drawVis(now);
    this.drawTitle(now);
    this.drawInfo();
    // mono/stereo (O-18: mono (212,41) src x29, stereo (239,41) src x0; row 0 lit / 12 unlit)
    const ch = this.player.channels;
    this.blit('monoster', 29, ch === 1 ? 0 : 12, 28, 12, 212, 41);
    this.blit('monoster', 0, ch === 2 ? 0 : 12, 29, 12, 239, 41);
    // volume / balance (O-19)
    const vf = Math.trunc(this.volume * 27 / 255);
    this.blit('volume', 0, Math.min(405, vf * 15), 68, 13, 107, 57);
    const vtx = Math.max(0, Math.min(54, Math.trunc(this.volume * 51 / 255)));
    this.blit('volume', this.pressed === 'volume' ? 0 : 15, 422, 14, 11, 107 + vtx, 58);
    const bf = Math.trunc(Math.abs(this.balance) * 27 / 127);
    this.blit('balance', 9, Math.min(405, bf * 15), 38, 13, 177, 57);
    const btx = Math.max(0, Math.min(24, Math.trunc(this.balance * 12 / 127) + 12));
    this.blit('balance', this.pressed === 'balance' ? 0 : 15, 422, 14, 11, 177 + btx, 58);
    // EQ / PL toggles (shufrep y 61 off / 73 on, x +46 pressed)
    this.blit('shufrep', this.pressed === 'eqBtn' ? 46 : 0, this.eqVisible ? 73 : 61, 23, 12, 219, 58);
    this.blit('shufrep', this.pressed === 'plBtn' ? 69 : 23, this.plOn ? 73 : 61, 23, 12, 242, 58);
    // seek bar (O-18): bg 248x10, thumb 29x10 at 248 / 278 pressed
    this.blit('posbar', 0, 0, 248, 10, 16, 72);
    if (this.player.duration > 0 && this.player.state !== 'stopped') {
      const tx = Math.max(0, Math.min(219, Math.trunc(this.seekPos() * 219 / 256)));
      this.blit('posbar', this.pressed === 'seek' ? 278 : 248, 0, 29, 10, 16 + tx, 72);
    }
    // transport (cut points 0/23/46/69/92/114, pressed row 18)
    const cb: [Ctl, number, number][] = [['prev', 0, 23], ['play', 23, 23], ['pause', 46, 23], ['stop', 69, 23], ['next', 92, 22]];
    for (const [c, sx, w] of cb) this.blit('cbuttons', sx, this.pressed === c ? 18 : 0, w, 18, 16 + sx, 88);
    this.blit('cbuttons', 114, this.pressed === 'eject' ? 16 : 0, 22, 16, 136, 89);
    // shuffle / repeat: y = (on?30:0)+(pressed?15:0)
    this.blit('shufrep', 28, (this.shuffle ? 30 : 0) + (this.pressed === 'shuffle' ? 15 : 0), 47, 15, 164, 89);
    this.blit('shufrep', 0, (this.repeat ? 30 : 0) + (this.pressed === 'repeat' ? 15 : 0), 28, 15, 210, 89);
  }

  drawTitleButtons() {
    const pr = (c: Ctl) => this.pressed === c ? 9 : 0;
    this.blit('titlebar', 0, pr('menu'), 9, 9, 6, 3);
    this.blit('titlebar', 9, pr('min'), 9, 9, 244, 3);
    this.blit('titlebar', pr('shadeBtn'), this.shade ? 27 : 18, 9, 9, 254, 3);
    this.blit('titlebar', 18, pr('close'), 9, 9, 264, 3);
  }

  drawShade(now: number) {
    this.drawn = [];
    this.blit('titlebar', 27, this.active ? 29 : 42, 275, 14, 0, 0);
    this.drawTitleButtons();
    // mini seek (O-18): bg (0,36) 17x7, thumb 3x7 at 226+1..13 from (17/20/23,36)
    this.blit('titlebar', 0, 36, 17, 7, 226, 4);
    if (this.player.duration > 0) {
      let i = Math.trunc(this.seekPos() * 12 / 256) + 1; i = Math.max(1, Math.min(13, i));
      const v = i < 6 ? 0 : i < 9 ? 1 : 2;
      this.blit('titlebar', 17 + v * 3, 36, 3, 7, 226 + i, 4);
    }
    // shade time (O-20): text.bmp digits row y=6 at 129/134/139/147/152, sign at 126
    const st = this.player.state;
    if (st !== 'stopped' && !(st === 'paused' && Math.floor(now / 500) % 2)) {
      let t = Math.floor(this.player.position);
      if (this.remaining && this.player.duration) t = Math.max(0, Math.floor(this.player.duration) - t);
      const m = Math.floor(t / 60), s = t % 60;
      this.blit('text', this.remaining ? 75 : 142, this.remaining ? 6 : 0, 3, 6, 126, 4);
      if (Math.floor(m / 100)) this.blit('text', (Math.floor(m / 100) % 10) * 5, 6, 5, 6, 129, 4);
      this.blit('text', (Math.floor(m / 10) % 10) * 5, 6, 5, 6, 134, 4);
      this.blit('text', (m % 10) * 5, 6, 5, 6, 139, 4);
      this.blit('text', Math.floor(s / 10) * 5, 6, 5, 6, 147, 4);
      this.blit('text', (s % 10) * 5, 6, 5, 6, 152, 4);
    }
    // shade vis (O-31: 79,5 38x5)
    if (this.vis.cfg.mode) this.ctx.putImageData(this.vis.shadeImage(this.skin.viscolors), 79, 5);
  }

  drawPlayState() {
    const st = this.player.state;
    const sx = st === 'playing' ? 0 : st === 'paused' ? 9 : 18;
    this.blit('playpaus', sx, 0, 9, 9, 26, 28);
    if (st === 'playing') this.blit('playpaus', 36, 0, 3, 9, 24, 28);
    else this.blit('playpaus', 27, 0, 2, 9, 24, 28);
  }

  drawTime(now: number) {
    const ex = !!this.skin.bmp.nums_ex;
    const nb = ex ? 'nums_ex' : 'numbers';
    const st = this.player.state;
    const blank = (x: number) => this.blit(nb, 90, 0, 9, 13, x, 26);
    if (st === 'stopped' || (st === 'paused' && Math.floor(now / 500) % 2)) {
      for (const x of [36, 48, 60, 78, 90]) blank(x);
      return;
    }
    let t = Math.floor(this.player.position);
    const neg = this.remaining && this.player.duration > 0;
    if (neg) t = Math.max(0, Math.floor(this.player.duration) - t);
    const m = Math.floor(t / 60), s = t % 60;
    blank(36);
    if (neg) {
      if (ex) this.blit(nb, 99, 0, 9, 13, 36, 26);
      else this.blit(nb, 20, 6, 5, 1, 38, 32);
    } else if (Math.floor(m / 100)) this.blit(nb, (Math.floor(m / 100) % 10) * 9, 0, 9, 13, 36, 26);
    this.blit(nb, (Math.floor(m / 10) % 10) * 9, 0, 9, 13, 48, 26);
    this.blit(nb, (m % 10) * 9, 0, 9, 13, 60, 26);
    this.blit(nb, Math.floor(s / 10) * 9, 0, 9, 13, 78, 26);
    this.blit(nb, (s % 10) * 9, 0, 9, 13, 90, 26);
  }

  drawVis(now: number) {
    if (now - this.lastVis >= 30) { // ~33 fps tick (assumption, U-02)
      this.lastVis = now;
      this.vis.frame(this.player.analyser, this.player.state === 'playing');
    }
    this.vis.toImageData(this.skin.viscolors, this.visImg);
    this.visCanvas.getContext('2d')!.putImageData(this.visImg, 0, 0);
    this.ctx.drawImage(this.visCanvas, 24, 43);
    this.drawn.push([24, 43, 76, 16]);
  }

  /** Song title marquee (O-22): x 111..264, y 27; scroll text + "  ***  " + text when width >= 147. */
  drawTitle(now: number) {
    const s = this.titleText();
    const w = s.length * 5;
    let str = s, off = 0;
    if (w >= 147) {
      str = s + '  ***  ' + s;
      if (now - this.lastScroll >= this.scrollMs) { this.lastScroll = now; this.titleOffset += this.scrollStepPx; }
      this.titleOffset %= (w + 35);
      off = this.titleOffset;
    } else this.titleOffset = 0;
    let ci = Math.floor(off / 5), sub = off % 5, x = 111;
    while (ci < str.length && x < 265) {
      const [gx, gy] = glyph(str[ci++]);
      if (x > 259) { this.blit('text', gx, gy, 265 - x, 6, x, 27); x = 265; break; }
      this.blit('text', gx + sub, gy, 5 - sub, 6, x, 27);
      x += 5 - sub; sub = 0;
    }
    for (; x < 265; x++) this.blit('text', 4, 0, 1, 6, x, 27); // O-22 fill column
  }

  drawInfo() {
    const p = this.player;
    if (p.state === 'stopped') return;
    const dig = (v: number, x: number, lead: boolean) => {
      if (!lead) this.blit('text', 100, 12, 5, 6, x, 43);
      else this.blit('text', v * 5, 6, 5, 6, x, 43);
    };
    const k = Math.min(999, p.kbps);
    if (k > 0) {
      dig(Math.floor(k / 100) % 10, 111, k >= 100);
      dig(Math.floor(k / 10) % 10, 116, k >= 10);
      dig(k % 10, 121, true);
    }
    const hz = Math.min(99, p.khz);
    dig(Math.floor(hz / 10), 156, hz >= 10);
    dig(hz % 10, 161, true);
  }
}
