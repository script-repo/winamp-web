// Headless smoke test: loads the app, waits for the built-in skin, fails on console errors,
// page errors or any failed/404 request, and writes a screenshot.
//   node scripts/smoke.mjs [baseUrl] [screenshot.png]
// Chromium: CHROME_PATH, else Playwright's cached headless shell.
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import os from 'node:os';
const base = process.argv[2] || 'http://localhost:4173/';
const shot = process.argv[3] || 'shots/smoke-2x.png';
const fallback = `${os.homedir()}/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell`;
const exe = process.env.CHROME_PATH || (existsSync(fallback) ? fallback : undefined);
const browser = await chromium.launch({ executablePath: exe });
const page = await browser.newPage({ viewport: { width: 1060, height: 520 } });
const errs = [], bad = [], skinReqs = [];
page.on('pageerror', (e) => errs.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
page.on('requestfailed', (r) => bad.push(`${r.url()} ${r.failure()?.errorText}`));
page.on('response', (r) => {
  if (/\/skins\/|default-skin/.test(r.url())) skinReqs.push(`${r.status()} ${new URL(r.url()).pathname}`);
  if (r.status() >= 400) bad.push(`${r.status()} ${r.url()}`);
});
await page.goto(`${base}?scale=2`);
await page.waitForFunction(() => window.__waReady, null, { timeout: 15000 });
await page.waitForTimeout(500);
const info = await page.evaluate(() => {
  const w = window.__wa;
  const lit = (c) => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] > 30) n++; return n; };
  return { skin: w.main.skin.name, sources: w.main.skin.source, mainLit: lit(w.main.canvas), eqLit: lit(w.eq.canvas),
    eqVisible: getComputedStyle(w.eq.el).display !== 'none', viscolor0: w.main.skin.viscolors[2] };
});
mkdirSync(dirname(shot), { recursive: true });
await page.screenshot({ path: shot });
await browser.close();
const missing = ['main', 'titlebar', 'cbuttons', 'playpaus', 'monoster', 'shufrep', 'numbers', 'text', 'posbar', 'volume', 'balance', 'eqmain', 'eq_ex'].filter((n) => !info.sources[n]);
const ok = !errs.length && !bad.length && !missing.length && info.mainLit > 1000 && info.eqLit > 1000 && info.eqVisible;
console.log(JSON.stringify({ ok, ...info, missing, errs, bad, skinReqs, shot }, null, 1));
process.exit(ok ? 0 : 1);
