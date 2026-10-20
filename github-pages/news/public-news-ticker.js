// Updated 2026-09-19: Public-only text already in the document; no API requests, group data or private application.
for(const ticker of document.querySelectorAll('[data-news-ticker]')){
 const items=[...ticker.querySelectorAll('[data-ticker-item]')];
 if(items.length<2)continue;
 let index=0,playing=!matchMedia('(prefers-reduced-motion: reduce)').matches,timer;
 const button=ticker.querySelector('[data-ticker-action="play"]');
 const paint=()=>{
  items.forEach((item,i)=>item.hidden=i!==index);
  ticker.querySelector('[data-ticker-count]').textContent=`${index+1}/${items.length}`;
  button.setAttribute('aria-label',playing?'結果の自動再生を停止':'結果を自動再生');
  button.querySelector('[data-ticker-pause]').hidden=!playing;
  button.querySelector('[data-ticker-play]').hidden=playing;
 };
 const schedule=()=>{clearInterval(timer);if(playing&&!document.hidden)timer=setInterval(()=>{index=(index+1)%items.length;paint();},7000);};
 ticker.addEventListener('click',event=>{
  const action=event.target.closest('button')?.dataset.tickerAction;if(!action)return;
  if(action==='play')playing=!playing;else index=(index+(action==='next'?1:items.length-1))%items.length;
  paint();schedule();
 });
 document.addEventListener('visibilitychange',schedule);
 window.addEventListener('pagehide',()=>clearInterval(timer));
 window.addEventListener('pageshow',schedule);
 paint();schedule();
}
