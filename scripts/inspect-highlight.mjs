import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
await build({entryPoints:['src/domain/news/highlightAnalysis.ts','src/test/fixtures.ts'],outdir:'dist-worker/inspect',bundle:true,platform:'node',format:'esm'});
const {analyzeHighlight}=await import(pathToFileURL(resolve('dist-worker/inspect/domain/news/highlightAnalysis.js')));
const {fixture}=await import(pathToFileURL(resolve('dist-worker/inspect/test/fixtures.js')));
const players=['山田','佐藤','田中','伊藤'].map((name,i)=>({id:`sample0${i+1}`,name,color:'#123456'}));
for(const highlight of process.argv.slice(2)){
 const a=analyzeHighlight({...fixture('inspect','2026-09-01'),highlight},players);
 console.log(JSON.stringify({highlight,diagnostics:a.diagnostics,truncated:a.lexing?.truncated,paths:a.lexing?.paths.slice(0,2).map(p=>p.map(t=>`${t.text}:${t.kind}/${t.value}`)),events:a.events.map(e=>({kind:e.kind,w:e.winnerId,d:e.discarderId,method:e.method,level:e.level,yaku:e.yaku,roles:e.roles,decision:e.decision,reasons:e.reasons,unknown:e.evidence.unresolved}))},null,2));
}
