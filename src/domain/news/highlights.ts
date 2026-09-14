import dictionary from '../../content/daily-news/highlight-dictionary.json';
import type { Player } from '../types';
import type { HighlightGame as Game } from './highlightTypes';
import { analyzeHighlight } from './highlightAnalysis';
import type { HighlightAnalysis, StructuredHighlight } from './highlightTypes';

export interface HighlightEvent {
  id?: string;
  gameId: string; playerId: string; name: string; event: string; description: string;
  points: number; pointsKnown: boolean; comeback: boolean;
  outcomeOnly?: boolean;
  editorial?: 'required'|'candidate'|'routine';
  milestone?: boolean;
}

const eventLevels: Record<string,string> = {
  '役満':'yakuman', '三倍満':'sanbaiman', '倍満':'baiman', '跳満':'haneman', '満貫':'mangan',
};
const namedYaku = new Set([...Object.keys(dictionary.terms), 'リーチ', '一発', 'ダブルリーチ', 'ダブルリーチ一発', 'リーチ一発']);

// Updated 2026-09-14: Presentation only consumes validated frames; it never rewrites or reparses the memo.
export function presentHighlightAnalysis(analysis: HighlightAnalysis, game: Game, players: Player[]): HighlightEvent[] {
  const roster = new Map(players.filter(p=>game.players.some(g=>g.playerId===p.id)).map(p=>[p.id,p]));
  const accepted = analysis.events.filter(e=>e.gameId===game.id && e.state==='asserted' && e.decision==='accepted');
  const byId = new Map(accepted.map(e=>[e.id,e]));
  const merged = new Set<string>();
  const rendered: HighlightEvent[] = [];
  const seen = new Set<string>();
  // Wins are rendered before their explicitly linked outcomes, independent of analyzer output order.
  for (const frame of [...accepted].sort((a,b)=>Number(b.kind==='win')-Number(a.kind==='win'))) {
    if (merged.has(frame.id) || seen.has(frame.id)) continue;
    seen.add(frame.id);
    const person = roster.get((frame.kind==='win' ? frame.winnerId : frame.actorId) ?? '');
    if (!person) continue;
    if (frame.kind==='bust') continue; // There is no standalone bust editorial resource.
    if (frame.kind==='reversal') {
      const detail = reversalText(frame, roster);
      if (detail) rendered.push({id:frame.id,gameId:game.id,playerId:person.id,name:person.name,event:'comeback',description:detail,points:0,pointsKnown:false,comeback:true,outcomeOnly:true});
      continue;
    }
    if (!frame.method || (frame.discarderId && (frame.discarderId===person.id || frame.method!=='ron' || !roster.has(frame.discarderId)))) continue;
    const role = frame.roles[person.id];
    const roleText = role==='dealer' ? '親で' : role==='nondealer' ? '子で' : '';
    const yaku = [...new Set(frame.yaku.filter(term=>namedYaku.has(term)))];
    const yakuText = yaku.join('・');
    const hand = yakuText || (frame.level && eventLevels[frame.level] ? frame.level : '');
    const method = frame.method==='tsumo' ? 'ツモ和了' : frame.method==='ron' ? 'ロン和了' : '和了';
    const opponent = frame.discarderId ? `${roster.get(frame.discarderId)!.name}選手から` : '';
    const handText = hand ? `${hand}を` : '';
    let description = `${person.name}選手が${opponent}${roleText}${handText}${method}`;
    if (frame.occurrences && frame.occurrences>1) description+=`（${frame.occurrences}回）`;
    if (yakuText && frame.level && eventLevels[frame.level] && !yaku.includes(frame.level)) description+=`。打点は${frame.level}`;
    const all = frame.amounts.find(a=>a.meaning==='all-payment' && a.evidence.length>0);
    if (all && frame.method==='tsumo' && role==='dealer' && frame.basicGain.value===all.value*3) description+=`。${all.value.toLocaleString('ja-JP')}点オール`;
    if (frame.milestone) description+=`。本人にとって初めての${frame.milestone.hand ?? ''}${frame.milestone.method==='tsumo'?'ツモ':frame.milestone.method==='ron'?'ロン':''}和了`;
    let comeback = false;
    for (const relatedId of frame.relatedEventIds ?? []) {
      const related = byId.get(relatedId);
      if (!related || merged.has(relatedId) || related.time.segment!==frame.time.segment) continue;
      if (related.kind==='reversal' && related.actorId===person.id) {
        const detail = reversalText(related, roster);
        if (!detail) continue;
        description+=`。${detail}`; comeback=true; merged.add(relatedId);
      } else if (related.kind==='bust' && related.actorId===frame.discarderId && roster.has(related.actorId ?? '')) {
        if (related.time.scope==='unspecified') continue;
        const outcome=related.time.scope==='final' ? '飛びとなった' : '途中で箱下になった';
        description+=`。${roster.get(related.actorId!)!.name}選手が${outcome}`;
        merged.add(relatedId);
      }
    }
    const riichi = yaku.includes('ダブルリーチ一発') || (yaku.includes('ダブルリーチ') && yaku.includes('一発')) ? 'double-riichi-ippatsu'
      : yaku.includes('リーチ一発') || (yaku.includes('リーチ') && yaku.includes('一発')) ? 'riichi-ippatsu'
      : yaku.includes('リーチ') && frame.method==='tsumo' ? 'riichi-tsumo' : null;
    const event = (frame.level ? eventLevels[frame.level] : undefined) ?? (frame.method==='tsumo' ? riichi : null) ?? (comeback ? 'comeback' : 'win');
    const exceptional = yaku.some(y=>['嶺上開花','槍槓','海底摸月','海底撈月','河底撈魚','ダブルリーチ一発'].includes(y));
    const editorial = frame.milestone || event==='yakuman' || event==='sanbaiman' ? 'required'
      : !comeback && !exceptional && (event==='mangan' || event==='win' && !yaku.length) ? 'routine' : 'candidate';
    rendered.push({id:frame.id,gameId:game.id,playerId:person.id,name:person.name,event,description,
      points:frame.basicGain.value ?? frame.basicGain.lowerBound ?? 0,
      pointsKnown:frame.basicGain.value!==null,comeback,editorial,milestone:!!frame.milestone});
  }
  return rendered;
}

// Updated 2026-09-14: Outcomes use dedicated resources and do not imply an unreported winning hand.
function reversalText(frame: StructuredHighlight, roster: Map<string,Player>): string | null {
  const person = roster.get(frame.actorId ?? '');
  if (!person || (frame.targetId && (frame.targetId===person.id || !roster.has(frame.targetId)))) return null;
  const opponent = frame.targetId ? `${roster.get(frame.targetId)!.name}選手を上回り、` : '';
  const rank = frame.finalRank===1 ? 'トップ' : frame.finalRank ? `${frame.finalRank}位` : null;
  const outcome = rank ? frame.time.scope==='final' ? `逆転し、${rank}で終了` : `${rank}に浮上` : '順位を逆転した';
  return `${person.name}選手が${opponent}${outcome}`;
}

export function parseHighlights(game: Game, players: Player[]): HighlightEvent[] {
  return presentHighlightAnalysis(analyzeHighlight(game,players),game,players);
}

// Updated 2026-09-14: Legacy callers get one ranked result from the same analyzer, with no permissive fallback.
export function parseHighlight(game: Game, players: Player[]): HighlightEvent | null {
  return rankHighlights(parseHighlights(game,players))[0] ?? null;
}

export function rankHighlights(events: HighlightEvent[], mentions = new Map<string, number>()) {
  return [...events].sort((a,b)=>b.points-a.points || Number(b.comeback)-Number(a.comeback) || (mentions.get(a.playerId)??0)-(mentions.get(b.playerId)??0) || a.gameId.localeCompare(b.gameId) || (a.id??'').localeCompare(b.id??''));
}
