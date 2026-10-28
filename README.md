# winamp-web

A clean-room web clone of the Winamp 2.81 classic main window, equalizer and visualizer. It covers no playlist window.
All code here was written from the observations in a private static-analysis report (O-01..O-36, H-01..H-07). No code was copied from Webamp or any other Winamp clone. Dependencies are generic: Vite, TypeScript, fflate, and playwright-core (dev, screenshots only).

## Built-in skin
The built-in default skin ("Gunmetal", `public/skins/original/`, also packed as `public/skins/original.wsz`) is
**original artwork made for this project**. It is drawn entirely by code in `scripts/gen-original-skin.mjs`
(bevels, gradients, our own 4×5 bitmap font and seven-segment digits, our own visualizer palette).
It reuses only the classic skin *format*: sheet sizes and sprite rectangles, so any classic `.wsz` skin still loads
on top of it (drag & drop or "Open skin"), with per-file fallback to the built-in sheets.
Regenerate it with `npm run skin:gen`.

**No Nullsoft / Winamp artwork is included in this repository or in `dist/`.**
For private comparison work only, `npm run skin:default` copies a local extraction into the git-ignored
`public/default-skin/`; open the dev server with `?baseSkin=local` to use it. Builds always strip that folder from `dist/`.

## Run
    npm install
    npm run dev                      # or: npm run build && npm run preview -- --port <port>
    npm run smoke -- http://localhost:<port>/ shots/smoke.png   # headless check (playwright-core + Chromium)

Extra dev/preview hostnames (reverse proxies): `VITE_ALLOWED_HOSTS=host1,host2` in the environment or in an untracked `.env.local`.

### GitHub Pages (optional)
`docs/github-pages.yml` is a ready-made workflow that builds `dist/` and deploys it to Pages.
To use it, copy it to `.github/workflows/pages.yml` and enable Pages (source: GitHub Actions) in the repo settings.

URL parameters:
- `?scale=1|2|3`
- `?visOffset=N`: the vertical baseline offset, unknown U-01. The default is 2.
- `?visMode=0|1|2`
- `?tone=1`
- `?panel=0`
- `?baseSkin=local` (dev only; uses the git-ignored local base skin if present)
- `?scrollStep=&scrollMs=`

## Approximations
See the "Build notes" section of the report. Main ones:
- FFT bin grouping is a hypothesis.
- kbps/kHz are estimates.
- The EQ graph spline is approximate.
- The PRESETS button position is assumed.
- The shade-mode mini transport buttons are not interactive.
