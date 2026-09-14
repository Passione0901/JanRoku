import { build } from 'esbuild';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { cpus, platform, arch } from 'node:os';
import { resolve } from 'node:path';

// Updated 2026-09-15: Fresh Node processes measure module initialization separately from uncached and cached corpus batches.
// No participant records, browser storage, network service, or credentials are read.
const outputDirectory = resolve('dist-worker/highlight-bench');
mkdirSync(outputDirectory, { recursive: true });
const analyzerFile = resolve(outputDirectory, 'analyzer.min.mjs');
const fixturesFile = resolve(outputDirectory, 'fixtures.mjs');
const buildResult = await build({
  entryPoints: ['src/domain/news/highlightAnalysis.ts'],
  bundle: true,
  minify: true,
  platform: 'browser',
  format: 'esm',
  target: 'es2022',
  outfile: analyzerFile,
  metafile: true,
});
await build({ entryPoints: ['src/test/fixtures.ts'], bundle: true, platform: 'node', format: 'esm', outfile: fixturesFile });

const corpusPath = resolve('src/test/structured-highlight-corpus.json');
const helperPath = resolve(outputDirectory, 'sample.mjs');
writeFileSync(helperPath, `
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { fixture } from './fixtures.mjs';
const rows = JSON.parse(readFileSync(process.argv[3], 'utf8'));
const players = ['山田','佐藤','伊藤','斎藤'].map((name,i)=>({name,id:'sample0'+(i+1),color:'#123456'}));
function scoresFor(row) {
  if (row.fixtureScores) return row.fixtureScores;
  const order = players.map(p=>p.name);
  if (row.finalWinnerName) { order.splice(order.indexOf(row.finalWinnerName),1); order.unshift(row.finalWinnerName); }
  for (const [name,rank] of Object.entries(row.finalRanks??{})) { order.splice(order.indexOf(name),1); order.splice(rank-1,0,name); }
  return players.map(p=>[40000,30000,20000,10000][order.indexOf(p.name)]);
}
const games = rows.map(row=>({...fixture('bench-'+row.number,'2026-09-01',scoresFor(row)),highlight:row.text}));
global.gc?.();
const heapBefore = process.memoryUsage().heapUsed;
const importStart = performance.now();
const { analyzeHighlight } = await import(pathToFileURL(process.argv[2]).href);
const moduleInitializationMs = performance.now()-importStart;
global.gc?.();
const heapAfterImport = process.memoryUsage().heapUsed;
const firstStart = performance.now();
const first = games.map(game=>analyzeHighlight(game,players));
const firstCorpusBatchMs = performance.now()-firstStart;
const cachedCalls = games.length*100;
let cacheIdentityHits=0;
const cacheStart=performance.now();
for(let pass=0;pass<100;pass++)for(let i=0;i<games.length;i++) {
  const result=analyzeHighlight(games[i],players);
  if(result===first[i])cacheIdentityHits++;
}
const cachedCorpusBatchesMs=performance.now()-cacheStart;
global.gc?.();
const heapAfterCachedBatches=process.memoryUsage().heapUsed;
console.log(JSON.stringify({moduleInitializationMs,firstCorpusBatchMs,cachedCorpusBatchesMs,cachedCalls,cacheIdentityHits,
  corpusSize:games.length,acceptedNotes:first.filter(r=>r.events.some(e=>e.decision==='accepted')).length,
  heapModuleIncreaseBytes:heapAfterImport-heapBefore,heapModuleAnd102CacheEntriesIncreaseBytes:heapAfterCachedBatches-heapBefore}));
`);

const samples = [];
for (let sample = 0; sample < 7; sample++) {
  samples.push(JSON.parse(execFileSync(process.execPath, ['--expose-gc', helperPath, analyzerFile, corpusPath], { encoding: 'utf8' })));
}
const round = (value, digits = 1) => Number(value.toFixed(digits));
function distribution(key) {
  const values = samples.map(sample => sample[key]).sort((a,b)=>a-b);
  return { minimum: round(values[0]), median: round(values[Math.floor(values.length/2)]), maximum: round(values.at(-1)) };
}
function sizes(contents) {
  return { rawBytes: contents.length, gzipBytes: gzipSync(contents).length };
}
function oldFile(path) {
  try { return execFileSync('git', ['show', `HEAD:${path}`], { maxBuffer: 10000000, stdio: ['ignore','pipe','ignore'] }); }
  catch { return null; }
}

const resourceInputs = Object.keys(buildResult.metafile.inputs).filter(path=>path.endsWith('.json'));
const resources = resourceInputs.map(path => {
  const current = readFileSync(path);
  const previous = oldFile(path);
  const before = previous ? sizes(previous) : { rawBytes: 0, gzipBytes: 0 };
  const after = sizes(current);
  return { path, beforeAtHead: before, current: after, gzipChangeBytes: after.gzipBytes-before.gzipBytes };
});
const existingJson = resources.map(resource=>oldFile(resource.path)).filter(Boolean);
const resourceAggregate = {
  compressionModel: 'Source JSON files joined with newlines; informative only. Actual bundled size is measured separately.',
  beforeAtHead: sizes(Buffer.concat(existingJson.flatMap(buffer=>[buffer,Buffer.from('\n')]))),
  current: sizes(Buffer.concat(resources.flatMap(resource=>[readFileSync(resource.path),Buffer.from('\n')]))),
};
resourceAggregate.gzipChangeBytes=resourceAggregate.current.gzipBytes-resourceAggregate.beforeAtHead.gzipBytes;
const templates = ['headlines','daily-news','member-summaries','fictional-interviews','article-paragraphs','fictional-reader-comments','highlight-reversals']
  .map(name=>`src/content/daily-news/${name}.json`).filter(path=>existsSync(path));
const currentTemplates = Buffer.from(JSON.stringify(templates.map(path=>JSON.parse(readFileSync(path,'utf8')))));
const previousTemplates = Buffer.from(JSON.stringify(templates.map(oldFile).filter(Boolean).map(buffer=>JSON.parse(buffer.toString('utf8')))));

const assetsDirectory='dist-pages/assets';
const newsAsset=existsSync(assetsDirectory) ? readdirSync(assetsDirectory).find(name=>/^DailyNewsPage-.*\.js$/.test(name)) : null;
const latestInputMtime=Math.max(...Object.keys(buildResult.metafile.inputs).filter(path=>existsSync(path)).map(path=>statSync(path).mtimeMs));
const newsBundle=newsAsset ? {
  file: newsAsset,
  ...sizes(readFileSync(`${assetsDirectory}/${newsAsset}`)),
  buildFileModifiedAt: statSync(`${assetsDirectory}/${newsAsset}`).mtime.toISOString(),
  olderThanParserInputs: statSync(`${assetsDirectory}/${newsAsset}`).mtimeMs<latestInputMtime,
  note: 'Local built artifact only; this does not verify deployment, network transfer, browser decompression or hydration.',
} : null;

const report={
  measuredAt:new Date().toISOString(),
  environment:{runtime:process.version,platform:platform(),architecture:arch(),cpu:cpus()[0]?.model,logicalCpus:cpus().length},
  method:{
    independentFreshNodeProcesses:samples.length,
    corpus:'102 previously supplied synthetic notes; no independent real-user validation',
    moduleInitialization:'Dynamic import of a newly bundled, minified browser-target ESM in a fresh Node process. Includes module parsing, evaluation and dictionary initialization; excludes Node process startup and bundling. OS disk cache is uncontrolled.',
    firstCorpus:'First pass over 102 unique notes after import, with no analyzer cache entries. Includes normal JIT effects; fixture preparation is outside timing.',
    cache:'100 repeated passes over the identical 102 game objects; reference identity is checked to confirm cached objects are returned.',
    precision:'Times are rounded to 0.1 ms per whole batch. Per-note figures are batch-derived averages, not timer-resolution measurements of individual notes.',
    limitations:['Node on this computer only; browser and phone timings are unmeasured.','Heap deltas after explicit GC are approximate retained heap, not peak memory or total process memory.','Gzip sizes use local Node zlib defaults; actual HTTP compression and cold network latency are unmeasured.'],
  },
  milliseconds:{
    moduleInitialization:distribution('moduleInitializationMs'),
    first102Notes:distribution('firstCorpusBatchMs'),
    cached10200Calls:distribution('cachedCorpusBatchesMs'),
  },
  derivedBatchAverages:{
    firstNoteMeanMs:round(distribution('firstCorpusBatchMs').median/102,3),
    cachedNoteMeanMs:round(distribution('cachedCorpusBatchesMs').median/10200,3),
    note:'Arithmetic batch averages only; values below 0.1 ms are not evidence of equivalent per-call measurement accuracy.',
  },
  cache:{callsPerProcess:samples[0].cachedCalls,identityHitsPerProcess:samples.map(sample=>sample.cacheIdentityHits)},
  approximateRetainedHeapBytes:{module:distribution('heapModuleIncreaseBytes'),moduleAnd102CachedNotes:distribution('heapModuleAnd102CacheEntriesIncreaseBytes')},
  compression:{
    standaloneAnalyzerBundle:{file:analyzerFile,...sizes(readFileSync(analyzerFile)),note:'Measured isolated minified analyzer and its imported resources; not an extra network request in the current app.'},
    resources,resourceAggregate,
    editorialTemplates:{beforeAtHead:sizes(previousTemplates),current:sizes(currentTemplates)},
    newsBundle,
  },
  samples:samples.map(sample=>Object.fromEntries(Object.entries(sample).map(([key,value])=>[key,key.endsWith('Ms')?round(value):value]))),
};
const reportPath=resolve(outputDirectory,'report.json');
writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({reportPath,environment:report.environment,milliseconds:report.milliseconds,derivedBatchAverages:report.derivedBatchAverages,
  cache:report.cache,analyzerGzipBytes:report.compression.standaloneAnalyzerBundle.gzipBytes,resourceGzipChangeBytes:resourceAggregate.gzipChangeBytes,
  newsBundle:report.compression.newsBundle,limitations:report.method.limitations},null,2));
