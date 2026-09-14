import { useEffect, useState } from 'react';
import type { Player } from '../domain/types';
import type { HighlightGame } from '../domain/news/highlightTypes';

type Preview = {key:string;lines:{description:string;policy:string}[];message?:string};
// Updated 2026-09-15: Load the shared parser only after blur, and discard stale asynchronous results.
export function HighlightPreview({ game, members, enabled }: {game?:HighlightGame;members:Player[];enabled:boolean}) {
  const key=JSON.stringify([game,members]);
  const [preview,setPreview]=useState<Preview|null>(null);
  useEffect(()=>{
    if(!enabled||!game?.highlight?.trim())return;
    let cancelled=false;
    const timer=setTimeout(async()=>{
      try{
        const [current,roster]=JSON.parse(key) as [HighlightGame,Player[]];
        if(new Set(current.players.map(p=>p.playerId).filter(id=>roster.some(p=>p.id===id))).size!==4){
          if(!cancelled)setPreview({key,lines:[],message:'4人のメンバーを選ぶと、読み取り結果を確認できます。'});
          return;
        }
        const {parseHighlights}=await import('../domain/news/highlights');
        if(cancelled)return;
        const events=parseHighlights(current,roster);
        const lines=events.map(event=>({description:event.description,policy:event.editorial==='required'
          ? '記事本文に掲載する重要な出来事です。'
          : event.editorial==='routine' ? '通常の和了のため、ニュースには採用しません。' : 'ニュースの採用候補です。'}));
        setPreview({key,lines,message:lines.length?undefined:'ニュースに使える出来事を読み取れませんでした。原文はそのまま保存できます。'});
      }catch{if(!cancelled)setPreview({key,lines:[],message:'読み取り結果を表示できませんでした。原文はそのまま保存できます。'});}
    },250);
    return()=>{cancelled=true;clearTimeout(timer);};
  },[key,enabled]);
  if(!enabled||!game?.highlight?.trim()||preview?.key!==key)return null;
  return <div className="highlight-preview" role="status" aria-live="polite">
    {preview.message ? <p>{preview.message}</p> : <>
      <strong>読み取れた内容</strong>
      <ul>{preview.lines.map((line,index)=><li key={index}>{line.description}<small>{line.policy}</small></li>)}</ul>
    </>}
  </div>;
}
