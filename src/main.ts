import { loadDefaultSkin, loadWsz, type Skin } from './skin';
import { Player } from './audio';
import { MainWindow } from './mainwin';
import { EqWindow } from './eqwin';
import { Visualizer, defaultVisConfig } from './vis';
import { BUILTIN_PRESETS, buildEqLibrary, parseEqLibrary, type EqPreset } from './eqf';

const q = new URLSearchParams(location.search);
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const desk = $('desk');

const player = new Player();
const cfg = defaultVisConfig();
if (q.has('visOffset')) cfg.baselineOffset = parseInt(q.get('visOffset')!, 10) || 0;
if (q.has('visMode')) cfg.mode = (parseInt(q.get('visMode')!, 10) as 0 | 1 | 2);
const vis = new Visualizer(cfg);
const main = new MainWindow(player, vis);
const eq = new EqWindow(player);
if (q.has('scrollStep')) main.scrollStepPx = +q.get('scrollStep')!;
if (q.has('scrollMs')) main.scrollMs = +q.get('scrollMs')!;
if (q.has('panel') && q.get('panel') === '0') document.body.classList.add('hide-panel');
desk.append(main.el, eq.el);

let scale = Math.max(1, Math.min(4, parseInt(q.get('scale') || '2', 10) || 2));
function layout() {
  main.setScale(scale); eq.setScale(scale);
  main.move(20, 20);
  eq.move(20, 20 + main.h * scale);
}
const setActive = (w: 'main' | 'eq') => { main.active = w === 'main'; eq.active = w === 'eq'; };
main.onActivate = () => setActive('main');
eq.onActivate = () => setActive('eq');
setActive('main');
main.onToggleEq = (v) => { eq.el.style.display = v ? '' : 'none'; };
eq.onClose = () => { main.eqVisible = false; eq.el.style.display = 'none'; };
eq.getMainVolume = () => main.volume; eq.setMainVolume = (v) => { main.volume = v; player.setVolume(v); };
eq.getMainBalance = () => main.balance; eq.setMainBalance = (v) => { main.balance = v; player.setBalance(v); };
player.setVolume(main.volume);

function applySkin(s: Skin) {
  main.skin = s; eq.skin = s;
  main.applyLayout(); eq.applyLayout();
  $('skinname').textContent = `— ${s.name}`;
  console.info('skin sources', s.source);
}

// ---- presets (O-23/O-24/O-29). User library persisted in localStorage as a winamp.q1 image.
const LS = 'winamp-web.q1';
function loadLibrary(): EqPreset[] {
  const b64 = localStorage.getItem(LS);
  if (!b64) return BUILTIN_PRESETS.map((p) => ({ ...p, bands: [...p.bands] }));
  try { return parseEqLibrary(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))); }
  catch { return BUILTIN_PRESETS.map((p) => ({ ...p })); }
}
function saveLibrary(lib: EqPreset[]) {
  const bytes = buildEqLibrary(lib);
  localStorage.setItem(LS, btoa(String.fromCharCode(...bytes)));
}
let library = loadLibrary();
const current = (name: string): EqPreset => ({ name, bands: [...player.bands], preamp: player.preampValue });
function applyPreset(p: EqPreset) {
  player.bands = p.bands.slice(0, 10); player.preampValue = p.preamp; player.applyEq();
}
function download(name: string, bytes: Uint8Array) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([bytes as unknown as BlobPart], { type: 'application/octet-stream' }));
  a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
async function importEq(file: File) {
  const recs = parseEqLibrary(await file.arrayBuffer());
  if (!recs.length) return;
  if (/\.q1$/i.test(file.name) || recs.length > 1) {
    for (const r of recs) { const i = library.findIndex((l) => l.name.toLowerCase() === r.name.toLowerCase()); if (i >= 0) library[i] = r; else library.push(r); }
    saveLibrary(library);
  }
  applyPreset(recs[0]);
}
const menu = $('menu');
function showMenu(x: number, y: number) {
  menu.innerHTML = '';
  const item = (label: string, fn: () => void) => { const d = document.createElement('div'); d.textContent = label; d.onclick = () => { menu.hidden = true; fn(); }; menu.append(d); };
  const sep = () => menu.append(document.createElement('hr'));
  for (const p of library) item(p.name, () => applyPreset(p));
  sep();
  item('Load from EQF / winamp.q1…', () => $('file-eq').click());
  item('Save current as preset…', () => {
    const n = prompt('Preset name', 'My preset'); if (!n) return;
    const i = library.findIndex((l) => l.name.toLowerCase() === n.toLowerCase());
    if (i >= 0) library[i] = current(n); else library.push(current(n)); saveLibrary(library);
  });
  item('Export current to .eqf…', () => download('preset.eqf', buildEqLibrary([current('Entry1')])));
  item('Export library as winamp.q1…', () => download('winamp.q1', buildEqLibrary(library)));
  item('Delete library changes (reset to 17 built-ins)', () => { localStorage.removeItem(LS); library = loadLibrary(); });
  item('Reset (flat)', () => applyPreset({ name: 'flat', bands: new Array(10).fill(31), preamp: 31 }));
  menu.style.left = `${x}px`; menu.style.top = `${y}px`; menu.hidden = false;
}
eq.onPresets = showMenu;
document.addEventListener('pointerdown', (e) => { if (!menu.contains(e.target as Node)) menu.hidden = true; }, true);

// AUTO (H-04, approximate): per-file preset remembered by file name
async function playFile(f: File) {
  await player.playFile(f);
  if (eq.auto) { const p = library.find((l) => l.name.toLowerCase() === f.name.toLowerCase()); if (p) applyPreset(p); }
}

// ---- file inputs / drag & drop
$('btn-audio').onclick = () => $('file-audio').click();
$('btn-skin').onclick = () => $('file-skin').click();
$('btn-default').onclick = async () => applySkin(await loadDefaultSkin());
$('btn-tone').onclick = () => { if (player.testTone) player.stop(); else player.startTone(); };
main.onEject = () => $('file-audio').click();
($('file-audio') as HTMLInputElement).onchange = (e) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) void playFile(f); };
($('file-skin') as HTMLInputElement).onchange = async (e) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) applySkin(await loadWsz(await f.arrayBuffer(), f.name)); };
($('file-eq') as HTMLInputElement).onchange = (e) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) void importEq(f).catch((err) => alert(err)); };
document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('drop', async (e) => {
  e.preventDefault();
  const f = e.dataTransfer?.files?.[0]; if (!f) return;
  try {
    if (/\.(wsz|zip)$/i.test(f.name)) applySkin(await loadWsz(await f.arrayBuffer(), f.name));
    else if (/\.(eqf|q1)$/i.test(f.name)) await importEq(f);
    else await playFile(f);
  } catch (err) { alert(String(err)); }
});

// ---- debug panel bindings
const bindNum = (id: string, get: () => number, set: (v: number) => void) => {
  const el = $(id) as HTMLInputElement | HTMLSelectElement; el.value = String(get());
  el.onchange = () => set(parseInt(el.value, 10));
};
bindNum('visOffset', () => cfg.baselineOffset, (v) => { cfg.baselineOffset = v; });
bindNum('visMode', () => cfg.mode, (v) => { cfg.mode = v as 0 | 1 | 2; });
bindNum('visStyle', () => cfg.analyzerStyle, (v) => { cfg.analyzerStyle = v as 0 | 1 | 2; });
bindNum('scopeStyle', () => cfg.scopeStyle, (v) => { cfg.scopeStyle = v as 0 | 1 | 2; });
bindNum('falloff', () => cfg.falloff, (v) => { cfg.falloff = v; });
bindNum('peakFalloff', () => cfg.peakFalloff, (v) => { cfg.peakFalloff = v; });
const thin = $('visThin') as HTMLInputElement; thin.checked = cfg.thin; thin.onchange = () => { cfg.thin = thin.checked; };
const pk = $('peaks') as HTMLInputElement; pk.checked = cfg.peaks; pk.onchange = () => { cfg.peaks = pk.checked; };
document.querySelectorAll<HTMLInputElement>('input[name=scale]').forEach((r) => {
  r.checked = +r.value === scale; r.onchange = () => { scale = +r.value; layout(); };
});
setInterval(() => { const el = $('visMode') as HTMLSelectElement; if (document.activeElement !== el) el.value = String(cfg.mode); }, 300);

// ---- loop
function frame(now: number) {
  if (main.skin) { main.draw(now); eq.draw(); }
  requestAnimationFrame(frame);
}

// expose for automated screenshots / pixel-diff
(window as unknown as Record<string, unknown>).__wa = { main, eq, player, vis, cfg, applyPreset, library: () => library };

(async () => {
  applySkin(await loadDefaultSkin());
  layout();
  requestAnimationFrame(frame);
  if (q.get('tone') === '1') player.startTone();
  (window as unknown as Record<string, unknown>).__waReady = true;
})();
