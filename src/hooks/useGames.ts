import { strengthPopulation } from "../domain/strength";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { Game, Player } from "../domain/types";
import type { GameRepository } from "../data/GameRepository";
import { calculateDailySummaries, calculatePlayerStats } from "../domain/stats";

// 最終更新: 2026-09-10 — 変更成功後だけデータを再取得し、全画面が同じ集計スナップショットを使う。
export function useGames(repository: GameRepository, players: Player[]) {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const reload = useCallback(async () => {
    try {
      setGames(await repository.getGames());
      setError("");
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "データを取得できませんでした。",
      );
    } finally {
      setLoading(false);
    }
  }, [repository]);
  useEffect(() => {
    void reload();
    return repository.subscribe?.(() => {
      void reload();
    });
  }, [repository, reload]);

  const mutate = useCallback(
    async (action: () => Promise<void>) => {
      if (saving.current) throw new Error("保存中です。少しお待ちください。");
      saving.current = true;
      setBusy(true);
      try {
        await action();
        await reload();
      } finally {
        saving.current = false;
        setBusy(false);
      }
    },
    [reload],
  );
  const stats = useMemo(() => {
    const population = strengthPopulation(games);
    return players.map((player) =>
      calculatePlayerStats(player.id, games, population),
    );
  }, [games, players]);
  const days = useMemo(() => calculateDailySummaries(games), [games]);
  return {
    games,
    stats,
    days,
    loading,
    busy,
    error,
    reload,
    saveGame: (game: Game, editing: boolean) =>
      mutate(() =>
        editing ? repository.updateGame(game) : repository.addGame(game),
      ),
    deleteGame: (id: string, expectedRevision?: string) =>
      mutate(() => repository.deleteGame(id, expectedRevision)),
    reset: () => mutate(() => repository.resetToSample()),
  };
}
