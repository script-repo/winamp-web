// Playback graph (report O-25 for EQ mapping). The Web Audio filter shapes are our own
// approximation; the original EQ DSP was not analysed.
import { BAND_FREQS, valueToDb } from './eqf';

export class Player {
  ctx: AudioContext;
  el: HTMLAudioElement;
  src: MediaElementAudioSourceNode;
  preamp: GainNode;
  filters: BiquadFilterNode[];
  panner: StereoPannerNode;
  volume: GainNode;
  analyser: AnalyserNode;
  splitter: ChannelSplitterNode;
  monoAnalyser: AnalyserNode;
  toneNodes: AudioNode[] = [];
  eqOn = true;
  bands = new Array(10).fill(31);
  preampValue = 31;
  title = '';
  fileSize = 0;
  testTone = false;
  toneStart = 0;

  constructor() {
    this.ctx = new AudioContext();
    this.el = new Audio();
    this.el.crossOrigin = 'anonymous';
    this.src = this.ctx.createMediaElementSource(this.el);
    this.preamp = this.ctx.createGain();
    this.filters = BAND_FREQS.map((f, i) => {
      const b = this.ctx.createBiquadFilter();
      // 10 peaking filters at the Winamp band centres. Q ~1.4 is an assumption (EQ DSP not analysed).
      void i; b.type = 'peaking';
      b.frequency.value = f; b.Q.value = 1.4; b.gain.value = 0;
      return b;
    });
    this.panner = this.ctx.createStereoPanner();
    this.volume = this.ctx.createGain();
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0;
    this.analyser.minDecibels = -90; this.analyser.maxDecibels = -10;
    this.splitter = this.ctx.createChannelSplitter(2);
    this.monoAnalyser = this.analyser;
    let n: AudioNode = this.src;
    n.connect(this.preamp); n = this.preamp;
    for (const f of this.filters) { n.connect(f); n = f; }
    n.connect(this.panner); this.panner.connect(this.volume);
    this.volume.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);
    this.setVolume(200); this.applyEq();
  }

  /** volume 0..255 (O-19). Linear gain mapping is an assumption. */
  setVolume(v: number) { this.volume.gain.value = Math.pow(v / 255, 2); }
  /** balance -127..127 (O-19) */
  setBalance(b: number) { this.panner.pan.value = Math.max(-1, Math.min(1, b / 127)); }

  applyEq() {
    const on = this.eqOn;
    this.preamp.gain.value = on ? Math.pow(10, valueToDb(this.preampValue) / 20) : 1;
    this.filters.forEach((f, i) => { f.gain.value = on ? valueToDb(this.bands[i]) : 0; });
  }

  async playFile(file: File) {
    this.stopTone();
    if (this.el.src) URL.revokeObjectURL(this.el.src);
    this.el.src = URL.createObjectURL(file);
    this.title = file.name.replace(/\.[^.]+$/, '');
    this.fileSize = file.size;
    await this.ctx.resume();
    await this.el.play();
  }

  /** Generated test tone (for screenshots / demo): a sweep plus a few partials through the same graph. */
  startTone() {
    this.el.pause();
    this.stopTone();
    const g = this.ctx.createGain(); g.gain.value = 0.25;
    const freqs = [110, 220, 440, 880, 1760, 3520, 7040];
    for (const f of freqs) {
      const o = this.ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
      const lfo = this.ctx.createOscillator(); lfo.frequency.value = 0.3 + f / 3000;
      const lg = this.ctx.createGain(); lg.gain.value = 0.5;
      const og = this.ctx.createGain(); og.gain.value = 0.5;
      lfo.connect(lg); lg.connect(og.gain); o.connect(og); og.connect(g);
      o.start(); lfo.start(); this.toneNodes.push(o, lfo, lg, og);
    }
    g.connect(this.preamp); this.toneNodes.push(g);
    this.testTone = true; this.title = 'Test tone (generated)'; this.toneStart = this.ctx.currentTime;
    void this.ctx.resume();
  }
  stopTone() {
    for (const n of this.toneNodes) { try { (n as OscillatorNode).stop?.(); } catch { /* ignore */ } n.disconnect(); }
    this.toneNodes = []; this.testTone = false;
  }

  get state(): 'playing' | 'paused' | 'stopped' {
    if (this.testTone) return 'playing';
    if (!this.el.src || (this.el.paused && this.el.currentTime === 0)) return 'stopped';
    return this.el.paused ? 'paused' : 'playing';
  }
  get position(): number { return this.testTone ? this.ctx.currentTime - this.toneStart : this.el.currentTime || 0; }
  get duration(): number { return this.testTone ? 0 : (isFinite(this.el.duration) ? this.el.duration : 0); }
  /** kbps estimate from file size / duration (approximation; the real value comes from the decoder). */
  get kbps(): number {
    if (this.testTone) return 0;
    return this.duration > 0 ? Math.round((this.fileSize * 8) / this.duration / 1000) : 0;
  }
  /** kHz: output context rate (approximation — file sample rate not exposed by HTMLMediaElement). */
  get khz(): number { return Math.round(this.ctx.sampleRate / 1000); }
  get channels(): number { return this.state === 'stopped' ? 0 : 2; }

  play() { void this.ctx.resume(); if (this.el.src) void this.el.play(); }
  pause() { if (this.testTone) return; if (this.el.paused) void this.el.play(); else this.el.pause(); }
  stop() { this.stopTone(); this.el.pause(); if (this.el.src) this.el.currentTime = 0; }
  seek(frac: number) { if (this.duration) this.el.currentTime = frac * this.duration; }
}
