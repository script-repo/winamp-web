// Copies the built-in default skin bitmaps (extracted from the original winamp.exe
// resources during the RE trial) into public/default-skin/. PRIVATE LOCAL USE ONLY:
// this artwork is Nullsoft's and must not be redistributed or committed. Use it with the dev
// server and ?baseSkin=local; production builds strip public/default-skin/ from dist/.
import { mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
const src = process.env.WINAMP_RAW_BMP || join(homedir(), 'studio/re/out/winamp-281/raw/bmp');
const dst = new URL('../public/default-skin/', import.meta.url).pathname;
// resource id -> skin file name (report O-05)
const map = { 126: 'main', 127: 'cbuttons', 128: 'monoster', 129: 'playpaus', 130: 'shufrep',
  132: 'numbers', 133: 'volume', 134: 'text', 135: 'posbar', 150: 'titlebar', 194: 'eqmain',
  197: 'balance', 199: 'pledit', 228: 'mb', 231: 'eq_ex' };
mkdirSync(dst, { recursive: true });
for (const [id, name] of Object.entries(map)) {
  const f = join(src, `bmp_${id}.bmp`);
  if (!existsSync(f)) { console.error('missing', f); process.exitCode = 1; continue; }
  copyFileSync(f, join(dst, `${name}.bmp`));
}
console.log('default skin copied to', dst);
