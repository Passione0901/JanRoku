export type Rank = 1 | 2 | 3 | 4;
export type Four<T> = [T, T, T, T];
export interface Player {
  id: string;
  name: string;
  color: string;
}
export interface RuleConfig {
  id: string;
  playerCount: 4;
  startingPoints: number;
  returnPoints: number;
  scoreUnit: number;
  resultDivisor: number;
  uma: Four<number>;
  oka: "winner" | "none";
  tieBreak: "seat-order";
  bustIncludesZero: boolean;
  /** 最終更新: 2026-09-10 — 未指定の旧記録は箱下計算あり。 */
  countNegativePoints?: boolean;
  settlementRounding?: "five-down-six-up";
}
export interface GameEntry {
  playerId: string;
  rawScore: number;
}
export interface ScoredGameResult extends GameEntry {
  rank: Rank;
  result: number;
}
export interface GameResult {
  playerId: string;
  rawScore: number | null;
  rank: Rank;
  result: number;
}
export type GameFormat = "hanchan" | "tonpu";
export interface Game {
  /** 最終更新: 2026-09-10 — 直接入力した精算済み収支は再計算しない。 */
  inputMode?: "results";
  /** 最終更新: 2026-09-10 — 推定・調整した記録の根拠を履歴に残す。 */
  note?: string;
  /** 最終更新: 2026-09-10 — 編集開始時の共有版。GitHubへは保存しない。 */
  syncRevision?: string;
  format?: GameFormat;
  id: string;
  date: string;
  createdAt: string;
  updatedAt?: string;
  registeredBy: { id: string; name: string; source: "mock" };
  players: Four<GameResult>;
  rules: RuleConfig;
  totalMismatchAccepted: boolean;
}
export interface PlayerGame extends GameResult {
  format?: GameFormat;
  gameId: string;
  date: string;
  createdAt: string;
  cumulativeResult: number;
  busted: boolean | null;
}
export interface BasePlayerStats {
  playerId: string;
  gamesPlayed: number;
  recentGames: PlayerGame[];
  history: PlayerGame[];
  highestRawScore: number | null;
  lowestRawScore: number | null;
  bestDay: string | null;
  bestDailyResult: number | null;
  worstDay: string | null;
  worstDailyResult: number | null;
  totalResult: number;
  averageRank: number | null;
  rankCounts: Four<number>;
  topTwoRate: number;
  rankRates: Four<number>;
  bustRate: number | null;
}
export interface PlayerStats extends BasePlayerStats {
  strengthPoint: number;
  title: string;
}
export interface DailySummary {
  date: string;
  games: Game[];
  results: { playerId: string; totalResult: number; gamesPlayed: number }[];
}
