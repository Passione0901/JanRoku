import { createGroup } from './create-group.js';
import { invitation } from './invitation.js';
import api from './api.js';
// Updated 2026-09-14: Direct D1 access avoids a second Worker invocation for every API request.
export default {async fetch(request,env){
 const url=new URL(request.url);
 if(!url.pathname.startsWith('/api/'))return env.ASSETS.fetch(request);
 const origin=request.headers.get('Origin');
 if(origin&&origin!==url.origin&&origin!=='https://passione0901.github.io')return new Response('Forbidden',{status:403});
 const path=url.pathname.slice(4);let response;
 if(request.method==='OPTIONS')response=new Response(null,{status:204});
 else if(path==='/config')response=Response.json({turnstileSiteKey:env.TURNSTILE_SITE_KEY||'',creationEnabled:env.CREATION_ENABLED!=='false',contact:'onemahjongplayer@gmail.com'});
 else if(path==='/groups')response=await createGroup(request,env);
 else if(path==='/invitation')response=await invitation(request,env);
 else {
  const headers=new Headers(request.headers);headers.delete('Origin');
  response=await api.fetch(new Request(url.origin+path+url.search,{method:request.method,headers,body:['GET','HEAD'].includes(request.method)?undefined:request.body}),env);
 }
 const headers=new Headers(response.headers);headers.delete('Access-Control-Allow-Origin');
 if(origin)headers.set('Access-Control-Allow-Origin',origin);
 headers.set('Access-Control-Allow-Headers','Authorization, Content-Type');headers.set('Access-Control-Allow-Methods','GET, POST, OPTIONS');headers.set('Vary','Origin');headers.set('Cache-Control','no-store');headers.set('X-Content-Type-Options','nosniff');
 return new Response(response.body,{status:response.status,headers});
}};
