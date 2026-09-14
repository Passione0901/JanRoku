import dictionary from '../../content/daily-news/highlight-dictionary.json';
import { validHighlight } from '../highlightText';
import type { Game, Player } from '../types';

export interface HighlightEvent {
  gameId: string; playerId: string; name: string; event: string; description: string;
  points: number; pointsKnown: boolean; comeback: boolean;
}
const cache = new Map<string, HighlightEvent | null>();
const aliases = [...new Map([...Object.values(dictionary.aliases).map(v=>[v,v] as [string,string]), ...Object.entries(dictionary.aliases), ['オーラス','オーラス']]).entries()].sort((a,b) => b[0].length-a[0].length);
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// チートイ＋ツモ must not consume the first ツ as part of チートイツ.
const boundaries: Record<string,string> = dictionary.aliasBoundaries;
const aliasPattern = new RegExp(aliases.map(([key])=>escape(key)+(boundaries[key]?`(?!${escape(boundaries[key])})`:'')).join('|'), 'g');
const aliasMap = new Map(aliases);
const normalize = (text: string) => text.normalize('NFKC').replace(/(?<=\d),(?=\d{3}(?:\D|$))/g, '').replace(/\s/g,'');
type TermRule = { actions: string[]; level?: string; role?: string };
const terms: Record<string, TermRule> = dictionary.terms;
const termNames = [...Object.keys(dictionary.levels), 'ダブルリーチ一発','リーチ一発','リーチ', ...Object.keys(terms)].sort((a,b)=>b.length-a.length);
const fields: Record<string,string> = {
  role:'(?<role>親|子)', role2:'(?<role2>親|子)', term:`(?<term>${termNames.map(escape).join('|')})`,
  action:'(?<action>ツモ|ロン|和了)', all:'(?:(?<all>\\d+)(?:点)?オール)',
};
// Updated 2026-09-14: Compile ten data-authored grammars once; all share the same contradiction checks.
const grammars = dictionary.grammars.map(g=>new RegExp('^'+g.pattern.replace(/\{(\w+)\}/g,(_,key:string)=>fields[key])+'$'));
const excluded = new RegExp(dictionary.excluded);

// Updated 2026-09-14: Accept complete, constrained sentences only. No fuzzy names or unknown-tail salvage.
export function parseHighlight(game: Game, players: Player[]): HighlightEvent | null {
  const key = JSON.stringify([dictionary.version, game.highlight, game.id, game.players.map(p=>[p.playerId,p.rank]), players.map(p=>[p.id,p.name])]);
  if (cache.has(key)) return cache.get(key)!;
  const result = parse(game, players);
  if (cache.size >= 500) cache.clear();
  cache.set(key, result);
  return result;
}
function parse(game: Game, players: Player[]): HighlightEvent | null {
  if (!validHighlight(game.highlight) || !game.highlight || game.players.length !== 4) return null;
  let text = normalize(game.highlight);
  const roster = players.filter(p=>game.players.some(e=>e.playerId===p.id));
  const people = roster.filter(p => normalize(p.name) && text.startsWith(normalize(p.name)));
  // Prefix collisions are deliberately rejected rather than guessing a surname or nickname.
  if (people.length !== 1) return null;
  const person = people[0];
  text = text.slice(normalize(person.name).length).replace(/^(?:選手|さん)/,'');
  if (!/^(?:が|は)/.test(text)) return null;
  text = text.slice(1);
  // A single explicit ron opponent is allowed; any other second person remains unmatched and is rejected.
  let opponent: Player | undefined;
  const opponents = roster.filter(p=>p.id!==person.id && text.startsWith(normalize(p.name)));
  if (opponents.length > 1) return null;
  if (opponents.length === 1) {
    opponent = opponents[0];
    const rest = text.slice(normalize(opponent.name).length).replace(/^(?:選手|さん)/,'');
    if (!rest.startsWith('から')) return null;
    text = rest.slice(2);
  }
  text = text.replace(aliasPattern, word => aliasMap.get(word)!).replace(/[。!！]+$/,'');
  // Check after removing participant names and normalizing: Wリーチ is a term, not laughter.
  if (excluded.test(text)) return null;
  let comeback = false, finalTop = false;
  text = text.replace(/(?:で)?最下位から(?:途中で|一時)?トップ(?:に浮上した|になった|に浮上|になり逆転した|で終了した|で終えた)$/, match => {
    comeback = true; finalTop = /終了|終え/.test(match); return '';
  });
  if (finalTop && game.players.find(p=>p.playerId===person.id)?.rank !== 1) return null;
  const suffixes = [...dictionary.suffixes].filter(Boolean).sort((a,b)=>b.length-a.length);
  for (const suffix of suffixes) if (text.endsWith(suffix)) { text=text.slice(0,-suffix.length); break; }
  const opening = text.includes('初手');
  text = text.replace(/^(?:東[1-4]局|南[1-4]局|オーラス)(?:で|に)?/,'').replace(/^初手/,'');
  const m = grammars.map(pattern=>text.match(pattern)?.groups).find(Boolean);
  if (!m || (m.role && m.role2 && m.role!==m.role2) || (opponent && m.action!=='ロン')) return null;
  const statedRole = m.role || m.role2;
  const term = m.term ?? '';
  const rule = terms[term];
  if (rule && (!rule.actions.includes(m.action) || (rule.role && statedRole && rule.role!==statedRole))) return null;
  if (opening && ['海底摸月','河底撈魚','嶺上開花','槍槓'].includes(term)) return null;
  const role = statedRole || rule?.role;
  const level = rule?.level ?? term;
  const action = m.action;
  if (['ダブルリーチ一発','リーチ一発','リーチ'].includes(term) && action !== 'ツモ') return null;
  const all = m.all ? Number(m.all) : null;
  if (all !== null && (role==='子' || action!=='ツモ' || !Number.isSafeInteger(all) || all<=0)) return null;
  const dealer = role==='親' || all !== null;
  const table = dictionary.levels as Record<string, number[]>;
  let points = 0;
  let pointsKnown = false;
  if (table[level]) {
    points = table[level][dealer ? 1 : 0];
    pointsKnown = !!role || all !== null;
    if (all !== null && all * 3 !== points) return null;
  } else if (all !== null) {
    // Unknown fu/han cannot establish a valid payment, so do not infer it from a naked number.
    return null;
  }
  if (action==='和了' && !table[level] && !rule) return null;
  const events: Record<string,string> = {役満:'yakuman',三倍満:'sanbaiman',倍満:'baiman',跳満:'haneman',満貫:'mangan',ダブルリーチ一発:'double-riichi-ippatsu',リーチ一発:'riichi-ippatsu',リーチ:'riichi-tsumo'};
  const event = events[level] ?? (comeback ? 'comeback' : 'win');
  const verb = action==='ツモ' ? 'ツモ和了' : action==='ロン' ? 'ロン和了' : '和了';
  const detail = `${dealer?'親で':role==='子'?'子で':''}${['ダブルリーチ一発','リーチ一発','リーチ'].includes(term) ? term.replace('リーチ一発','リーチから一発')+'ツモ' : (term ? term+'を' : '')+verb}`;
  const description = `${person.name}選手が${opponent ? opponent.name+'選手から' : ''}${detail}${all!==null?'。'+all.toLocaleString('ja-JP')+'点オール':''}${comeback ? finalTop ? '。最下位から逆転し、トップで終了' : '。最下位からトップに浮上' : ''}`;
  return {gameId:game.id,playerId:person.id,name:person.name,event,description,points,pointsKnown,comeback};
}
export function rankHighlights(events: HighlightEvent[], mentions = new Map<string, number>()) {
  return [...events].sort((a,b)=>b.points-a.points || Number(b.comeback)-Number(a.comeback) || (mentions.get(a.playerId)??0)-(mentions.get(b.playerId)??0) || a.gameId.localeCompare(b.gameId));
}
