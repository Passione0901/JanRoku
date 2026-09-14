// Updated 2026-09-14: UTF-16 evidence offsets always index the unchanged source string.
import type { Game, Rank } from '../types';
// Updated 2026-09-15: A draft may have known participants but no validated final scores yet.
export type HighlightGame = Pick<Game, 'id'|'highlight'|'rules'|'inputMode'> & {
  players: {playerId:string;rawScore:number|null;rank:Rank|null}[];
};
export interface SourceSpan { start: number; end: number; text: string }
export type LexemeKind = 'person'|'honorific'|'term'|'action'|'particle'|'role'|'number'|'unit'|'modality'|'time'|'connector'|'rank'|'context'|'unknown';
export interface HighlightToken extends SourceSpan { kind: LexemeKind; value: string; normalizedStart:number; normalizedEnd:number }
export interface HighlightLexing { source:string; normalized:string; offsets: {start:number;end:number}[]; tokens:HighlightToken[]; paths:HighlightToken[][]; truncated:boolean }
export type EventState = 'asserted'|'negated'|'speculative'|'hypothetical'|'attempted'|'incomplete';
export type EventDecision = 'accepted'|'rejected'|'ambiguous'|'unsupported';
export interface HighlightAmount { value:number; meaning:'basic-gain'|'all-payment'|'individual-payment'|'balance'|'gap'|'aggregate'|'bonus-inclusive'|'unclassified'; evidence:SourceSpan[] }
export interface StructuredHighlight {
  id:string; gameId:string; kind:'win'|'reversal'|'bust';
  actorId:string|null; winnerId:string|null; discarderId:string|null; targetId:string|null;
  method:'tsumo'|'ron'|'unspecified'|null;
  yaku:string[]; level:string|null; roles:Record<string,'dealer'|'nondealer'>;
  amounts:HighlightAmount[];
  basicGain:{value:number|null;lowerBound:number|null};
  time:{segment:number;scope:'during'|'final'|'unspecified'};
  finalRank:1|2|3|4|null; state:EventState; decision:EventDecision; reasons:string[];
  evidence:Record<string,SourceSpan[]>;
  relatedEventIds?:string[];
  milestone?: {kind:'first-win';hand:string|null;method:'tsumo'|'ron'|'unspecified'};
  occurrences?: number;
}
export interface HighlightAnalysis {
  version:string; source:string; lexing:HighlightLexing|null; events:StructuredHighlight[];
  diagnostics:string[];
}
