import type { Game } from './types';

// Updated 2026-09-15: Legacy cloud inserts assigned the same timestamp to creation and editing.
export function isGameEdited(game: Pick<Game,'createdAt'|'updatedAt'>): boolean {
  return !!game.updatedAt && Date.parse(game.updatedAt)>Date.parse(game.createdAt);
}

function stable(value:unknown):string {
  if(Array.isArray(value))return '['+value.map(stable).join(',')+']';
  if(value&&typeof value==='object')return '{'+Object.entries(value).filter(([,v])=>v!==undefined)
    .sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>JSON.stringify(k)+':'+stable(v)).join(',')+'}';
  return JSON.stringify(value);
}

// Updated 2026-09-15: Transport metadata and omitted legacy defaults are not edits to a game.
export function sameGameContent(a:Game,b:Game):boolean {
  const content=(game:Game)=>({date:game.date,format:game.format??'hanchan',inputMode:game.inputMode??'points',
    highlight:game.highlight??'',note:game.note??'',players:game.players,
    rules:{...game.rules,countNegativePoints:game.rules.countNegativePoints??true},
    totalMismatchAccepted:game.totalMismatchAccepted});
  return stable(content(a))===stable(content(b));
}
