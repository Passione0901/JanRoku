import language from '../../content/daily-news/highlight-colloquial.json';
import type { Game, Player } from '../types';
import type { HighlightEvent } from './highlights';
const esc=(s:string)=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const choices=(items:string[])=>items.slice().sort((a,b)=>b.length-a.length).map(esc).join('|');
const reaction=new RegExp(`(?:で|、)?(?:${choices(language.reactions)}|[wｗ]+)$`);
const past=new RegExp(`(ツモ|つも)(?:${choices(language.pastEndings)})(?=$|で|けど|逆転)`,'g');
const done=new RegExp(`(?:${choices(language.doneEndings)})$`);
const win=new RegExp(`(?:を)?(?:${choices(language.winEndings)})$`);
const attempts=new RegExp(`^(.+?)(?:を)?(?:${choices(language.discardableAttempts)})(?:けど|が|、でも)(.+)$`);
const deal=new RegExp(`^@(?<other>[0-3])に(?<hand>.+?)(?:を)?(?:${choices(language.dealInVerbs)})$`);
const hit=new RegExp(`^(?<hand>.+?)(?:を)?@(?<other>[0-3])に(?:${choices(language.hitVerbs)})$`);
// Updated 2026-09-14: Only known sentiment/context may be omitted; never salvage arbitrary unknown text.
export function parseColloquial(game:Game, players:Player[], canonical:(s:string)=>string, strict:(g:Game,p:Player[])=>HighlightEvent|null, knownTerms:ReadonlySet<string>):HighlightEvent|null {
  const raw=game.highlight!.normalize('NFKC').replace(/(?<=\d),(?=\d{3}(?:\D|$))/g,'').replace(/\s/g,'');
  const roster=players.filter(p=>game.players.some(g=>g.playerId===p.id));
  const names=roster.map(p=>p.name.normalize('NFKC').replace(/\s/g,''));
  if(names.some(n=>!n)||new Set(names).size!==names.length)return null;
  // Names are replaced before lexical normalization, so yaku-like names remain intact.
  let ambiguous=false;
  const masked=raw.replace(new RegExp(names.slice().sort((a,b)=>b.length-a.length).map(esc).join('|'),'g'),name=>{
    if(names.filter(n=>name.startsWith(n)).length!==1)ambiguous=true;
    return '@'+names.indexOf(name);
  });
  if(ambiguous)return null;
  const start=masked.match(/^@([0-3])(?:さん|選手)?(?:が|は)(.+)$/);
  if(!start)return null;
  let actor=Number(start[1]);
  let body=start[2].replace(/[。!！]+$/,'');
  body=body.replace(reaction,'');
  body=body.replace(past,'$1');
  body=canonical(body).replace(/@([0-3])(?:さん|選手)/g,'@$1');
  // A known failed attempt is not evidence of a win; only the explicit contrasting event survives.
  const contrast=body.match(attempts);
  if(contrast){
    const attempted=contrast[1].replace(/を$/,'');
    if(!knownTerms.has(attempted))return null;
    body=contrast[2];
  }
  // A reported rank reversal is not evidence of a win; use outcome-only editorial resources.
  let outcome:string|undefined;
  if(/^(?:最下位|箱下)から(?:一局で)?トップ(?:になった|まで戻ってきた)$/.test(body))outcome=body;
  else if(/^(?:オーラスで)?(?:まさかの)?逆転(?:した|してた)?$/.test(body))outcome='順位を逆転した';
  else if(/^(?:オーラス)?\d+点差で逆転(?:した|してた)$/.test(body))outcome=body.replace('オーラス','').replace(/してた$/,'した');
  else if(/^\d+点差をひっくり返した$/.test(body))outcome=body;
  const pass=body.match(/^(\d+)点差で@([0-3])をまくった$/);
  if(pass&&Number(pass[2])!==actor)outcome=`${roster[Number(pass[2])].name}選手を${pass[1]}点差で逆転した`;
  if(outcome)return {gameId:game.id,playerId:roster[actor].id,name:roster[actor].name,event:'comeback',description:`${roster[actor].name}選手が${outcome}`,points:0,pointsKnown:false,comeback:true,outcomeOnly:true};
  const callContext=body.match(/^(?:[1-3]回(?:槓|カン)(?:して)?から(?:の)?|大明槓した直後に)(.+)$/);
  if(callContext){
    if(!callContext[1].startsWith('嶺上開花'))return null;
    body=callContext[1];
  }
  let reversal=false;
  if(/(?:で)?逆転(?:してた|していた|した)$/.test(body)){
    body=body.replace(/(?:で)?逆転(?:してた|していた|した)$/,'');
    reversal=true;
  }
  let completed=false;
  if(win.test(body)){body=body.replace(win,'');completed=true;}
  else if(done.test(body)){body=body.replace(done,'');completed=true;}
  // A role followed by で is a common conversational variant of 親の/子の.
  body=body.replace(/^(親|子)で/,'$1の');
  const paid=body.match(/^(親の)?(6000|8000|12000|16000)(?:点)?オールツモ$/);
  if(paid){
    const levels:Record<string,string>={'6000':'跳満','8000':'倍満','12000':'三倍満','16000':'役満'};
    body=`親${levels[paid[2]]}ツモで${paid[2]}オール`;
  }
  let loser:number|undefined;
  let bust=false;
  if(body.endsWith('振り込んで飛んだ')){body=body.replace(/振り込んで飛んだ$/,'振り込んだ');bust=true;}
  const d=body.match(deal)?.groups;
  const h=body.match(hit)?.groups;
  const possessive=body.match(/^@([0-3])の(.+?)に(?:振り込んだ|振り込んでた|振った)$/);
  const bustHit=body.match(/^(親)?(役満|三倍満|倍満|跳満|満貫)で@([0-3])を飛ば(?:した)?$/);
  if(d){loser=actor;actor=Number(d.other);body=`@${loser}から${d.hand.replace(/を$/,'')}ロン`;}
  else if(h){loser=Number(h.other);body=`@${loser}から${h.hand.replace(/を$/,'')}ロン`;}
  else if(possessive){loser=actor;actor=Number(possessive[1]);body=`@${loser}から${possessive[2]}ロン`;}
  else if(bustHit&&(completed||body.endsWith('した'))){loser=Number(bustHit[3]);bust=true;body=`${bustHit[1]??''}${bustHit[2]}和了`;}
  // Same-person transfers and unknown/inconsistent bust records cannot become news.
  if(loser===actor)return null;
  if(bust){
    const result=game.players.find(p=>p.playerId===roster[loser!]?.id);
    if(!result||result.rawScore===null||game.inputMode==='results'||(game.rules.bustIncludesZero?result.rawScore>0:result.rawScore>=0))return null;
  }
  body=body.replace(/^(嶺上開花|海底摸月|槍槓|河底撈魚)で(@[0-3]から)(ツモ|ロン)$/,'$2$1$3');
  const rinshanScore=body.match(/^嶺上開花で(親)?(満貫|跳満|倍満|三倍満|役満)になった$/);
  if(rinshanScore)body=`${rinshanScore[1]??''}${rinshanScore[2]}ツモ`;
  if(body==='残り1枚の牌を一発でツモ')body='ツモ';
  if(completed){
    if(language.implicitTsumo.includes(body))body+='ツモ';
    else if(language.implicitRon.includes(body))body+='ロン';
    else if(knownTerms.has(body)&&!/(?:ツモ|ロン|和了)$/.test(body))body+='和了';
  }
  // The omitted kan context is not repeated; a named rinshan is itself an explicit tsumo win.
  if(callContext&&body==='嶺上開花')body+='ツモ';
  body=body.replace(/@([0-3])/g,(_,n:string)=>roster[Number(n)].name);
  const event=strict({...game,highlight:roster[actor].name+'が'+body},players);
  if(event&&reversal){event.comeback=true;event.description+='。順位を逆転した';}
  if(event&&rinshanScore)event.description+='。嶺上開花での和了';
  if(event&&bust)event.description+=`。${roster[loser!].name}選手が飛びとなった`;
  return event;
}
