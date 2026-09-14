import dictionary from '../../content/daily-news/highlight-dictionary.json';
import lexicon from '../../content/daily-news/highlight-lexicon.json';
import type { Player } from '../types';
import type { HighlightLexing, HighlightToken, LexemeKind } from './highlightTypes';

export const HIGHLIGHT_LEXER_VERSION = `6.${lexicon.version}.${dictionary.version}`;
export const HIGHLIGHT_PATH_LIMIT = 64;
type Word = { surface:string; kind:LexemeKind; value:string };
type Edge = { end:number; tokens:HighlightToken[] };
const words = new Map<string, Word>();
const byInitial = new Map<string, Word[]>();
const segmenter = typeof Intl.Segmenter==='function' ? new Intl.Segmenter('ja', { granularity:'grapheme' }) : undefined;

// Updated 2026-09-15: Older browsers keep code-point evidence without guessing combining-mark joins.
function* sourceSegments(source:string):Iterable<{segment:string;index:number}> {
  if(segmenter) {yield* segmenter.segment(source);return;}
  let index=0;
  for(const segment of source) {yield {segment,index}; index+=segment.length;}
}

// Updated 2026-09-14: Each normalized UTF-16 unit retains its complete original grapheme span.
function normalize(source:string) {
  let normalized = '';
  const offsets:HighlightLexing['offsets'] = [];
  for (const part of sourceSegments(source)) {
    const normalizedPart = part.segment.normalize('NFKC');
    for (let i=0;i<normalizedPart.length;i++) {
      const char = normalizedPart[i];
      if (/\s/u.test(char) && char!=='\n' && char!=='\r') continue;
      normalized += char==='\r' ? '\n' : char;
      offsets.push({ start:part.index, end:part.index+part.segment.length });
    }
  }
  return {normalized,offsets};
}

function add(surface:string, kind:LexemeKind, value:string) {
  const spelling = normalize(surface).normalized;
  if (spelling) words.set(`${spelling}\0${kind}\0${value}`,{surface:spelling,kind,value});
}
function addGrouped(groups:Record<string,string[]>,kind:LexemeKind) {
  for (const [value,surfaces] of Object.entries(groups)) for (const surface of surfaces) add(surface,kind,value);
}
addGrouped(lexicon.actions,'action');
// Noun + suru inflections keep modality outside the action token: ツモし + なかった.
for (const [action,surfaces] of Object.entries(lexicon.actions)) {
  for (const surface of surfaces) {
    if (/^[ァ-ヿ一-龯]+$/u.test(surface)) {
      for (const ending of lexicon.doInflections) add(surface+ending,'action',action);
    }
  }
}
addGrouped(lexicon.modality,'modality');
addGrouped(lexicon.times,'time');
addGrouped(lexicon.connectors,'connector');
addGrouped(lexicon.contexts,'context');
for (const [surface,value] of Object.entries(lexicon.ranks)) add(surface,'rank',value);
for (const [surface,value] of Object.entries(lexicon.roles)) add(surface,'role',value);
for (const surface of [...lexicon.particles,'も']) add(surface,'particle',surface);
for (const surface of lexicon.units) add(surface,'unit',surface);
for (const surface of ['選手','さん','氏','くん','君']) add(surface,'honorific',surface);
for (const surface of ['初手','一局','東1局','東2局','東3局','東4局','南1局','南2局','南3局','南4局','オーラス']) add(surface,'context',surface);
add('\n','connector','sentence');

function aliasKind(value:string):{kind:LexemeKind;value:string} {
  if (value==='ツモ') return {kind:'action',value:'tsumo'};
  if (value==='ロン') return {kind:'action',value:'ron'};
  if (value==='和了') return {kind:'action',value:'win'};
  if (value==='トップ') return {kind:'rank',value:'1'};
  if (value==='最下位') return {kind:'rank',value:'4'};
  if (/^[東南][1-4]局$/.test(value)||value==='オーラス') return {kind:'context',value};
  return {kind:'term',value};
}
const aliasEntries = new Map<string,string>([
  ...Object.values(dictionary.aliases).map(v=>[v,v] as [string,string]),
  ...Object.entries(dictionary.aliases),
  ...Object.keys(dictionary.terms).map(v=>[v,v] as [string,string]),
  ...Object.keys(dictionary.levels).map(v=>[v,v] as [string,string]),
  ['リーチ','リーチ'],['一発','一発'],['ダブルリーチ一発','ダブルリーチ一発'],['リーチ一発','リーチ一発'],
]);
for (const [surface,canonical] of aliasEntries) {
  const {kind,value} = aliasKind(canonical);
  add(surface,kind,value);
}
// Updated 2026-09-15: Generate only progressive conjugations of already registered predicates.
for (const word of [...words.values()]) {
  if((word.kind==='action'||(word.kind==='context'&&word.value==='do')) && /[てで]た$/.test(word.surface)) {
    add(word.surface.slice(0,-1)+'て',word.kind,word.value);
  }
}
for (const word of words.values()) {
  const first = word.surface[0];
  const bucket = byInitial.get(first) ?? [];
  bucket.push(word); byInitial.set(first,bucket);
}
for (const bucket of byInitial.values()) bucket.sort((a,b)=>b.surface.length-a.surface.length);

function sameToken(a:HighlightToken,b:HighlightToken) {
  return a.normalizedStart===b.normalizedStart && a.normalizedEnd===b.normalizedEnd && a.kind===b.kind && a.value===b.value;
}
function score(path:HighlightToken[]) {
  const unknown = path.filter(t=>t.kind==='unknown').reduce((n,t)=>n+t.normalizedEnd-t.normalizedStart,0);
  return -unknown*100-path.length;
}

// Updated 2026-09-14: A bounded token lattice preserves alternate splits and all original evidence.
export function lexHighlight(source:string, players:Player[]):HighlightLexing {
  const {normalized,offsets} = normalize(source);
  const edges = new Map<number,Edge[]>();
  const tokens:HighlightToken[] = [];
  const tokenKeys = new Set<string>();
  const people = players.map(p=>({id:p.id,name:normalize(p.name).normalized})).filter(p=>p.name);
  const personAt = new Map<number,{end:number;id:string}[]>();
  const protectedChars = new Set<number>();
  for(let start=0;start<normalized.length;start++) {
    const matches = people.filter(p=>normalized.startsWith(p.name,start));
    if (!matches.length) continue;
    personAt.set(start,matches.map(p=>({end:start+p.name.length,id:p.id})));
    for(const person of matches) for(let i=start;i<start+person.name.length;i++) protectedChars.add(i);
  }
  function token(start:number,end:number,kind:LexemeKind,value:string):HighlightToken {
    const originalStart = offsets[start]?.start ?? source.length;
    const originalEnd = offsets[end-1]?.end ?? originalStart;
    return {start:originalStart,end:originalEnd,text:source.slice(originalStart,originalEnd),kind,value,normalizedStart:start,normalizedEnd:end};
  }
  function edge(start:number,end:number,parts:HighlightToken[]) {
    const bucket = edges.get(start) ?? [];
    if (!bucket.some(e=>e.end===end&&e.tokens.length===parts.length&&e.tokens.every((t,i)=>sameToken(t,parts[i])))) bucket.push({end,tokens:parts});
    edges.set(start,bucket);
    for(const part of parts) {
      const key = `${part.normalizedStart}:${part.normalizedEnd}:${part.kind}:${part.value}`;
      if(!tokenKeys.has(key)){tokens.push(part);tokenKeys.add(key);}
    }
  }
  for(let start=0;start<normalized.length;start++) {
    const peopleHere = personAt.get(start);
    if(peopleHere) {
      for(const person of peopleHere) edge(start,person.end,[token(start,person.end,'person',person.id)]);
      continue;
    }
    if(protectedChars.has(start)) continue;
    for(const word of byInitial.get(normalized[start]) ?? []) {
      if(!normalized.startsWith(word.surface,start)) continue;
      const end = start+word.surface.length;
      if(Array.from({length:end-start},(_,i)=>start+i).some(i=>protectedChars.has(i))) continue;
      // Aliases such as リーヅモ have a shared evidence span; they are not text rewrites.
      if(word.kind==='term' && word.value==='リーチツモ') {
        edge(start,end,[token(start,end,'term','リーチ'),token(start,end,'action','tsumo')]);
      } else edge(start,end,[token(start,end,word.kind,word.value)]);
      if(word.kind==='term' && /^親(?:満貫|跳満|倍満|三倍満|役満)$/.test(word.value)) {
        const split = word.surface.startsWith('親') ? start+1 : end;
        edge(start,end,[token(start,split,'role','dealer'),token(split===end?start:split,end,'term',word.value.slice(1))]);
      }
    }
    const number = normalized.slice(start).match(/^\d+(?:,\d{3})*(?:\.\d+)?/);
    if(number && !protectedChars.has(start+number[0].length-1)) {
      const end = start+number[0].length;
      edge(start,end,[token(start,end,'number',number[0].replaceAll(',',''))]);
    }
  }
  // Unknown spans are explicit edges, never silently removed from an interpretation.
  const reachableStarts = new Set([0,...Array.from(edges.values()).flatMap(bucket=>bucket.map(e=>e.end))]);
  for(let start=0;start<normalized.length;start++) {
    if(!reachableStarts.has(start)) continue;
    if(edges.has(start)) continue;
    let end=start+1;
    while(end<normalized.length&&!edges.has(end)) end++;
    edge(start,end,[token(start,end,'unknown',normalized.slice(start,end))]);
  }
  const at = new Map<number,HighlightToken[][]>([[0,[[]]]]);
  let truncated=false;
  for(let start=0;start<normalized.length;start++) {
    let paths = at.get(start);
    if(!paths) continue;
    if(paths.length>HIGHLIGHT_PATH_LIMIT) {paths.sort((a,b)=>score(b)-score(a)); paths=paths.slice(0,HIGHLIGHT_PATH_LIMIT);truncated=true;}
    for(const next of edges.get(start) ?? []) {
      const target=at.get(next.end) ?? [];
      for(const path of paths) target.push([...path,...next.tokens]);
      if(target.length>HIGHLIGHT_PATH_LIMIT*2) {target.sort((a,b)=>score(b)-score(a));target.length=HIGHLIGHT_PATH_LIMIT;truncated=true;}
      at.set(next.end,target);
    }
  }
  const complete = at.get(normalized.length) ?? [[]];
  complete.sort((a,b)=>score(b)-score(a));
  if(complete.length>HIGHLIGHT_PATH_LIMIT) truncated=true;
  tokens.sort((a,b)=>a.normalizedStart-b.normalizedStart || b.normalizedEnd-a.normalizedEnd || a.kind.localeCompare(b.kind));
  return {source,normalized,offsets,tokens,paths:complete.slice(0,HIGHLIGHT_PATH_LIMIT),truncated};
}
