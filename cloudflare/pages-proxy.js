import { createGroup } from './create-group.js';
// Updated 2026-09-13: Group creation uses a D1 binding; existing record APIs retain their authentication.
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    const origin = request.headers.get('Origin');
    if (origin && origin !== url.origin) return new Response('Forbidden', { status: 403 });
    const path = url.pathname.slice(4);
    if (path === '/groups') return createGroup(request, env);
    if (!['/sync','/mutation','/trash','/health'].includes(path)) return new Response('Not found', { status:404 });
    const headers = new Headers();
    for (const name of ['Authorization','Content-Type']) {
      const value = request.headers.get(name); if (value) headers.set(name,value);
    }
    const response = await fetch('https://janroku-api.janroku-one.workers.dev' + path + url.search, {
      method: request.method, headers, body: ['GET','HEAD'].includes(request.method) ? undefined : request.body, redirect: 'manual',
    });
    const outgoing = new Headers(response.headers);
    outgoing.delete('Access-Control-Allow-Origin'); outgoing.set('Cache-Control','no-store');
    return new Response(response.body,{ status:response.status, headers:outgoing });
  },
};
