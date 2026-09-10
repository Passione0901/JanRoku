import { players as defaults } from "../config/players";
import type { Player } from "../domain/types";
export const PLAYER_STORAGE_KEY = "janroku.players.v1";
export interface PlayerRepository {
  getPlayers(): Promise<Player[]>;
  addPlayer(name: string): Promise<Player>;
  deletePlayer?(id: string): Promise<void>;
  subscribe?(listener: () => void): () => void;
}
// 最終更新: 2026-09-10 — 表記ゆれによる重複を防ぎ、表示名を短く保つ。
export function normalize(name: string): string {
  if (/[\u0000-\u001f\u007f]/.test(name))
    throw new Error("名前に制御文字は使えません。");
  const value = name.normalize("NFKC").trim().replace(/\s+/g, " ");
  if (!value || [...value].length > 30)
    throw new Error("名前は1〜30文字で入力してください。");
  return value;
}
// 最終更新: 2026-09-10 — 追加メンバーだけを保存し、既存の対局や初期メンバーを保持する。
export class LocalStoragePlayerRepository implements PlayerRepository {
  constructor(
    private readonly storage: () => Pick<Storage, "getItem" | "setItem"> = () =>
      window.localStorage,
  ) {}
  private read(): Player[] {
    const raw = this.storage().getItem(PLAYER_STORAGE_KEY);
    if (raw === null) return [];
    try {
      const data: unknown = JSON.parse(raw);
      if (
        !data ||
        typeof data !== "object" ||
        !("version" in data) ||
        data.version !== 1 ||
        !("players" in data) ||
        !Array.isArray(data.players)
      )
        throw new Error();
      const ids = new Set(defaults.map((p) => p.id));
      const names = new Set(
        defaults.map((p) => normalize(p.name).toLowerCase()),
      );
      return data.players.map((p: unknown) => {
        if (
          !p ||
          typeof p !== "object" ||
          !("id" in p) ||
          typeof p.id !== "string" ||
          !/^member-[a-z0-9-]+$/.test(p.id) ||
          !("name" in p) ||
          typeof p.name !== "string" ||
          !("color" in p) ||
          typeof p.color !== "string" ||
          !/^#[0-9a-f]{6}$/i.test(p.color)
        )
          throw new Error();
        const name = normalize(p.name);
        if (ids.has(p.id) || names.has(name.toLowerCase())) throw new Error();
        ids.add(p.id);
        names.add(name.toLowerCase());
        return { id: p.id, name, color: p.color };
      });
    } catch {
      throw new Error(
        "メンバーデータを読み込めませんでした。保存内容は変更していません。",
      );
    }
  }
  async getPlayers() {
    return [...defaults, ...this.read()];
  }
  async addPlayer(input: string) {
    const name = normalize(input);
    const additions = this.read();
    if (
      [...defaults, ...additions].some(
        (p) => normalize(p.name).toLowerCase() === name.toLowerCase(),
      )
    )
      throw new Error(
        "同じ名前のメンバーがいます。別の名前を入力してください。",
      );
    const player = {
      id: `member-${crypto.randomUUID()}`,
      name,
      color: defaults[additions.length % defaults.length].color,
    };
    try {
      this.storage().setItem(
        PLAYER_STORAGE_KEY,
        JSON.stringify({ version: 1, players: [...additions, player] }),
      );
    } catch {
      throw new Error(
        "保存できませんでした。ブラウザーの保存容量・設定を確認してください。",
      );
    }
    return player;
  }
  subscribe(listener: () => void) {
    const changed = (event: StorageEvent) => {
      if (event.key === PLAYER_STORAGE_KEY || event.key === null) listener();
    };
    window.addEventListener("storage", changed);
    return () => window.removeEventListener("storage", changed);
  }
}
