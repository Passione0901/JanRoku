import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';

const html=readFileSync('github-pages/news/index.html','utf8');
const code=readFileSync('github-pages/news/reader.js','utf8');
const key='a'.repeat(64),oldKey='b'.repeat(43),expiresAt=new Date(Date.now()+600000).toISOString();
async function browser(query,responder) {
  const dom=new JSDOM(html,{url:'https://passione0901.github.io/JanRoku/news/'+query,runScripts:'outside-only'});
  const calls=[];
  dom.window.fetch=async(url,options)=>{calls.push({url,options});return responder(url,options);};
  const append=dom.window.document.head.append.bind(dom.window.document.head);
  dom.window.document.head.append=node=>{append(node);if(node.tagName==='LINK')queueMicrotask(()=>node.onload?.());};
  await dom.window.eval('(async()=>{'+code+'})()');
  return {dom,calls,document:dom.window.document};
}
const json=value=>new Response(JSON.stringify(value),{headers:{'Content-Type':'application/json'}});
const list=await browser('',()=>json({total:1,query:'',items:[{key,headline:'匿名Aの一日',excerpt:'<script>literal text</script>',date:'2026-10-20',expiresAt}],nextCursor:null}));
assert.equal(list.document.querySelector('.reader-card a').getAttribute('href'),'?article='+key);
assert.equal(list.document.querySelector('.reader-card p').textContent,'<script>literal text</script>');
assert.equal(list.document.querySelector('.reader-card p script'),null);
assert.ok(list.document.querySelector('img').src.startsWith('https://jang-roku.pages.dev/news/read/'));
assert.equal(list.calls[0].options.credentials,'omit');
assert.equal(list.calls[0].options.cache,'no-store');
list.dom.window.close();
const opened=await browser('?article='+oldKey,()=>json({key,headline:'匿名Aの一日',theme:'light',expiresAt,
  html:'<article><h2>匿名Aの一日</h2><p>本文</p><a href="./">みんなのニュース</a></article>'}));
assert.equal(opened.document.querySelector('#reader-main h2').textContent,'匿名Aの一日');
assert.equal(opened.dom.window.location.search,'?article='+key);
assert.equal(opened.document.querySelector('link[href="./article.css"]').rel,'stylesheet');
assert.ok(!opened.document.querySelector('#reader-main').innerHTML.includes('www.jangbunroku.com'));
opened.dom.window.close();
for(const status of [410,503]) {
  const failed=await browser('?article='+key,()=>new Response('',{status}));
  assert.ok(failed.document.getElementById('reader-main').textContent.includes(status===410?'この記事は表示できません':'ニュースを読み込めませんでした'));
  assert.equal(failed.document.querySelector('#reader-main article'),null);
  failed.dom.window.close();
}
const invalid=await browser('?article=not-a-key',()=>{throw new Error('must not request invalid keys');});
assert.equal(invalid.calls.length,0);invalid.dom.window.close();
console.log('PASS: GitHub listing, safe text, anonymous article routing, no credentials, unavailable states');
