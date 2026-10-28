import { chromium } from 'playwright-core';
import { writeFileSync } from 'node:fs';
import os from 'node:os';
const exe = `${os.homedir()}/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell`;
const base = process.argv[2] || 'http://localhost:47281/';
const browser = await chromium.launch({ executablePath: exe, args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1060, height: 520 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
async function open(qs) { await page.goto(base + qs); await page.waitForFunction(() => window.__waReady); await page.waitForTimeout(400); }
// 1) main + EQ, default skin, 2x
await open('?scale=2');
await page.screenshot({ path: 'shots/main-eq-2x.png' });
// 2) test tone, analyzer moving (2x) — take two frames to prove motion
await open('?scale=2&tone=1');
await page.evaluate(() => { const w = window.__wa; w.player.ctx?.resume?.(); });
await page.waitForTimeout(1500);
await page.screenshot({ path: 'shots/tone-analyzer-2x-a.png' });
await page.waitForTimeout(300);
await page.screenshot({ path: 'shots/tone-analyzer-2x-b.png' });
const st = await page.evaluate(() => { const w = window.__wa; return { state: w.player.state, ctx: w.player.ctx?.state, nz: Array.from(w.vis.buf).filter((v) => v > 1).length }; });
// scope too
await page.evaluate(() => { window.__wa.cfg.mode = 2; });
await page.waitForTimeout(500);
await page.screenshot({ path: 'shots/tone-scope-2x.png' });
// EQ with a preset applied (Rock) to show the graph
await page.evaluate(() => { const w = window.__wa; const p = w.library().find((l) => l.name === 'Rock'); if (p) w.applyPreset(p); w.cfg.mode = 1; });
await page.waitForTimeout(300);
await page.screenshot({ path: 'shots/tone-eq-rock-2x.png' });
// 3) 1x stopped render for pixel diff
await open('?scale=1&panel=0');
const out = await page.evaluate(() => {
  const w = window.__wa; const c = w.main.canvas;
  return { png: c.toDataURL('image/png'), drawn: w.main.drawn, w: c.width, h: c.height };
});
writeFileSync('shots/main-1x-canvas.png', Buffer.from(out.png.split(',')[1], 'base64'));
writeFileSync('shots/main-1x-drawn.json', JSON.stringify(out.drawn));
await page.screenshot({ path: 'shots/main-eq-1x.png', clip: { x: 0, y: 0, width: 320, height: 260 } });
console.log(JSON.stringify({ st, canvas: [out.w, out.h], drawnRects: out.drawn.length, errs }));
await browser.close();
