// EQF / winamp.q1 library format (report O-23, O-24, O-25, builder notes B-4).
//   off 0   : "Winamp EQ library file v1.1" 0x1A "!--"   (31 bytes, no NUL)
//   records : 0x10C (268) bytes each
//     +0x000 char  name[257]   NUL-terminated
//     +0x101 uint8 band[10]    0..63, 0 = +20 dB (top), 31 = flat, 63 = -20 dB
//     +0x10B uint8 preamp      0..63
export const EQF_HEADER = new Uint8Array([...'Winamp EQ library file v1.1'].map((c) => c.charCodeAt(0)).concat([0x1a, 0x21, 0x2d, 0x2d]));
export const RECORD_SIZE = 0x10c;

export interface EqPreset { name: string; bands: number[]; preamp: number }

/** O-25: byte -> dB. dB = (v - 31.5)/31.5 * -20, shown/applied as 0 within +/-0.32. */
export function valueToDb(v: number): number {
  const db = ((v - 31.5) / 31.5) * -20;
  return db > -0.32 && db < 0.32 ? 0 : db;
}
/** O-25: drag snaps 30..32 to 31, clamp 0..63. */
export function snapValue(v: number): number {
  v = Math.max(0, Math.min(63, Math.trunc(v)));
  return v >= 30 && v <= 32 ? 31 : v;
}

export function parseEqLibrary(buf: ArrayBuffer | Uint8Array): EqPreset[] {
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  for (let i = 0; i < EQF_HEADER.length; i++) if (u8[i] !== EQF_HEADER[i]) throw new Error('Not a Winamp EQ library file (header mismatch)');
  const out: EqPreset[] = [];
  for (let p = EQF_HEADER.length; p + RECORD_SIZE <= u8.length; p += RECORD_SIZE) {
    let end = p; while (end < p + 257 && u8[end] !== 0) end++;
    const name = new TextDecoder('latin1').decode(u8.subarray(p, end));
    const bands = Array.from(u8.subarray(p + 0x101, p + 0x10b)).map((v) => Math.min(63, v));
    out.push({ name, bands, preamp: Math.min(63, u8[p + 0x10b]) });
  }
  return out;
}

export function buildEqLibrary(presets: EqPreset[]): Uint8Array {
  const out = new Uint8Array(EQF_HEADER.length + presets.length * RECORD_SIZE);
  out.set(EQF_HEADER, 0);
  presets.forEach((pr, i) => {
    const p = EQF_HEADER.length + i * RECORD_SIZE;
    const nm = [...pr.name].slice(0, 256).map((c) => { const k = c.charCodeAt(0); return k < 256 ? k : 63; });
    out.set(nm, p); // remaining bytes already 0 (NUL terminator + padding)
    out.set(pr.bands.slice(0, 10).map((v) => snapRaw(v)), p + 0x101);
    out[p + 0x10b] = snapRaw(pr.preamp);
  });
  return out;
}
const snapRaw = (v: number) => Math.max(0, Math.min(63, Math.round(v)));

// O-29: 17 built-in presets written to winamp.q1 at install (preamp 31). From raw/eq-builtin-presets.tsv.
const B: [string, number[]][] = [
  ['Classical', [31, 31, 31, 31, 31, 31, 44, 44, 44, 48]],
  ['Club', [31, 31, 26, 22, 22, 22, 26, 31, 31, 31]],
  ['Dance', [16, 20, 28, 32, 32, 42, 44, 44, 32, 32]],
  ['Laptop speakers/headphones', [24, 14, 23, 38, 36, 29, 24, 16, 11, 8]],
  ['Large hall', [15, 15, 22, 22, 31, 40, 40, 40, 31, 31]],
  ['Party', [20, 20, 31, 31, 31, 31, 31, 31, 20, 20]],
  ['Pop', [35, 24, 20, 19, 23, 34, 36, 36, 35, 35]],
  ['Reggae', [31, 31, 33, 42, 31, 21, 21, 31, 31, 31]],
  ['Rock', [19, 24, 41, 45, 38, 25, 17, 14, 14, 14]],
  ['Soft', [24, 29, 34, 36, 34, 25, 18, 16, 14, 12]],
  ['Ska', [36, 40, 39, 33, 25, 22, 17, 16, 14, 16]],
  ['Full Bass', [16, 16, 16, 22, 29, 39, 46, 49, 50, 50]],
  ['Soft Rock', [25, 25, 28, 33, 39, 41, 38, 33, 27, 17]],
  ['Full Treble', [48, 48, 48, 39, 27, 14, 6, 6, 6, 4]],
  ['Full Bass & Treble', [20, 22, 31, 44, 40, 29, 18, 14, 12, 12]],
  ['Live', [40, 31, 25, 23, 22, 22, 25, 27, 27, 28]],
  ['Techno', [19, 22, 31, 41, 40, 31, 19, 16, 16, 17]],
];
export const BUILTIN_PRESETS: EqPreset[] = B.map(([name, bands]) => ({ name, bands, preamp: 31 }));

export const BAND_FREQS = [60, 170, 310, 600, 1000, 3000, 6000, 12000, 14000, 16000];
export const BAND_NAMES = ['60Hz', '170Hz', '310Hz', '600Hz', '1KHz', '3KHz', '6KHz', '12KHz', '14KHz', '16KHz'];
