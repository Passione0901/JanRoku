import {useEffect,useRef} from 'react';
type Widget={render:(node:HTMLElement,options:Record<string,unknown>)=>string;remove:(id:string)=>void};
declare global{interface Window{turnstile?:Widget;}}
// Updated 2026-09-14: The server validates every challenge; no secret key is delivered to browsers.
export function BotCheck({siteKey,onToken}:{siteKey:string;onToken:(token:string)=>void}){
 const ref=useRef<HTMLDivElement>(null);
 useEffect(()=>{let widget:string|undefined;let stopped=false;
 const render=()=>{if(!stopped&&ref.current&&window.turnstile&&widget===undefined)widget=window.turnstile.render(ref.current,{sitekey:siteKey,action:'create-group',callback:onToken,'expired-callback':()=>onToken(''),'error-callback':()=>onToken('')});};
 let script=document.querySelector<HTMLScriptElement>('script[data-janroku-turnstile]');
 if(!script){script=document.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';script.dataset.janrokuTurnstile='true';script.async=true;document.head.appendChild(script);}
 script.addEventListener('load',render);render();
 return()=>{stopped=true;script?.removeEventListener('load',render);if(widget!==undefined)window.turnstile?.remove(widget);};
 },[siteKey,onToken]);
 return <div ref={ref} aria-label="ボット確認"/>;
}
