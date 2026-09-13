import { copyFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { build } from 'esbuild';
// Updated 2026-09-13: Publish the shared entry at the Pages root; keep GitHub's entry untouched.
execFileSync(process.execPath, ['node_modules/typescript/bin/tsc', '-b'], { stdio: 'inherit' });
execFileSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--outDir', 'dist-pages'], { stdio: 'inherit', env: { ...process.env, VITE_SHARED_API: '/api' } });
copyFileSync('dist-pages/shared.html', 'dist-pages/index.html');
await build({ entryPoints: ['cloudflare/pages-proxy.js'], bundle: true, format: 'esm', platform: 'browser', loader: { '.sql': 'text' }, outfile: 'dist-pages/_worker.js' });
writeFileSync('dist-pages/_routes.json', JSON.stringify({ version: 1, include: ['/api/*'], exclude: [] }));
writeFileSync('dist-pages/_headers', `/*
  X-Robots-Tag: noindex, nofollow
  Referrer-Policy: no-referrer
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  Content-Security-Policy: default-src 'self'; script-src 'self' https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'
/
  Cache-Control: no-cache
/index.html
  Cache-Control: no-cache
`);
