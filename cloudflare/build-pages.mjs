import { copyFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
// Updated 2026-09-13: Publish the shared entry at the Pages root; keep GitHub's entry untouched.
execFileSync(process.execPath, ['node_modules/typescript/bin/tsc', '-b'], { stdio: 'inherit' });
execFileSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--outDir', 'dist-pages'], { stdio: 'inherit', env: { ...process.env, VITE_SHARED_API: '/api' } });
copyFileSync('dist-pages/shared.html', 'dist-pages/index.html');
copyFileSync('cloudflare/pages-proxy.js', 'dist-pages/_worker.js');
writeFileSync('dist-pages/_routes.json', JSON.stringify({ version: 1, include: ['/api/*'], exclude: [] }));
writeFileSync('dist-pages/_headers', '/*\n  X-Robots-Tag: noindex, nofollow\n  Referrer-Policy: no-referrer\n  X-Content-Type-Options: nosniff\n/\n  Cache-Control: no-cache\n/index.html\n  Cache-Control: no-cache\n');
