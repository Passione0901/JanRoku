import type { NewsEdition, NewsTemplate } from './edition';
import type { Facts, NewsSource, NewsSubject } from './facts';
import type { CommentSource } from './discussion';
import { createCopyDesk, copyHash } from './editorial';
import type { CopyHistory } from './repetition';
import { parseHighlights, rankHighlights } from './highlights';
import reversals from '../../content/daily-news/highlight-reversals.json';
import { formatDate } from '../../utils/date';
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
  const stories: {playerId:string; text:string}[]=[];
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
    const gameNumber=dayGames.findIndex(g=>g.id===event.gameId)+1;
    // Updated 2026-09-15: A verified event is already a complete fact, not a template insert to repeat.
    let body=event.articleDescription ?? event.description;
    const previous=stories.at(-1);
    if(previous?.playerId===event.playerId && previous.text.length+body.length<220 && body.startsWith(event.name+'選手が')) {
      body=body.slice((event.name+'選手が').length);
      previous.text+=` 第${gameNumber}戦には${body}。`;
    } else stories.push({playerId:event.playerId,text:`第${gameNumber}戦、${body}。`});
    const kinds:Kind[]=['headline','news','summary','interview','reader'];
    const start=adopted===0 ? 0 : copyHash(source.date+'/'+event.gameId)%kinds.length;
    for(let i=0;i<kinds.length;i++){
      const kind=kinds[(start+i)%kinds.length];
      if(slots.has(kind)||(kind==='headline'&&adopted!==0))continue;
      const picked=pick(kind) ?? (kind==='headline'?{id:'highlight-factual-headline',text:event.articleDescription??event.description,question:'',answer:''}:null);if(!picked)continue;
      const member=draft.members.find(m=>m.id===event.playerId)!;
      if(kind==='headline')draft.headline=picked.text;
      else if(kind==='news')draft.news.splice(0,1,`${event.articleDescription??event.description}。`);
      else if(kind==='summary')member.summary=picked.text;
      else if(kind==='interview'){member.question=picked.question;member.answer=picked.answer;}
      else comments.splice(comments.length-1,1,{id:picked.id,text:picked.text,event:'highlight-'+event.event,facts});
      slots.add(kind);break;
    }
    people.add(event.playerId);adoptedEvents.add(eventKey);adopted++;
    if(!required)optionalAdopted++;
  }
  if(stories.length){
    // The lead follows the same highest-priority event as the headline; keep every major occurrence.
    const intro=`${formatDate(source.date)}の麻雀会は、${subjects.length}人が参加して${dayGames.length}戦を行った。`;
    draft.paragraphs.splice(0,1,stories[0].text+' '+intro,...stories.slice(1).map(s=>s.text));
    while(draft.paragraphs.join('').length>1550){
      let index=-1;
      for(let i=draft.paragraphs.length-1;i>=0;i--)if(originalBody.has(draft.paragraphs[i])){index=i;break;}
      if(index<0)break;
      draft.paragraphs.splice(index,1);
    }
  }
  return adopted>0;
}
