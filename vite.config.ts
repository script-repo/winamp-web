import { defineConfig, loadEnv } from 'vite';
import { rmSync } from 'node:fs';
import { resolve } from 'node:path';

// Extra hostnames for the dev/preview servers (e.g. a reverse proxy) come from VITE_ALLOWED_HOSTS
// (comma separated), read from the environment or an untracked .env.local.
export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env };
  const hosts = (env.VITE_ALLOWED_HOSTS ?? '').split(',').map((h) => h.trim()).filter(Boolean);
  const allowedHosts = hosts.length ? hosts : undefined;
  let outDir = 'dist';
  return {
    base: './',
    preview: { host: true, strictPort: true, allowedHosts },
    server: { host: true, allowedHosts },
    plugins: [{
      // public/default-skin/ is a git-ignored, local-only copy of non-redistributable artwork.
      // Never let it reach a build: dist/ must contain only original assets.
      name: 'strip-local-base-skin',
      apply: 'build',
      configResolved(c) { outDir = resolve(c.root, c.build.outDir); },
      closeBundle() { rmSync(resolve(outDir, 'default-skin'), { recursive: true, force: true }); },
    }],
  };
});
