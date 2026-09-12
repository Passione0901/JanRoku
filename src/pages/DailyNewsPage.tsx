import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play, MessageSquare, X, Maximize2 } from 'lucide-react';
import type { Game } from '../domain/types';
import { usePlayers } from '../hooks/usePlayers';
import { useGroup } from '../hooks/useGroup';
import { MahjongAvatar } from '../components/MahjongAvatar';
import { createNewsEdition } from '../domain/news/edition';
import { isNewsAvailable, newsAvailableAt } from '../domain/news/availability';
import { formatDate } from '../utils/date';
import { result, resultClass } from '../utils/format';
import { newsPhoto, type NewsPhoto } from '../domain/news/photos';
import './DailyNewsPage.css';
import { NewsCommentThread } from '../components/NewsCommentThread';

// 最終更新: 2026-09-12 — ニュース内の移動でハッシュルーターを変更しない。キーボードの読み位置も移す。
function scrollToSection(id: string) {
  const node=document.getElementById(id);
  node?.focus({preventScroll:true});
  node?.scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
}
const sections=[['news-front-title','特集'],['news-digest-title','ニュース'],['news-members-title','選手評'],['news-interview-title','インタビュー'],['news-comments-title','コメント']];

// 最終更新: 2026-09-12 — 本文を主役にし、実成績・創作・イメージ画像をそれぞれ明示する。
export default function DailyNewsPage({date,games}:{date:string;games:Game[]}) {
  const {players}=usePlayers();
  const group=useGroup();
  const title=useRef<HTMLHeadingElement>(null);
  const photoDialog=useRef<HTMLDialogElement>(null);
  const [photo,setPhoto]=useState<NewsPhoto|null>(null);
  const [playing,setPlaying]=useState(false);
  const [tick,setTick]=useState(0);
  const [commentsOpen,setCommentsOpen]=useState(true);
  const [activeSection,setActiveSection]=useState('news-front-title');
  const jumpTo=(id:string)=>{
    setActiveSection(id.startsWith('news-member-')?'news-members-title':id);
    scrollToSection(id);
  };
  const generated=useMemo(()=>{
    try{return {edition:createNewsEdition({date,games,players,groupId:group.id,realRecords:true}),error:''};}
    catch(error){return {edition:null,error:error instanceof Error?error.message:'ニュースを作成できませんでした。'};}
  },[date,games,players,group.id]);
  const edition=generated.edition;
  const related=useMemo(()=>{
    if(!edition)return [];
    return [...new Set(games.map(g=>g.date))].filter(d=>d<date&&isNewsAvailable(d)).sort().reverse().slice(0,4).flatMap(d=>{
      try {const news=createNewsEdition({date:d,games,players,groupId:group.id,realRecords:true});return news?[{date:d,headline:news.headline,games:news.gameCount,photo:newsPhoto(news.photos.lead)}]:[];}catch{return [];}
    });
  },[date,games,players,group.id,edition]);
  useEffect(()=>{title.current?.focus();setTick(0);setPlaying(false);setCommentsOpen(true);setActiveSection('news-front-title');photoDialog.current?.close();},[date]);
  useEffect(()=>{
    if(!playing||!edition||edition.ticker.length<2)return;
    const timer=setInterval(()=>setTick(n=>n+1),7000);return()=>clearInterval(timer);
  },[playing,edition]);
  const openPhoto=(image:NewsPhoto)=>{setPhoto(image);photoDialog.current?.showModal();};
  const publication=new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',month:'numeric',day:'numeric',weekday:'short',hour:'numeric',minute:'2-digit',hourCycle:'h23'}).format(new Date(newsAvailableAt(date)??0));
  const illustration=(image:NewsPhoto,side:'left'|'right')=>(
    <figure className={`news-photo news-photo-${side}`}>
      <button onClick={()=>openPhoto(image)} aria-label={`${image.caption}のイメージ画像を拡大`}>
        <img src={image.src} width="1536" height="1024" alt={image.alt} loading={side==='left'?'eager':'lazy'} />
        <Maximize2 size={15} aria-hidden="true" />
      </button>
      <figcaption>{image.caption}（生成イメージ）</figcaption>
    </figure>
  );
  return <div className="daily-news-page">
    <div className="news-utility"><a href={`#/daily/${date}`}>日別の記録に戻る</a><span>{formatDate(date)} の対局</span></div>
    <header className="news-masthead"><h1 ref={title} tabIndex={-1}><span>雀録</span>ニュース</h1><span className="news-publisher">麻雀の一日を、ニュースに。</span></header>
    {!edition?<div className="empty-state" role="status">{generated.error||'この日のニュースはまだありません。'}</div>:<>
      <nav className="news-navigation" aria-label="ニュース内のメニュー">{sections.map(([id,label])=><button key={id} className={activeSection===id?'news-nav-feature':undefined} aria-current={activeSection===id?'location':undefined} onClick={()=>jumpTo(id)}>{label}</button>)}</nav>
      <div className="news-category"><span>スポーツ</span><strong>麻雀</strong><small>{edition.playerCount}人参加 · {edition.formatSummary}</small></div>
      <section className="news-ticker" aria-label="この日の速報テロップ">
        <strong>この日の速報</strong><p aria-live={playing?'off':'polite'}>{edition.ticker[tick%edition.ticker.length]}</p>
        <div className="news-ticker-controls"><button aria-label="前の速報" onClick={()=>setTick(n=>(n+edition.ticker.length-1)%edition.ticker.length)}><ChevronLeft size={16}/></button><span>{tick%edition.ticker.length+1}/{edition.ticker.length}</span><button aria-label="次の速報" onClick={()=>setTick(n=>n+1)}><ChevronRight size={16}/></button><button aria-label={playing?'速報の自動再生を停止':'速報を自動再生'} onClick={()=>setPlaying(v=>!v)}>{playing?<Pause size={15}/>:<Play size={15}/>}</button></div>
      </section>
      <div className="news-layout">
        <div className="news-main-column">
          <article className="news-report" aria-labelledby="news-front-title">
            <header className="news-front"><p className="news-kicker">麻雀 / 日次レポート</p><h2 id="news-front-title" tabIndex={-1}>{edition.headline}</h2>
              <div className="news-article-meta"><time dateTime={new Date(newsAvailableAt(date)!).toISOString()}>{publication} 公開</time><button onClick={()=>jumpTo('news-comments-title')}><MessageSquare size={14}/>架空コメント {edition.comments.length}件</button><span className="news-source">雀録ニュース</span></div>
            </header>
            <div className="news-article">
              <p className="news-dateline">◆ {formatDate(date)}　麻雀会　{edition.formatSummary}・{edition.playerCount}人参加</p>
              {edition.paragraphs.map((text,i)=><Fragment key={i}>{i===0&&illustration(newsPhoto(edition.photos.lead),'left')}{i===2&&edition.paragraphs.join('').length>=600&&illustration(newsPhoto(edition.photos.secondary),'right')}<p>{text}</p></Fragment>)}
            </div>
            <div className="news-article-end"><span>雀録ニュース</span><button onClick={()=>jumpTo('news-comments-title')}><MessageSquare size={15}/>コメントを読む</button></div>
          </article>
          <section className="news-section news-keypoints" aria-labelledby="news-digest-title"><h2 id="news-digest-title" tabIndex={-1}>本日のニュース</h2><ul className="news-digest">{edition.news.map((text,i)=><li key={i}>{text}</li>)}</ul></section>
          {related.length>0&&<section className="news-section" aria-labelledby="news-related-title"><h2 id="news-related-title" tabIndex={-1}>あわせて読みたい</h2><div className="news-related-grid">{related.map(r=><a className="news-related-item" key={r.date} href={`#/daily/${r.date}/news`}><img src={r.photo.src} alt="" width="1536" height="1024" loading="lazy"/><strong>{r.headline}</strong><small>雀録ニュース　{formatDate(r.date)}・{r.games}戦</small></a>)}</div></section>}
          <section className="news-section" aria-labelledby="news-members-title"><h2 id="news-members-title" tabIndex={-1}>選手の一言総評</h2><p className="news-section-note">この日の選手たちに、編集部から一言。</p><div className="news-member-list">{edition.members.map(m=><div className="news-member-row" key={m.id} id={`news-member-${m.id}`} tabIndex={-1}><div className="news-member-name"><span className="news-member-avatar"><MahjongAvatar id={m.id}/></span><strong>{m.name}</strong><small>{m.games}戦</small><b className={resultClass(m.total)}>{result(m.total)}<small> pt</small></b></div><p>{m.summary}</p></div>)}</div></section>
          <section className="news-section" aria-labelledby="news-interview-title"><h2 id="news-interview-title" tabIndex={-1}>試合後の架空インタビュー</h2><p className="news-section-note">本人の発言ではありません。成績を題材にした架空の質問と回答です。</p><div className="news-interviews">{edition.members.map((m,i)=><details key={`${date}-${m.id}`} open={i===0?true:undefined}><summary><span>{m.name}選手</span><small>一問一答</small></summary><dl><dt><b>Q.</b> {m.question}</dt><dd><b>A.</b> {m.answer}</dd></dl></details>)}</div></section>
          <section className="news-section news-reader-comments" aria-labelledby="news-comments-title"><div className="news-comments-heading"><h2 id="news-comments-title" tabIndex={-1}><MessageSquare size={19}/>架空の読者コメント <small>{edition.comments.length}件</small></h2><button aria-expanded={commentsOpen} aria-controls="news-comments-list" onClick={()=>setCommentsOpen(v=>!v)}>{commentsOpen?'閉じる':'表示する'}</button></div><p className="news-section-note">コメント・返信・いいね数は、成績をもとにした創作です。実際の投稿や投票ではありません。</p><div id="news-comments-list" hidden={!commentsOpen}>{edition.commentThreads.map((thread,i)=><NewsCommentThread key={`${date}-${thread.id}`} thread={thread} index={i}/>)}</div></section>
          <div className="news-bottom-link"><a href={`#/daily/${date}`}>日別の記録に戻る<ChevronRight size={16}/></a></div>
        </div>
        <aside className="news-sidebar" aria-label="この日のトピックスと成績">
          <section className="news-side-section"><h2>トピックス（麻雀）</h2><ul className="news-side-topics">{edition.news.map((text,i)=><li key={i}><button onClick={()=>jumpTo('news-digest-title')}>{text}</button></li>)}</ul></section>
          <section className="news-side-section"><h2>この日の成績</h2><ol className="news-side-ranking">{edition.members.slice(0,5).map(m=><li key={m.id}><span className="news-place">{edition.members.findIndex(p=>p.total===m.total)+1}</span><button onClick={()=>jumpTo(`news-member-${m.id}`)}><span className="news-ranking-copy"><strong>{m.name}</strong><b className={resultClass(m.total)}>{result(m.total)}<small> pt</small></b><small>{m.games}戦 · 選手評を読む</small></span><span className="news-ranking-avatar"><MahjongAvatar id={m.id}/></span></button></li>)}</ol><button className="news-see-all" onClick={()=>jumpTo('news-members-title')}>全{edition.playerCount}人の選手評を見る <ChevronRight size={14}/></button></section>
          {related.length>0&&<section className="news-side-section"><h2>過去のニュース</h2><div className="news-side-related">{related.map(r=><a key={r.date} href={`#/daily/${r.date}/news`}><span>{r.headline}<small>{formatDate(r.date)} · {r.games}戦</small></span><img src={r.photo.src} alt="" width="1536" height="1024" loading="lazy"/></a>)}</div></section>}
          <section className="news-side-section news-side-records"><h2>{formatDate(date)} の対局</h2><p>{edition.playerCount}人・{edition.gameCount}戦</p><a href={`#/daily/${date}`}>対局ごとの結果を見る <ChevronRight size={14}/></a></section>
        </aside>
      </div>
    </>}
    <dialog ref={photoDialog} className="news-photo-dialog" aria-labelledby="news-photo-title" onClick={e=>{if(e.target===e.currentTarget)photoDialog.current?.close();}}><div><header><h2 id="news-photo-title">{photo?.caption??'麻雀のイメージ画像'}</h2><button aria-label="画像を閉じる" onClick={()=>photoDialog.current?.close()}><X size={22}/></button></header>{photo&&<img src={photo.src} alt={photo.alt} width="1536" height="1024"/>}<p>生成イメージ。実際の対局を撮影した写真ではありません。</p></div></dialog>
  </div>;
}
