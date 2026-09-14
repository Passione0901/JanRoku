import { expect, it } from 'vitest';
import dictionary from '../../content/daily-news/highlight-dictionary.json';
import { fixture } from '../../test/fixtures';
import { parseHighlight } from './highlights';
const players=['山田','田中','伊藤','斎藤'].map((name,i)=>({id:`sample0${i+1}`,name,color:'#123456'}));
const parse=(text:string)=>parseHighlight({...fixture('dictionary','2026-09-01'),highlight:'山田が'+text},players);
// Updated 2026-09-14: Every registered spelling must work in a complete, supported statement.
function sentence(word:string,canonical:string):string {
  if(canonical==='トップ')return `役満ツモで最下位から${word}になった`;
  if(canonical==='最下位')return `役満ツモで${word}からトップになった`;
  if(/^[東南][1-4]局$/.test(canonical)||canonical==='オーラス')return `${word}で満貫ツモ`;
  if(canonical==='一発')return `リーチ${word}ツモ`;
  if(['ツモ','ロン','和了'].includes(canonical))return `満貫${word}`;
  if(canonical==='リーチツモ')return word;
  if(['槍槓','河底撈魚'].includes(canonical))return `${word}ロン`;
  return `${word}ツモ`;
}
it('has at least 200 additional spellings and ten distinct complete grammars',()=>{
  expect(Object.keys(dictionary.aliases).length).toBeGreaterThanOrEqual(240);
  expect(dictionary.grammars).toHaveLength(10);
  expect(new Set(dictionary.grammars.map(g=>g.pattern)).size).toBe(10);
});
it.each(Object.entries(dictionary.aliases))('accepts spelling %s as %s',(alias,canonical)=>{
  const actual=parse(sentence(alias,canonical));
  expect(actual).not.toBeNull();
  expect(actual).toEqual(parse(sentence(canonical,canonical)));
});
it.each(dictionary.grammars)('accepts full grammar $id and rejects speculation',({example})=>{
  expect(parse(example)).not.toBeNull();
  for(const tail of ['かも','ではなかった','を狙った','らしい','？','に失敗','という話','田中も役満'])expect(parse(example+tail)).toBeNull();
});
it.each([
  ['チートイをロン','七対子'],['ホンイツのツモ','混一色'],['メンタンピンをロン','リーチ断么九平和'],
  ['ツモで国士','国士無双'],['親番で三倍満をツモ','三倍満'],['満貫を和了(ロン)','満貫'],
])('preserves reported yaku: %s',(text,name)=>expect(parse(text)?.description).toContain(name));
it.each(['天和ロン','子の天和ツモ','親の地和ツモ','嶺上開花ロン','河底ツモ','海底ロン','槍槓ツモ','四暗刻ロン','初手海底ツモ','チートイ三暗刻ロン','リーチツモ未遂','国士テンパイ','役満ツモじゃなかった','国士十三面ツモ','四暗刻単騎ロン','数え役満ツモ','役満ツモに失敗','親番で子役満ツモ','ツモ(役満かも)','役満を和了(ツモできず)'])('rejects contradictory or incomplete claim: %s',text=>expect(parse(text)).toBeNull());
it('does not invent a score for an ordinary named yaku',()=>{
  const event=parse('チンイツロン')!;
  expect(event.points).toBe(0);expect(event.pointsKnown).toBe(false);
  expect(event.description).not.toMatch(/満貫|点/);
});
