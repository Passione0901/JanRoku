import type { Game } from "../domain/types";

// 保存先の差し替え点。Reactはブラウザー保存APIを直接参照しない。
export interface GameRepository {
  getGames(): Promise<Game[]>;
  addGame(game: Game): Promise<void>;
  updateGame(game: Game): Promise<void>;
  deleteGame(id: string, expectedRevision?: string): Promise<void>;
  resetToSample(): Promise<void>;
  subscribe?(onChange: () => void): () => void;
}
