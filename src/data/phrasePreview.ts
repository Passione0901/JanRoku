import type { GameRepository } from "./GameRepository";
import type { PlayerRepository } from "./PlayerRepository";
import { generateSampleGames } from "./sampleGames";
export const PREVIEW_STORAGE_KEY = "janroku.JanRoku.preview.v1";
// 最終更新: 2026-09-10 — 実データを参照せず、入力に応じた閲覧専用データを生成する。
export async function phraseSeed(
  first: string,
  second: string,
): Promise<string> {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(
      JSON.stringify([first.normalize("NFC"), second.normalize("NFC")]),
    ),
  );
  return Array.from(new Uint8Array(bytes), (x) =>
    x.toString(16).padStart(2, "0"),
  ).join("");
}
export function phrasePreview(seed: string): {
  gameRepository: GameRepository;
  playerRepository: PlayerRepository;
} {
  if (!/^[a-f0-9]{64}$/.test(seed))
    throw new Error("保存した表示を読み込めません。");
  let state = parseInt(seed.slice(0, 8), 16);
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state;
  };
  const chars = "アイウエオカキクケコサシスセソタチツテトナニヌネノ";
  const players = Array.from({ length: 12 }, (_, i) => ({
    id: `preview-${i}`,
    name:
      Array.from({ length: 4 }, () => chars[random() % chars.length]).join("") +
      `・${i + 1}`,
    color: `#${(random() & 0xffffff).toString(16).padStart(6, "0")}`,
  }));
  const games = generateSampleGames(players, parseInt(seed.slice(8, 16), 16));
  const reject = async (): Promise<never> => {
    throw new Error("表示プレビューでは記録を変更できません。");
  };
  return {
    gameRepository: {
      getGames: async () => structuredClone(games),
      addGame: reject,
      updateGame: reject,
      deleteGame: reject,
      resetToSample: reject,
    },
    playerRepository: {
      getPlayers: async () => structuredClone(players),
      addPlayer: reject,
      deletePlayer: reject,
    },
  };
}
