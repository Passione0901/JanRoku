import dictionary from '../../content/daily-news/highlight-dictionary.json';
import { validHighlight } from '../highlightText';
import type { Player, Rank } from '../types';
import type { HighlightGame as Game } from './highlightTypes';
import { lexHighlight, HIGHLIGHT_LEXER_VERSION } from './highlightLexer';
import type { HighlightAnalysis, HighlightToken as Token, StructuredHighlight as Event, SourceSpan, EventState, HighlightAmount } from './highlightTypes';

export const HIGHLIGHT_ANALYZER_VERSION='structured-2';
const cache=new Map<string,HighlightAnalysis>();
const levels:Record<string,number[]>=dictionary.levels;
const terms:Record<string,{actions:string[];level?:string;role?:string}>=dictionary.terms;
const winActions=new Set(['tsumo','ron','deal-in','hit','win']);
const unique=<T>(values:T[])=>[...new Set(values)];
const span=(token:SourceSpan):SourceSpan=>({start:token.start,end:token.end,text:token.text});
const textOf=(tokens:Token[])=>tokens.map(t=>t.text).join('');
const is=(t:Token,kind:string,value?:string)=>t.kind===kind&&(value===undefined||t.value===value);
const rejected=(e:Event,reason:string,ambiguous=false)=>{e.decision=ambiguous?'ambiguous':'rejected';if(!e.reasons.includes(reason))e.reasons.push(reason);};

interface Clause { tokens:Token[]; scene:number; boundary:string; start:number; end:number }
// Updated 2026-09-14: Clause boundaries retain discourse links; decisions wait until all scopes are known.
function clauses(path:Token[]):Clause[]{
  const result:Clause[]=[];let pending:Token[]=[];let scene=0;let boundary='start';
  const flush=()=>{if(pending.length){result.push({tokens:pending,scene,boundary,start:pending[0].start,end:pending.at(-1)!.end});pending=[];}};
  for(const t of path){
    if(is(t,'time','next')){flush();scene++;boundary='next';pending.push(t);}
    else if(is(t,'particle','が')&&pending.at(-1)&&['action','modality'].includes(pending.at(-1)!.kind)){flush();boundary='contrast';}
    else if(t.kind==='connector'&&['comma','sentence','contrast','sequence'].includes(t.value)){
      flush();boundary=t.value;if(t.value==='sentence'||(t.value==='sequence'&&['その後','続いて'].includes(t.text)))scene++;
    }else pending.push(t);
  }
  flush();return result;
}
function particleAfter(tokens:Token[],i:number):string|null{
  const next=tokens.slice(i+1).find(t=>t.kind!=='honorific');
  return next?.kind==='particle'?next.value:null;
}
function subjects(tokens:Token[]):Token[]{return tokens.filter((t,i)=>is(t,'person')&&['が','は','も'].includes(particleAfter(tokens,i)??''));}
function inferSubject(tokens:Token[],prior:string|null):{id:string|null;ambiguous:boolean;proof:Token[]}{
  const explicit=subjects(tokens);const ids=unique(explicit.map(t=>t.value));
  if(ids.length>1)return {id:null,ambiguous:true,proof:explicit};
  if(ids.length===1)return {id:ids[0],ambiguous:false,proof:explicit};
  // An unknown explicit subject prevents inheriting a previous known person.
  if(tokens.some((t,i)=>is(t,'particle','が')&&tokens[i-1]?.kind!=='person'&&tokens[i-1]?.kind!=='honorific'))return {id:null,ambiguous:true,proof:[]};
  return {id:prior,ambiguous:false,proof:[]};
}
function roleBindings(tokens:Token[],subject:string|null):{roles:Event['roles'];conflict:boolean;proof:Token[]}{
  const roles:Event['roles']={};let conflict=false;const proof:Token[]=[];
  for(let i=0;i<tokens.length;i++){
    const t=tokens[i];if(t.kind!=='role')continue;
    let owner:string|null=null;
    const next=tokens[i+1];const after=tokens[i+2];
    if(isToken(next,'particle','の')&&isToken(after,'person'))owner=after.value;
    else {
      // A role immediately before a yaku/action qualifies that winning hand, resolved later.
      const before=tokens.slice(0,i);const ps=subjects(before);
      if(ps.length&&next?.kind==='particle'&&['で','として'].includes(next.value)&&before.slice(before.indexOf(ps.at(-1)!)+1).every(x=>['particle','honorific','context'].includes(x.kind)))owner=ps.at(-1)!.value;
      else if(subject&&next?.kind==='particle'&&['で','として'].includes(next.value))owner=subject;
    }
    if(owner){const value=t.value as 'dealer'|'nondealer';if(roles[owner]&&roles[owner]!==value)conflict=true;roles[owner]=value;proof.push(t);}
  }
  return {roles,conflict,proof};
}
function isToken(t:Token|undefined,kind:string,value?:string):t is Token{return !!t&&is(t,kind,value);}
function modality(tokens:Token[]):EventState{
  const states=tokens.filter(t=>t.kind==='modality').map(t=>t.value);
  if(states.includes('hypothetical'))return 'hypothetical';
  if(states.includes('speculative'))return 'speculative';
  if(states.includes('negated'))return 'negated';
  if(states.includes('attempted')||tokens.some(t=>is(t,'action','aim')||is(t,'action','ready')))return 'attempted';
  return 'asserted';
}
function createEvent(game:Game,c:Clause,action:Token,actor:string|null,kind:Event['kind']):Event{
  return {id:`${game.id}:${c.scene}:${action.start}:${kind}`,gameId:game.id,kind,actorId:actor,winnerId:kind==='win'?actor:null,discarderId:null,targetId:null,method:null,yaku:[],level:null,roles:{},amounts:[],basicGain:{value:null,lowerBound:null},time:{segment:c.scene,scope:'unspecified'},finalRank:null,state:'asserted',decision:'accepted',reasons:[],evidence:{action:[span(action)],source:[{start:c.start,end:c.end,text:game.highlight!.slice(c.start,c.end)}]}};
}
function extractAmounts(tokens:Token[],kind:Event['kind']):HighlightAmount[]{
  const nums=tokens.filter(t=>t.kind==='number');
  const pair=nums.length===2&&/^[点・/－-]+$/.test(textOf(tokens.filter(t=>t.start>=nums[0].end&&t.end<=nums[1].start)));
  return tokens.flatMap((t,i)=>{
    if(t.kind!=='number')return [];
    const value=Number(t.value);if(!Number.isSafeInteger(value)||value<0)return [];
    const tail=textOf(tokens.slice(i+1,i+5));const prefix=textOf(tokens.slice(Math.max(0,i-4),i));
    let meaning:HighlightAmount['meaning']='unclassified';
    if(tokens.some(x=>is(x,'unit','本場')||x.text==='供託'))meaning='bonus-inclusive';
    else if(pair)meaning='individual-payment';
    else if(/オール/.test(tail))meaning='all-payment';
    else if(/点(?:近い)?差|点だけ|点を上回/.test(tail))meaning='gap';
    else if(/点持ち|点を持|点以上を持/.test(tail)||tokens.some(x=>is(x,'context','balance')))meaning='balance';
    else if(/点(?:以上)?を稼|合計|累計/.test(tail+prefix)||/親番だけ|親番のみ/.test(prefix))meaning='aggregate';
    else if(/^点/.test(tail)&&kind==='win')meaning='basic-gain';
    // Bare numbers followed by 回/枚/巡/本場 never become point amounts.
    if(meaning==='unclassified'&&/^(?:回|枚|巡|本場|局|連)/.test(tail))return [];
    return [{value,meaning,evidence:[span(t)]}];
  });
}
function resolveWin(e:Event,tokens:Token[],action:Token,subject:string|null){
  const people=tokens.filter(t=>t.kind==='person');
  const bound=(particles:string[])=>unique(people.filter(p=>particles.includes(particleAfter(tokens,tokens.indexOf(p))??'')).map(p=>p.value));
  const from=bound(['から']);const toward=bound(['に','へ']);const possessors=bound(['の']).filter(id=>id!==subject);
  if(people.some(p=>particleAfter(tokens,tokens.indexOf(p))==='と'))rejected(e,'coordinated-people-ambiguous',true);
  e.method=action.value==='tsumo'?'tsumo':['ron','deal-in','hit'].includes(action.value)?'ron':'unspecified';
  if(action.value==='deal-in'){
    const winners=unique([...toward,...possessors]);e.discarderId=subject;e.winnerId=winners.length===1?winners[0]:null;e.actorId=e.winnerId;
    if(winners.length!==1)rejected(e,'winner-not-unique',winners.length>1);
  }else if(action.value==='hit'){
    const victims=unique([...from,...toward]);e.discarderId=victims.length===1?victims[0]:null;
    if(victims.length!==1)rejected(e,'discarder-not-unique',victims.length>1);
  }else if(e.method==='ron'){
    const ronFrom=unique([...from,...(tokens.some(t=>is(t,'term','槍槓'))?possessors:[])]);
    if(ronFrom.length>1)rejected(e,'discarder-not-unique',true);else e.discarderId=ronFrom[0]??null;
    if(toward.length)rejected(e,'ron-relation-unsupported');
  }else if(e.method==='tsumo'&&(from.length||toward.length||possessors.length))rejected(e,'tsumo-cannot-have-discarder');
  if(!e.winnerId)rejected(e,'winner-missing',true);
  if(e.winnerId&&e.winnerId===e.discarderId)rejected(e,'self-transfer');
  e.evidence.people=people.map(span);
}
function attachTerms(e:Event,tokens:Token[]){
  const termTokens=tokens.filter(t=>t.kind==='term');
  const values=unique(termTokens.map(t=>/^親(?:満貫|跳満|倍満|三倍満|役満)$/.test(t.value)?t.value.slice(1):t.value));
  // Compound and separated spellings produce the same semantic yaku set.
  for(const root of ['ダブルリーチ','リーチ'])if(values.includes(root)&&values.includes('一発')){
    values.splice(values.indexOf(root),1);values.splice(values.indexOf('一発'),1);values.push(root+'一発');break;
  }
  const tierValues=unique(values.filter(v=>levels[v]));
  const named=values.filter(v=>!levels[v]);
  for(const name of named)if(terms[name]?.level)tierValues.push(terms[name].level!);
  const tiers=unique(tierValues);
  if(tiers.length>1)rejected(e,'conflicting-tiers');
  e.level=tiers[0]??null;e.yaku=named;e.evidence.yaku=termTokens.map(span);
  const winner=e.winnerId;
  if(winner&&termTokens.some(t=>/^親(?:満貫|跳満|倍満|三倍満|役満)$/.test(t.value))){
    if(e.roles[winner]==='nondealer')rejected(e,'conflicting-dealer');
    e.roles[winner]='dealer';
  }
  const roleTokens=tokens.filter(t=>t.kind==='role');
  for(const t of roleTokens){
    const i=tokens.indexOf(t);if(isToken(tokens[i+1],'particle','の')&&isToken(tokens[i+2],'person'))continue;
    const next=tokens[i+1];const hand=next?.kind==='particle'&&next.value==='の'?tokens[i+2]:next;
    const qualifiesHand=hand&&(hand.kind==='term'&&(!!levels[hand.value]||!!terms[hand.value]&&!isToken(tokens[tokens.indexOf(hand)+1],'particle','に'))||hand.kind==='action'&&['tsumo','ron','win'].includes(hand.value));
    if(!qualifiesHand)continue;
    // Post-subject roles explicitly attached to another person must not qualify the winner's hand.
    const previousPeople=subjects(tokens.slice(0,i));
    const owner=previousPeople.at(-1)?.value;
    const between=owner?tokens.slice(tokens.indexOf(previousPeople.at(-1)!)+1,i):[];
    const subjectRole=owner&&between.every(x=>['particle','honorific','context'].includes(x.kind));
    const recipientRole=subjectRole&&owner!==winner;
    if(winner&&!recipientRole){const role=t.value as 'dealer'|'nondealer';if(e.roles[winner]&&e.roles[winner]!==role)rejected(e,'conflicting-dealer');e.roles[winner]=role;}
  }
  for(const yaku of named){
    const rule=terms[yaku];if(!rule)continue;
    const method=e.method==='tsumo'?'ツモ':e.method==='ron'?'ロン':'和了';
    if(!rule.actions.includes(method))rejected(e,'yaku-method-conflict');
    if(rule.role&&winner){const role=rule.role==='親'?'dealer':'nondealer';if(e.roles[winner]&&e.roles[winner]!==role)rejected(e,'yaku-role-conflict');else e.roles[winner]=role;}
  }
  if(values.includes('七対子')&&values.some(v=>['三暗刻','対々和','三槓子'].includes(v)))rejected(e,'incompatible-yaku');
  if(tokens.some(t=>is(t,'context','初手'))&&values.some(v=>['海底摸月','海底撈月','河底撈魚','嶺上開花'].includes(v)))rejected(e,'opening-last-tile-conflict');
}
function validatePoints(e:Event){
  if(e.kind!=='win')return;
  if(Object.values(e.roles).filter(r=>r==='dealer').length>1)rejected(e,'multiple-dealers');
  if(e.amounts.some(a=>a.meaning==='bonus-inclusive')){e.decision='unsupported';e.reasons.push('bonus-inclusive-points');return;}
  const role=e.winnerId?e.roles[e.winnerId]:undefined;
  const all=unique(e.amounts.filter(a=>a.meaning==='all-payment').map(a=>a.value));
  const exact=unique(e.amounts.filter(a=>a.meaning==='basic-gain').map(a=>a.value));
  const payments=e.amounts.filter(a=>a.meaning==='individual-payment').map(a=>a.value).sort((a,b)=>a-b);
  if(all.length>1||exact.length>1)rejected(e,'conflicting-point-claims');
  if(all.length){
    if(e.method!=='tsumo'||role==='nondealer')rejected(e,'all-payment-role-conflict');
    if(e.winnerId)e.roles[e.winnerId]='dealer';
    const tableMatch=Object.entries(levels).find(([,pair])=>pair[1]===all[0]*3);
    if(!tableMatch)rejected(e,'unsupported-all-payment');
    else if(e.level&&e.level!==tableMatch[0])rejected(e,'tier-payment-conflict');
    else e.level=tableMatch[0];
  }
  if(payments.length){
    if(payments.length!==2||payments[1]!==payments[0]*2||e.method!=='tsumo'||role==='dealer'||all.length)rejected(e,'individual-payment-conflict');
    else {
      const total=payments[0]*2+payments[1];
      const tier=Object.entries(levels).find(([,p])=>p[0]===total)?.[0];
      if(!tier)rejected(e,'unsupported-individual-payment');
      else if(e.level&&e.level!==tier)rejected(e,'tier-payment-conflict');
      else {e.level=tier;if(e.winnerId)e.roles[e.winnerId]='nondealer';exact.push(total);}
    }
  }
  if(!e.level&&exact.length){
    const possible=Object.entries(levels).filter(([,pair])=>(role?[pair[role==='dealer'?1:0]]:pair).includes(exact[0]));
    if(possible.length===1)e.level=possible[0][0];
  }
  if(e.level&&levels[e.level]){
    const pair=levels[e.level];const resolvedRole=e.winnerId?e.roles[e.winnerId]:undefined;
    const possible=resolvedRole?[pair[resolvedRole==='dealer'?1:0]]:pair;
    if(exact.length&&!possible.includes(exact[0]))rejected(e,'tier-points-conflict');
    const explicit=exact[0]??(all.length?all[0]*3:null);
    e.basicGain.value=explicit??(resolvedRole?possible[0]:null);
    e.basicGain.lowerBound=Math.min(...possible);
  }else if(exact.length){
    // Without a tier, arbitrary bare numbers cannot establish a valid fu/han result.
    e.basicGain.value=null;e.basicGain.lowerBound=null;
  }
}
function addOutcome(e:Event,tokens:Token[],game:Game){
  const ranks=tokens.filter(t=>t.kind==='rank');
  const destination=ranks.filter(t=>!isToken(tokens[tokens.indexOf(t)+1],'particle','から')).at(-1);
  if(destination)e.finalRank=Number(destination.value) as Rank;
  const raw=textOf(tokens);
  const explicitFinal=tokens.some(t=>is(t,'time','final')||is(t,'action','end'))||/対局終了|半荘終了|で終え|で終了|最終的|トップを獲得|トップを奪|逆転トップを獲得/.test(raw);
  e.time.scope=explicitFinal?'final':'during';
  if(e.kind==='reversal'){
    const target=tokens.filter((t,i)=>is(t,'person')&&['を','から'].includes(particleAfter(tokens,i)??'')).map(t=>t.value).filter(id=>id!==e.actorId);
    if(unique(target).length>1)rejected(e,'reversal-target-ambiguous',true);else e.targetId=target[0]??null;
  }else if(e.kind==='bust'){
    const directBust=/飛ん|飛び|トビ|飛ば/.test(raw);
    e.time.scope=directBust?'final':explicitFinal?'final':'during';
    if(e.time.scope==='final'){
      const result=game.players.find(p=>p.playerId===e.actorId);
      if(game.inputMode==='results'||!result||result.rawScore===null)rejected(e,'final-points-unavailable');
      else if(game.rules.bustIncludesZero?result.rawScore>0:result.rawScore>=0)rejected(e,'final-bust-conflict');
    }
  }
  if(e.kind!=='bust'&&explicitFinal&&e.finalRank!==null&&game.players.find(p=>p.playerId===e.actorId)?.rank!==e.finalRank)rejected(e,'final-rank-conflict');
  e.evidence.rank=ranks.map(span);e.evidence.origin=ranks.filter(t=>isToken(tokens[tokens.indexOf(t)+1],'particle','から')).map(span);
}

// Updated 2026-09-15: An explicit continuation enriches one win; incompatible claims invalidate both descriptions.
function mergeWin(into:Event,extra:Event){
  if(into.level&&extra.level&&into.level!==extra.level)rejected(into,'supplement-tier-conflict');
  else into.level??=extra.level;
  if(into.method!=='unspecified'&&extra.method!=='unspecified'&&into.method!==extra.method)rejected(into,'supplement-method-conflict');
  else if(into.method==='unspecified')into.method=extra.method;
  if(into.discarderId&&extra.discarderId&&into.discarderId!==extra.discarderId)rejected(into,'supplement-person-conflict');
  else into.discarderId??=extra.discarderId;
  for(const [id,role] of Object.entries(extra.roles)){
    if(into.roles[id]&&into.roles[id]!==role)rejected(into,'supplement-role-conflict');
    into.roles[id]=role;
  }
  if(extra.decision!=='accepted'){if(into.decision==='accepted')into.decision=extra.decision;into.reasons=unique([...into.reasons,...extra.reasons]);}
  if(extra.state!=='asserted')into.state=extra.state;
  into.yaku=unique([...into.yaku,...extra.yaku]);into.amounts.push(...extra.amounts);
  into.milestone??=extra.milestone;
  if(into.occurrences&&extra.occurrences&&into.occurrences!==extra.occurrences)rejected(into,'supplement-count-conflict');
  into.occurrences??=extra.occurrences;
  for(const [key,value] of Object.entries(extra.evidence))into.evidence[key]=[...(into.evidence[key]??[]),...value];
  validatePoints(into);
}
function winEvent(event:Event|null):Event|null{return event?.kind==='win'?event:null;}

// Updated 2026-09-15: First-time claims bind to the winner and the immediately qualified hand/action.
function attachMilestone(event:Event,tokens:Token[],action:Token,subject:string|null){
  if(event.winnerId!==subject)return;
  const markers=tokens.filter(t=>is(t,'context','milestone-first')&&t.end<=action.start);
  for(const marker of markers){
    const owner=tokens.filter(t=>t.kind==='person'&&t.end<=marker.start).at(-1);
    if(owner&&owner.value!==subject&&particleAfter(tokens,tokens.indexOf(owner))==='の')continue;
    const after=tokens.filter(t=>t.start>=marker.end&&t.start<=action.start);
    const target=after.find(t=>!is(t,'particle','の'));
    if(!target)continue;
    const targetHand=target.kind==='term'?target.value:null;
    if(targetHand&&!event.yaku.includes(targetHand)&&event.level!==targetHand)continue;
    if(!targetHand&&!(target.kind==='action'&&winActions.has(target.value)))continue;
    // 初めてリーチして跳満… describes a first riichi, not a first haneman win.
    if(targetHand&&after.some(t=>t.start>target.end&&(t.kind==='action'||is(t,'context','do'))&&t.start<action.start))continue;
    if(targetHand&&after.filter(t=>t.kind==='term').some(t=>t.value!==targetHand))continue;
    event.milestone={kind:'first-win',hand:targetHand,method:event.method??'unspecified'};
    event.evidence.milestone=[span(marker),span(target)];
  }
}

// Updated 2026-09-14: Structural dependencies determine event fields; no prose is generated here.
function interpret(game:Game,path:Token[]):Event[]{
  const result:Event[]=[];const cs=clauses(path);let priorSubject:string|null=null;let priorScene=-1;let priorEvent:Event|null=null;
  let sceneRoles:Event['roles']={};
  for(const c of cs){
    if(c.scene!==priorScene){priorSubject=null;sceneRoles={};priorEvent=null;priorScene=c.scene;}
    const t=c.tokens;const raw=textOf(t);
    const state=modality(t);
    // A following reporting correction changes the preceding proposition, not just this fragment.
    if(/と思|という話|だったら|ではなかった|じゃなかった|違った|嘘/.test(raw)&&state!=='asserted'&&c.boundary!=='contrast'&&c.boundary!=='next'&&!subjects(t).length){
      const referencedScene=result.some(e=>e.time.segment===c.scene)?c.scene:result.at(-1)?.time.segment;
      for(const earlier of result.filter(e=>e.time.segment===referencedScene)){earlier.state=state;rejected(earlier,'retrospective-modality');earlier.evidence.correction=t.map(span);}
    }
    const actions=t.filter(x=>x.kind==='action');
    // These yaku names denote a winning action, unlike hand composition such as 清一色.
    if(!actions.some(x=>winActions.has(x.value)||['aim','ready','complete'].includes(x.value))){
      const implicit=t.find(x=>is(x,'term','嶺上開花')||is(x,'term','槍槓'));
      if(implicit)actions.push({...implicit,kind:'action',value:implicit.value==='槍槓'?'ron':'tsumo'});
      const bust=actions.find(x=>x.value==='bust'&&/飛ば/.test(x.text));
      if(bust&&t.some(x=>x.kind==='term'&&(levels[x.value]||/^親(?:満貫|跳満|倍満|三倍満|役満)$/.test(x.value))))actions.push({...bust,value:'win'});
      actions.sort((a,b)=>a.start-b.start);
      if(bust)actions.sort((a,b)=>a.start-b.start||(a.value==='win'?-1:b.value==='win'?1:0));
    }
    const subjectResult=inferSubject(t,priorSubject);
    const explicitSubs=subjects(t);
    if(explicitSubs.length===1)priorSubject=explicitSubs[0].value;
    const binding=roleBindings(t,subjectResult.id);sceneRoles={...sceneRoles,...binding.roles};
    const beforeCount=result.length;
    const continuingWin:Event|null=c.boundary==='comma'&&!explicitSubs.length?winEvent(priorEvent):null;
    // Point/yaku predicates before a following rank change still describe the preceding win.
    if(continuingWin&&t.some(x=>x.kind==='term'||x.kind==='number')&&!actions.some(x=>winActions.has(x.value)||['aim','ready','kan','draw'].includes(x.value))){
      const firstAction=actions[0];const info=t.filter(x=>!firstAction||x.start<firstAction.start);
      if(!info.some(x=>is(x,'context','balance')||is(x,'context','aggregate'))){
        const supplement=createEvent(game,c,t[0],continuingWin.actorId,'win');supplement.method=continuingWin.method;supplement.roles={...continuingWin.roles};
        attachTerms(supplement,info);supplement.amounts=extractAmounts(info,'win');supplement.state=state;
        if(state!=='asserted')rejected(supplement,'supplement-not-asserted');mergeWin(continuingWin,supplement);
      }
    }
    for(let ai=0;ai<actions.length;ai++){
      const action=actions[ai];
      const explicitFrom=t.some((x,i)=>x.kind==='rank'&&isToken(t[i+1],'particle','から'));
      const upward=action.value==='rise'&&t.some(x=>x.kind==='rank')&&(!/となった|になった/.test(action.text)||explicitFrom);
      const overtake=action.value==='reverse'&&(!/かわし|かわした|かわして|奪った/.test(action.text)||t.some(x=>x.kind==='rank'||is(x,'unit','差')));
      const repetitive=action.value==='reverse'&&/まく/.test(action.text)&&t.some(x=>x.kind==='action'&&x.end===action.start);
      let kind:Event['kind']|null=winActions.has(action.value)?'win':overtake&&!repetitive||upward?'reversal':action.value==='bust'?'bust':null;
      if(action.value==='end'&&explicitFrom&&t.some(x=>is(x,'rank','1')))kind='reversal';
      // Named rinshan/haitei imply a tsumo win only with an explicit completion predicate.
      if(action.value==='complete'&&t.some(x=>is(x,'term','嶺上開花')))kind='win';
      if(!kind)continue;
      const prev=actions[ai-1];const next=actions[ai+1];
      const left=prev?prev.end:c.start;
      const right=next?next.start:c.end;
      // Explicit subject/argument phrases before an earlier context action can continue to its own win.
      const seen=t.filter(x=>x.start<action.start);const nearestSubject=subjects(seen).at(-1);
      const actor=nearestSubject?.value??subjectResult.id;
      const scope=t.filter(x=>x.end>Math.max(left,nearestSubject?.start??left)&&x.start<right);
      const relation=t.filter(x=>x.start<action.start&&x.start>=(nearestSubject?.start??c.start));
      const e=createEvent(game,c,action,actor,kind);e.roles={...sceneRoles};
      const localModal=modality(scope);
      e.state=localModal==='asserted'&&state!=='attempted'?state:localModal;
      if(state!=='asserted'&&t.some(x=>x.start>=action.end&&(x.kind==='modality'||is(x,'action','aim')||is(x,'action','ready'))))e.state=state;
      if(subjectResult.ambiguous&&!nearestSubject)rejected(e,'subject-ambiguous',true);
      if(!actor)rejected(e,'subject-missing',true);
      if(binding.conflict)rejected(e,'conflicting-dealer');
      e.evidence.subject=nearestSubject?[span(nearestSubject)]:subjectResult.proof.map(span);
      e.evidence.roles=[...binding.proof,...t.filter(x=>x.kind==='role')].map(span);
      e.evidence.modality=t.filter(x=>x.kind==='modality').map(span);
      if(kind==='win'){
        resolveWin(e,relation,action,actor);
        if(t.some((x,i)=>x.kind==='person'&&particleAfter(t,i)==='と'))rejected(e,'coordinated-people-ambiguous',true);
        if(action.value==='complete')e.method='tsumo';
        // Predicate object such as 嶺上牌/ドラ/待ち牌 is a draw, not automatically a winning draw.
        const head=textOf(scope.filter(x=>x.end<=action.start));
        if(e.method==='tsumo'&&((/嶺上牌|配牌|ドラを|牌を引|手牌|当たり牌を掴/.test(head)&&!scope.some(x=>x.kind==='term'))||next?.value==='draw'))rejected(e,'tile-draw-not-win');
        attachTerms(e,scope);
        attachMilestone(e,scope,action,actor);
        const counts=scope.filter((token,index)=>token.kind==='number'&&isToken(scope[index+1],'unit','回')
          &&token.end<=action.start&&scope.slice(index+2).filter(t=>t.start<action.start).every(t=>t.kind==='particle'));
        if(counts.length===1&&Number(counts[0].value)>=1&&Number(counts[0].value)<=50){
          e.occurrences=Number(counts[0].value);e.evidence.occurrences=counts.map(span);
        }
        if(t.some(x=>is(x,'time','final')||is(x,'action','end')))addOutcome(e,t,game);
        if(t.some(x=>is(x,'context','speech')))rejected(e,'speech-not-completed-win');
        if(prev&&['ready','aim'].includes(prev.value)&&!scope.some(x=>x.kind==='term')&&e.method==='unspecified')rejected(e,'completion-not-win');
      }else{
        if(action.value==='bust'&&/飛ば/.test(action.text)){
          const targets=t.filter((x,i)=>is(x,'person')&&particleAfter(t,i)==='を');
          if(targets.length===1)e.actorId=targets[0].value;else rejected(e,'bust-person-ambiguous',true);
        }
        addOutcome(e,t,game);
      }
      e.amounts=extractAmounts(scope,kind);validatePoints(e);
      if(e.state!=='asserted')rejected(e,'not-asserted');
      // Unsupported qualifiers may change the event's truth; do not silently throw them away.
      const unknown=scope.filter(x=>x.kind==='unknown'&&/[\p{L}\p{N}]/u.test(x.text));
      if(unknown.length){e.decision=e.decision==='accepted'?'unsupported':e.decision;e.reasons.push('unresolved-phrase');e.evidence.unresolved=unknown.map(span);}
      if(scope.some(x=>is(x,'context','unsupported'))||/数え|倍役満|四暗刻単騎|十三面|13面|九面|9面|責任払い|包|本場|供託|三麻|サンマ|ツモ損|チップ|祝儀/.test(textOf(scope))){e.decision='unsupported';e.reasons.push('unsupported-rule-or-wait');}
      if(kind==='win'&&/役なし|役無し|ノーテン|誤ロン|チョンボ/.test(raw))rejected(e,'invalid-win');
      if(/バカ|馬鹿|死ね/.test(raw)){e.decision='unsupported';e.reasons.push('abusive-note');}
      const explicitBustFromWinner=e.kind==='bust'&&/飛ば/.test(action.text)&&actor===priorEvent?.winnerId;
      if(priorEvent&&priorEvent.time.segment===e.time.segment&&e.kind!=='win'&&priorEvent.kind==='win'&&([priorEvent.winnerId,priorEvent.discarderId].includes(e.actorId)||explicitBustFromWinner)){
        e.relatedEventIds=[priorEvent.id];priorEvent.relatedEventIds=unique([...(priorEvent.relatedEventIds??[]),e.id]);
      }
      const previousWin=winEvent(priorEvent);
      const sameClauseWin:Event|null=previousWin?.evidence.source[0].start===c.start?previousWin:null;
      const mergeTarget:Event|null=continuingWin??sameClauseWin;
      if(e.kind==='win'&&mergeTarget&&e.winnerId===mergeTarget.winnerId){mergeWin(mergeTarget,e);priorEvent=mergeTarget;}
      else if(e.kind==='reversal'&&priorEvent?.kind==='reversal'&&c.boundary==='comma'&&!explicitSubs.length&&priorEvent.actorId===e.actorId){
        if(priorEvent.targetId&&e.targetId&&priorEvent.targetId!==e.targetId)rejected(priorEvent,'supplement-target-conflict');
        else priorEvent.targetId??=e.targetId;
        priorEvent.finalRank=e.finalRank??priorEvent.finalRank;priorEvent.time.scope=e.time.scope;
        priorEvent.amounts.push(...e.amounts);priorEvent.evidence.source.push(...e.evidence.source);
        if(e.decision!=='accepted'){priorEvent.decision=e.decision;priorEvent.reasons.push(...e.reasons);}
      }else {result.push(e);priorEvent=e;}
    }
    // Complementary yaku/point clause may describe the same explicit preceding win; never cross time or actor boundaries.
    if(!continuingWin&&result.length===beforeCount&&priorEvent?.kind==='win'&&c.boundary==='comma'&&priorEvent.time.segment===c.scene&&(!explicitSubs.length||explicitSubs[0].value===priorEvent.winnerId)&&t.some(x=>x.kind==='term')&&!actions.some(x=>['aim','ready','kan','draw'].includes(x.value))){
      const extra=createEvent(game,c,t[0],priorEvent.actorId,'win');extra.method=priorEvent.method;extra.winnerId=priorEvent.winnerId;extra.roles={...priorEvent.roles};attachTerms(extra,t);
      if(extra.level&&priorEvent.level&&extra.level!==priorEvent.level)rejected(priorEvent,'supplement-tier-conflict');
      else if(extra.level)priorEvent.level=extra.level;
      priorEvent.yaku=unique([...priorEvent.yaku,...extra.yaku]);priorEvent.evidence.supplement=t.map(span);
      priorEvent.amounts.push(...extractAmounts(t,'win'));validatePoints(priorEvent);
      if(state!=='asserted'){priorEvent.state=state;rejected(priorEvent,'supplement-not-asserted');}
    }
    if(result.length===beforeCount&&state!=='asserted'&&c.boundary==='comma'&&priorEvent){priorEvent.state=state;rejected(priorEvent,'following-modality');}
  }
  // Keep a final-rank/bust contradiction from being bypassed by selecting only its causal win.
  for(const e of result)if(e.reasons.some(r=>['final-rank-conflict','final-bust-conflict'].includes(r)))for(const id of e.relatedEventIds??[]){const related=result.find(x=>x.id===id);if(related)rejected(related,'related-outcome-conflict');}
  return result;
}
function signature(e:Event){return JSON.stringify([e.kind,e.actorId,e.winnerId,e.discarderId,e.method,e.time.segment,e.level,[...e.yaku].sort(),e.roles,e.basicGain,e.finalRank,e.state,e.milestone,e.occurrences]);}
// Updated 2026-09-14: Candidate interpretations must agree on required facts; rejected legacy paths are never retried.
export function analyzeHighlight(game:Game,players:Player[]):HighlightAnalysis{
  const source=game.highlight??'';
  const version=HIGHLIGHT_ANALYZER_VERSION+':'+HIGHLIGHT_LEXER_VERSION;
  const key=JSON.stringify([version,game.id,source,game.players,game.rules,game.inputMode,players]);
  const saved=cache.get(key);if(saved)return saved;
  const output:HighlightAnalysis={version,source,lexing:null,events:[],diagnostics:[]};
  if(!validHighlight(game.highlight)){output.diagnostics.push('invalid-length');return output;}
  if(!source)return output;
  const roster=players.filter(p=>game.players.some(g=>g.playerId===p.id));
  if(game.players.length!==4||roster.length!==4||new Set(roster.map(p=>p.name.normalize('NFKC'))).size!==4){output.diagnostics.push('ambiguous-roster');return output;}
  const lex=lexHighlight(source,roster);output.lexing=lex;
  const personTokens=lex.tokens.filter(t=>t.kind==='person');
  if(personTokens.some((a,i)=>personTokens.slice(i+1).some(b=>a.value!==b.value&&a.start<b.end&&b.start<a.end))){output.diagnostics.push('overlapping-person-names');return output;}
  if(lex.truncated){output.diagnostics.push('candidate-limit');return output;}
  const interpretations=lex.paths.map(path=>({path,events:interpret(game,path)}));
  // Prefer complete lexical coverage, not whichever interpretation happens to be publishable.
  const unknownCost=(path:Token[])=>path.filter(t=>t.kind==='unknown').reduce((n,t)=>n+t.text.trim().length,0);
  const best=Math.min(...interpretations.map(i=>unknownCost(i.path)));
  const covered=interpretations.filter(i=>unknownCost(i.path)===best);
  // Equal coverage still explores ambiguous word boundaries; composite predicates prefer one lexical unit.
  const minSize=Math.min(...covered.map(i=>i.path.length));
  const candidates=covered.filter(i=>i.path.length===minSize);
  const byAnchor=new Map<string,Event[]>();
  for(const c of candidates)for(const event of c.events){const anchor=event.kind+':'+event.evidence.action[0].start;const bucket=byAnchor.get(anchor)??[];bucket.push(event);byAnchor.set(anchor,bucket);}
  for(const bucket of byAnchor.values()){
    const variants=unique(bucket.filter(e=>e.decision==='accepted').map(signature));
    const event=structuredClone(bucket[0]);
    if(variants.length>1)rejected(event,'multiple-valid-interpretations',true);
    else if(bucket.some(e=>e.decision!=='accepted')){
      const declined=bucket.find(e=>e.decision!=='accepted')!;event.decision=declined.decision;event.state=declined.state;event.reasons=unique(bucket.flatMap(e=>e.reasons));
    }
    output.events.push(event);
  }
  const seen=new Map<string,Event>();
  output.events=output.events.filter(e=>{
    const k=signature(e);const prior=seen.get(k);
    if(prior&&prior.kind==='win'&&e.evidence.source[0].start<=prior.evidence.source.at(-1)!.end+1){prior.evidence.source.push(...e.evidence.source);return false;}
    seen.set(k,e);return true;
  });
  if(!output.events.length)output.diagnostics.push('no-supported-event');
  if(cache.size>=500)cache.clear();cache.set(key,output);return output;
}
