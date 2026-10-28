# winamp-web

A clean-room web clone of the Winamp 2.81 classic main window, equalizer and visualizer. It covers no playlist window.
All code here was written from the observations in a private static-analysis report (O-01..O-36, H-01..H-07). No code was copied from Webamp or any other Winamp clone. Dependencies are generic: Vite, TypeScript, fflate, and playwright-core (dev, screenshots only).

## ⚠ Artwork notice
The **default skin artwork is from the original Winamp 2.81 program (© Nullsoft).**
`npm run skin:default` copies it from a local extraction into `public/default-skin/`. That folder is git-ignored.
It **must not be redistributed**. Do not publish `dist/` or any artifact that contains `default-skin/`.
Without those files the app needs a user-supplied `.wsz` skin.

## Run
    npm install
    npm run skin:default   # needs the local extraction (private machine only)
    npm run build && npm run preview -- --port <port>

URL parameters:
- `?scale=1|2|3`
- `?visOffset=N`: the vertical baseline offset, unknown U-01. The default is 2.
- `?visMode=0|1|2`
- `?tone=1`
- `?panel=0`
- `?scrollStep=&scrollMs=`

## Approximations
See the "Build notes" section of the report. Main ones:
- FFT bin grouping is a hypothesis.
- kbps/kHz are estimates.
- The EQ graph spline is approximate.
- The PRESETS button position is assumed.
- The shade-mode mini transport buttons are not interactive.
