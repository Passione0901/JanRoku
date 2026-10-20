const API = 'https://jang-roku.pages.dev';
const main = document.getElementById('reader-main');
const params = new URLSearchParams(location.search);
const article = params.get('article');
const keyPattern = /^(?:[a-f0-9]{64}|[A-Za-z0-9_-]{43})$/;
let expiryTimer, checkTimer, currentKey;

const element = (tag, text, className) => {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
};
const link = (text, href, className) => Object.assign(element('a',text,className),{href});
function status(title, copy, retry=false) {
  main.replaceChildren();
  const box = element('section',undefined,'reader-status');
  box.setAttribute('role','status');
  box.append(element('h1',title),element('p',copy),link('ニュース一覧へ','./','reader-retry'));
  if (retry) box.append(link('もう一度読み込む',location.href,'reader-retry'));
  main.append(box);
  main.setAttribute('aria-busy','false');
}
async function request(path, method='GET') {
  // Never read stored group keys or send cookies/Authorization to the public reader API.
  const response = await fetch(API+path,{method,credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer'});
  if (!response.ok) throw Object.assign(new Error('load failed'),{status:response.status});
  return method === 'HEAD' ? null : response.json();
}
function expiry(at, callback) {
  clearTimeout(expiryTimer);
  const delay = Date.parse(at)-Date.now();
  if (!Number.isFinite(delay) || delay <= 0) callback();
  else expiryTimer = setTimeout(callback,Math.min(delay,2147483647));
}
function unavailable() {
  clearInterval(checkTimer);
  status('この記事は表示できません','公開期間が終了したか、公開が停止された可能性があります。');
}
async function readArticle() {
  if (!keyPattern.test(article ?? '')) return unavailable();
  const data = await request('/api/news-reader/'+article);
  if (!/^[a-f0-9]{64}$/.test(data.key) || typeof data.html !== 'string' || Date.parse(data.expiresAt) <= Date.now()) return unavailable();
  document.documentElement.dataset.theme = data.theme === 'dark' ? 'dark' : 'light';
  document.body.dataset.article = '';
  document.title = data.headline+'｜雀聞録';
  const style = document.createElement('link');
  style.rel = 'stylesheet'; style.href = './article.css';
  // Wait for the newspaper layout before revealing it to avoid an unstyled flash.
  await new Promise((resolve,reject) => {style.onload=resolve;style.onerror=reject;document.head.append(style);});
  const actions = element('nav',undefined,'reader-article-actions');
  actions.setAttribute('aria-label','記事の操作');
  actions.append(link('← ニュース一覧へ','./'),link('この記事・写真を通報する',API+'/news/read/'+data.key+'#news-report-abuse'));
  const content = element('div');
  // The sole HTML source is our React SSR endpoint: all saved text is escaped, URLs are server-controlled.
  content.innerHTML = data.html;
  main.replaceChildren(content,actions);
  main.setAttribute('aria-busy','false');
  history.replaceState(null,'','?article='+data.key+location.hash);
  const script = document.createElement('script');script.src='./public-news-ticker.js';document.body.append(script);
  expiry(data.expiresAt,unavailable);
  // Recheck availability without adding article views; no cached body survives a return from history.
  currentKey=data.key;
  checkTimer = setInterval(()=>{if(!document.hidden)void checkAvailability();},60000);
}
async function checkAvailability() {
  if (!currentKey) return;
  try {await request('/api/news-reader/'+currentKey,'HEAD');}
  catch (error) {
    clearInterval(checkTimer);
    if ([404,410].includes(error.status)) unavailable();
    else status('公開状況を確認できませんでした','再読み込みして記事を開き直してください。',true);
  }
  main.hidden=false;
}
function tools() {
  const wrapper = element('div',undefined,'reader-tools');
  const search = element('form');search.method='get';search.action='./';search.setAttribute('role','search');
  const label = element('label','記事を検索');
  const input = element('input');input.type='search';input.name='q';input.maxLength=80;input.placeholder='見出し・記事を検索';input.value=params.get('q')??'';
  label.append(input);search.append(label,Object.assign(element('button','検索'),{type:'submit'}));
  const open = element('form');
  const openLabel = element('label','公開記事のURLから開く');
  const url = element('input');url.type='url';url.required=true;url.placeholder='記事のURLを貼り付け';url.setAttribute('aria-label','公開記事のURL');
  const error = element('p');error.setAttribute('role','alert');error.hidden=true;
  openLabel.append(url);open.append(openLabel,Object.assign(element('button','開く'),{type:'submit'}));
  open.addEventListener('submit',event => {
    event.preventDefault();error.hidden=true;
    try {
      const target = new URL(url.value);
      const allowed = ['www.jangbunroku.com','jangbunroku.com','jang-roku.pages.dev'];
      const pathKey = allowed.includes(target.hostname)&&target.protocol==='https:' ? /^\/news\/(?:read\/)?([A-Za-z0-9_-]+)\/?$/.exec(target.pathname)?.[1] : null;
      const ownKey = target.origin===location.origin&&target.pathname===location.pathname ? target.searchParams.get('article') : null;
      const key = pathKey ?? ownKey;
      if (!keyPattern.test(key??'')) throw new Error('invalid link');
      location.href='?article='+key;
    } catch {error.textContent='公開記事のURLを入力してください。グループの招待URLには対応していません。';error.hidden=false;}
  });
  wrapper.append(search,open,error);return wrapper;
}
async function listing() {
  const query = new URLSearchParams();
  for (const key of ['q','cursor']) if (params.has(key)) query.set(key,params.get(key));
  const data = await request('/api/news-reader?'+query);
  const intro = element('section',undefined,'reader-intro');
  intro.append(element('p','MAHJONG JOURNAL','reader-eyebrow'),element('h1','みんなのニュース'),element('p','公開された麻雀ニュースを、ニックネームで。それぞれの卓の、一日の見せ場をお届けします。'));
  main.replaceChildren(intro,tools(),element('p','公開中 '+data.total+'件','reader-count'));
  const grid = element('div',undefined,'reader-grid');
  for (const item of data.items) {
    if (!/^[a-f0-9]{64}$/.test(item.key) || Date.parse(item.expiresAt)<=Date.now()) continue;
    const card = element('article',undefined,'reader-card');
    const anchor = link('','?article='+item.key);
    const image = document.createElement('img');
    image.src=API+'/news/read/'+item.key+'/image.jpg';image.alt='麻雀ニュースの写真';image.loading='lazy';image.referrerPolicy='no-referrer';
    image.addEventListener('error',()=>{image.hidden=true;});
    const date = element('time','対局日 '+item.date.replaceAll('-','/'));date.dateTime=item.date;
    anchor.append(image,date,element('h2',item.headline),element('p',item.excerpt));card.append(anchor);grid.append(card);
    card.dataset.expiresAt=item.expiresAt;
  }
  main.append(grid);
  if (!grid.children.length) main.append(element('p',data.hasCursor?'このページの記事はありません。':'現在、公開中の記事はありません。','reader-status'));
  const nav = element('nav',undefined,'reader-pagination');nav.setAttribute('aria-label','一覧のページ切り替え');
  if (data.hasCursor) nav.append(link('← 最新へ',data.query?'?q='+encodeURIComponent(data.query):'./','reader-next'));
  if (data.nextCursor) {
    const next = new URLSearchParams(query);next.set('cursor',data.nextCursor);
    nav.append(link('次の記事へ →','?'+next,'reader-next'));
  }
  main.append(nav);main.setAttribute('aria-busy','false');
  const expirations = data.items.map(item=>Date.parse(item.expiresAt)).filter(at=>at>Date.now());
  if (expirations.length) expiry(new Date(Math.min(...expirations)).toISOString(),()=>location.reload());
}
try {if (article !== null) await readArticle();else await listing();}
catch (error) {
  if ([404,410].includes(error.status)) unavailable();
  else status('ニュースを読み込めませんでした','通信を確認して、もう一度お試しください。',true);
}
window.addEventListener('pagehide',()=>{clearTimeout(expiryTimer);clearInterval(checkTimer);main.replaceChildren();});
window.addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
document.addEventListener('visibilitychange',()=>{
  if (article===null) return;
  if (document.hidden) main.hidden=true;
  else void checkAvailability();
});
