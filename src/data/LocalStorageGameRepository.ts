import { generateSampleGames } from "./sampleGames";
import type { GameRepository } from "./GameRepository";
import type { Game, RuleConfig, Four, GameEntry } from "../domain/types";
import { createResultGame } from "../domain/directResults";
import { calculateGameResults, createGame } from "../domain/scoring";
import { isValidDate } from "../utils/date";

export const STORAGE_KEY = "janroku.games.v1";
interface Store {
  version: 1;
  games: Game[];
}
type StoragePort = Pick<Storage, "getItem" | "setItem">;

// 最終更新: 2026-09-10 — 保存済みデータは型検査し、破損時は上書きせず明示的な復元を待つ。
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
export function validRules(value: unknown): value is RuleConfig {
  if (!object(value)) return false;
  return (
    typeof value.id === "string" &&
    value.playerCount === 4 &&
    [
      value.startingPoints,
      value.returnPoints,
      value.scoreUnit,
      value.resultDivisor,
    ].every((n) => typeof n === "number" && Number.isSafeInteger(n) && n > 0) &&
    Array.isArray(value.uma) &&
    value.uma.length === 4 &&
    value.uma.every(
      (n: unknown) => typeof n === "number" && Number.isFinite(n),
    ) &&
    (value.oka === "winner" || value.oka === "none") &&
    value.tieBreak === "seat-order" &&
    (value.settlementRounding === undefined ||
      value.settlementRounding === "five-down-six-up") &&
    (value.countNegativePoints === undefined ||
      typeof value.countNegativePoints === "boolean") &&
    typeof value.bustIncludesZero === "boolean"
  );
}
export function validGame(value: unknown): value is Game {
  if (
    !object(value) ||
    typeof value.id !== "string" ||
    !value.id ||
    typeof value.date !== "string" ||
    !isValidDate(value.date) ||
    (value.inputMode !== undefined && value.inputMode !== "results") ||
    (value.note !== undefined &&
      (typeof value.note !== "string" || value.note.length > 500)) ||
    (value.format !== undefined &&
      value.format !== "hanchan" &&
      value.format !== "tonpu") ||
    typeof value.createdAt !== "string" ||
    !Number.isFinite(Date.parse(value.createdAt)) ||
    !validRules(value.rules) ||
    !Array.isArray(value.players) ||
    value.players.length !== 4 ||
    typeof value.totalMismatchAccepted !== "boolean" ||
    !object(value.registeredBy) ||
    typeof value.registeredBy.id !== "string" ||
    typeof value.registeredBy.name !== "string" ||
    value.registeredBy.source !== "mock" ||
    (value.updatedAt !== undefined &&
      (typeof value.updatedAt !== "string" ||
        !Number.isFinite(Date.parse(value.updatedAt))))
  )
    return false;
  if (value.inputMode === "results") {
    if (
      !value.players.every(
        (p: unknown) =>
          object(p) &&
          typeof p.playerId === "string" &&
          p.rawScore === null &&
          typeof p.result === "number",
      )
    )
      return false;
    const game = value as unknown as Game;
    try {
      const checked = createResultGame({
        id: game.id,
        date: game.date,
        createdAt: game.createdAt,
        format: game.format,
        entries: game.players,
        acceptMismatch: game.totalMismatchAccepted,
      });
      return (
        checked.totalMismatchAccepted === game.totalMismatchAccepted &&
        checked.players.every(
          (p, i) =>
            p.rank === game.players[i].rank &&
            p.result === game.players[i].result,
        )
      );
    } catch {
      return false;
    }
  }
  const entriesValid = value.players.every(
    (entry: unknown) =>
      object(entry) &&
      typeof entry.playerId === "string" &&
      !!entry.playerId &&
      typeof entry.rawScore === "number" &&
      Number.isSafeInteger(entry.rawScore) &&
      Math.abs(entry.rawScore) <= 10_000_000 &&
      typeof entry.rank === "number" &&
      [1, 2, 3, 4].includes(entry.rank) &&
      typeof entry.result === "number" &&
      Number.isFinite(entry.result),
  );
  if (!entriesValid) return false;
  const game = value as unknown as Game;
  const entries = game.players as Four<GameEntry>;
  try {
    createGame({
      id: game.id,
      date: game.date,
      createdAt: game.createdAt,
      entries,
      config: game.rules,
      acceptMismatch: game.totalMismatchAccepted,
    });
    const calculated = calculateGameResults(entries, game.rules);
    return calculated.every(
      (entry, i) =>
        entry.rank === game.players[i].rank &&
        entry.result === game.players[i].result,
    );
  } catch {
    return false;
  }
}

// 最終更新: 2026-09-10 — 1レコード集合を一括保存。失敗時は成功を通知せず、呼び出し元へ返す。
export class LocalStorageGameRepository implements GameRepository {
  constructor(
    private readonly storage: () => StoragePort = () => window.localStorage,
  ) {}

  private read(): Game[] {
    let raw: string | null;
    try {
      raw = this.storage().getItem(STORAGE_KEY);
    } catch {
      throw new Error(
        "このブラウザーでは保存領域を利用できません。ブラウザーの設定を確認してください。",
      );
    }
    if (raw === null) {
      const games = generateSampleGames();
      this.write(games);
      return games;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error(
        "保存データを読み込めません。元のデータは保持しています。設定からサンプルに戻せます。",
      );
    }
    if (
      !object(parsed) ||
      parsed.version !== 1 ||
      !Array.isArray(parsed.games) ||
      !parsed.games.every(validGame) ||
      new Set(parsed.games.map((game: Game) => game.id)).size !==
        parsed.games.length
    ) {
      throw new Error(
        "保存データの形式が対応外、または破損しています。元のデータは保持しています。",
      );
    }
    return parsed.games;
  }

  private write(games: Game[]): void {
    const store: Store = { version: 1, games };
    try {
      this.storage().setItem(STORAGE_KEY, JSON.stringify(store));
    } catch {
      throw new Error(
        "保存できませんでした。保存容量やブラウザーの設定を確認してください。入力内容は保持しています。",
      );
    }
  }

  async getGames(): Promise<Game[]> {
    return this.read();
  }
  async addGame(game: Game): Promise<void> {
    if (!validGame(game)) throw new Error("対局データが不正です。");
    const games = this.read();
    if (games.some((entry) => entry.id === game.id))
      throw new Error("この対局はすでに登録されています。");
    this.write([...games, game]);
  }
  async updateGame(game: Game): Promise<void> {
    if (!validGame(game)) throw new Error("対局データが不正です。");
    const games = this.read();
    if (!games.some((entry) => entry.id === game.id))
      throw new Error("編集対象の対局が見つかりません。");
    this.write(games.map((entry) => (entry.id === game.id ? game : entry)));
  }
  async deleteGame(id: string): Promise<void> {
    this.write(this.read().filter((game) => game.id !== id));
  }
  async resetToSample(): Promise<void> {
    this.write(generateSampleGames());
  }

  subscribe(onChange: () => void): () => void {
    const listener = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY || event.key === null) onChange();
    };
    window.addEventListener("storage", listener);
    return () => window.removeEventListener("storage", listener);
  }
}
