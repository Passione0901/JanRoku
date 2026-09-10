import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Player } from "../domain/types";
import type { PlayerRepository } from "../data/PlayerRepository";
interface Roster {
  players: Player[];
  findPlayer: (id: string) => Player;
  addPlayer: (name: string) => Promise<void>;
  canDelete: boolean;
  deletePlayer: (id: string) => Promise<void>;
}
const Context = createContext<Roster | null>(null);
// 最終更新: 2026-09-10 — 名前解決とメンバー一覧を全画面で共有する。
export function PlayersProvider({
  repository,
  children,
}: {
  repository: PlayerRepository;
  children: ReactNode;
}) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const reload = useCallback(async () => {
    try {
      setPlayers(await repository.getPlayers());
      setLoaded(true);
      setError("");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "メンバーを読み込めませんでした。",
      );
    }
  }, [repository]);
  useEffect(() => {
    void reload();
    return repository.subscribe?.(() => {
      void reload();
    });
  }, [repository, reload]);
  const findPlayer = useCallback(
    (id: string) =>
      players.find((p) => p.id === id) ?? { id, name: id, color: "#b7bdca" },
    [players],
  );
  if (error && !loaded)
    return (
      <div className="error-panel" role="alert">
        <p>{error}</p>
        <a className="button subtle" href="#/sync">
          同期設定を開く
        </a>
        <button className="button" onClick={() => void reload()}>
          もう一度読み込む
        </button>
      </div>
    );
  if (!loaded) return <div className="empty-state">メンバーを読み込み中…</div>;
  return (
    <Context.Provider
      value={{
        players,
        findPlayer,
        canDelete: !!repository.deletePlayer,
        deletePlayer: async (id) => {
          if (!repository.deletePlayer)
            throw new Error("削除はGitHub共有モードで利用できます。");
          await repository.deletePlayer(id);
          setPlayers((current) => current.filter((p) => p.id !== id));
        },
        addPlayer: async (name) => {
          const player = await repository.addPlayer(name);
          setPlayers((current) => [
            ...current.filter((p) => p.id !== player.id),
            player,
          ]);
        },
      }}
    >
      {error && (
        <div className="error-panel" role="alert">
          同期できませんでした：{error}{" "}
          <button className="button subtle" onClick={() => void reload()}>
            再読み込み
          </button>
        </div>
      )}
      {children}
    </Context.Provider>
  );
}
// 最終更新: 2026-09-10 — Provider外の利用を早期に検出する。
export function usePlayers() {
  const value = useContext(Context);
  if (!value) throw new Error("PlayersProvider is required");
  return value;
}
