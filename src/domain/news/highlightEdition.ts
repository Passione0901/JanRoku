import type { NewsEdition, NewsTemplate } from './edition';
import type { Facts, NewsSource, NewsSubject } from './facts';
import type { CommentSource } from './discussion';
import { createCopyDesk, copyHash } from './editorial';
import type { CopyHistory } from './repetition';
import { parseHighlights, rankHighlights } from './highlights';
import reversals from '../../content/daily-news/highlight-reversals.json';
type Kind = 'headline'|'news'|'summary'|'interview'|'article'|'reader';
type Draft = Pick<NewsEdition,'headline'|'news'|'paragraphs'|'members'>;
const indices = new WeakMap<object, Map<string, NewsTemplate[]>>();
// Updated 2026-09-15: Preserve every major event in the body; ordinary candidates retain bounded coverage.
export function applyHighlights(draft: Draft, source: NewsSource, subjects: NewsSubject[], catalogs: Record<Kind,{templates:NewsTemplate[]}>, history: CopyHistory, editionIndex: number, eligible: (t:NewsTemplate,f:Facts)=>boolean, comments: CommentSource[]) {
  const mentions = new Map(subjects.map(s=>[s.id, draft.paragraphs.filter(p=>p.includes(s.name+'選手')).length]));
  const dayGames = source.games.filter(g=>g.date===source.date).sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id));
  const ranked = rankHighlights(dayGames.flatMap(g=>parseHighlights(g,source.players)), mentions).filter(e=>e.editorial!=='routine');
  const events = [...ranked.filter(e=>e.editorial==='required'),...ranked.filter(e=>e.editorial!=='required')];
  const desk=createCopyDesk(source.groupId,editionIndex,history);
  const people=new Set<string>();
  const adoptedEvents=new Set<string>();
  const slots=new Set<Kind>();
  let adopted=0;
  let optionalAdopted=0;
  const originalBody=new Set(draft.paragraphs.slice(1,-1));
  for(const event of events){
    const required=event.editorial==='required';
    if(!required&&optionalAdopted>=2)continue;
    const eventKey=event.gameId+'/'+(event.id??event.playerId+'/'+event.event);
    if((!required&&people.has(event.playerId))||adoptedEvents.has(eventKey))continue;
    const subject=subjects.find(s=>s.id===event.playerId);
    if(!subject)continue;
    const facts:Facts={...subject.facts,'highlight.valid':true,'highlight.event':event.event,'highlight.description':event.description,'highlight.points':event.points};
    const fill=(text:string)=>text.replace(/\{([\w.]+)\}/g,(_,key:string)=>String(facts[key]));
    const pick=(kind:Kind)=>{
      if(event.outcomeOnly){
        const entries=reversals[kind] as {id:string;text?:string;question?:string;answer?:string}[];
        return desk('highlight-'+kind,event.playerId,entries.map(t=>({id:t.id,text:fill(t.text??''),question:fill(t.question??''),answer:fill(t.answer??'')})));
      }
      const catalog=catalogs[kind];
      let index=indices.get(catalog);
      if(!index){index=new Map();for(const t of catalog.templates)if(t.topic==='highlight'){const bucket=index.get(t.event)??[];bucket.push(t);index.set(t.event,bucket);}indices.set(catalog,index);}
      const options=(index.get('highlight-'+event.event)??[]).filter(t=>eligible(t,facts)).map(t=>({id:t.id,text:t.text?fill(t.text):'',question:t.question?fill(t.question):'',answer:t.answer?fill(t.answer):''}));
      return desk('highlight-'+kind,event.playerId,options);
    };
    const paragraph=pick('article');
    if(!paragraph&&!required)continue;
    const gameNumber=dayGames.findIndex(g=>g.id===event.gameId)+1;
    const body=paragraph?.text ?? `${event.description}。参加者の対局メモに記された節目として、この日の記事に残したい。`;
    draft.paragraphs.splice(1+adopted,0,required?`第${gameNumber}戦のハイライト。${body}`:body);
    // Remove only pre-existing optional paragraphs, never a previously adopted major event.
    while(draft.paragraphs.join('').length>1550){
      let removable=-1;
      for(let i=draft.paragraphs.length-1;i>=0;i--)if(originalBody.has(draft.paragraphs[i])){removable=i;break;}
      if(removable<0)break;
      draft.paragraphs.splice(removable,1);
    }
    const kinds:Kind[]=['headline','news','summary','interview','reader'];
    const start=adopted===0 && event.points>=12000 ? 0 : copyHash(source.date+'/'+event.gameId)%kinds.length;
    for(let i=0;i<kinds.length;i++){
      const kind=kinds[(start+i)%kinds.length];
      if(slots.has(kind)||(kind==='headline'&&event.points<12000))continue;
      const picked=pick(kind);if(!picked)continue;
      const member=draft.members.find(m=>m.id===event.playerId)!;
      if(kind==='headline')draft.headline=picked.text;
      else if(kind==='news')draft.news.splice(0,1,picked.text);
      else if(kind==='summary')member.summary=picked.text;
      else if(kind==='interview'){member.question=picked.question;member.answer=picked.answer;}
      else comments.splice(comments.length-1,1,{id:picked.id,text:picked.text,event:'highlight-'+event.event,facts});
      slots.add(kind);break;
    }
    people.add(event.playerId);adoptedEvents.add(eventKey);adopted++;
    if(!required)optionalAdopted++;
  }
  return adopted>0;
}
