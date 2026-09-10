import { useEffect } from "react";
import type { PlayerStats } from "../domain/types";
import { sortOptions, sortPlayerStats, type SortKey } from "../domain/stats";
import { usePlayers } from "../hooks/usePlayers";

interface StatsTool {
  name: string;
  title: string;
  description: string;
  inputSchema: object;
  annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
  execute: (input: unknown) => unknown;
}
interface ModelContext {
  registerTool: (
    tool: StatsTool,
    options: { signal: AbortSignal },
  ) => void | Promise<void>;
}

// 最終更新: 2026-09-10 — 対応ブラウザーだけに、表示と同じ集計を返す読み取り専用ツールを公開。
export function useStatsTools(stats: PlayerStats[]) {
  const { findPlayer } = usePlayers();
  useEffect(() => {
    const context = (document as Document & { modelContext?: ModelContext })
      .modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const tool: StatsTool = {
      name: "read_mahjong_rankings",
      title: "麻雀の戦績を読む",
      description:
        "現在アプリで読み込んだ戦績ランキングを、画面と同じ集計・並び替えで返します。データは変更しません。",
      inputSchema: {
        type: "object",
        properties: {
          sort: { type: "string", enum: sortOptions.map(([key]) => key) },
          direction: { type: "string", enum: ["asc", "desc"] },
        },
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute(input: unknown) {
        if (!input || typeof input !== "object" || Array.isArray(input))
          throw new Error("入力はオブジェクトにしてください。");
        const options = input as Record<string, unknown>;
        const sort = options.sort ?? "totalResult";
        const direction = options.direction ?? "desc";
        if (
          Object.keys(options).some(
            (key) => !["sort", "direction"].includes(key),
          ) ||
          !sortOptions.some(([key]) => key === sort) ||
          (direction !== "asc" && direction !== "desc")
        )
          throw new Error("並び替え条件が不正です。");
        return sortPlayerStats(stats, sort as SortKey, direction).map(
          (entry) => ({ name: findPlayer(entry.playerId).name, ...entry }),
        );
      },
    };
    try {
      void Promise.resolve(
        context.registerTool(tool, { signal: lifecycle.signal }),
      ).catch(() => {
        /* 未対応時も通常の画面操作を維持。 */
      });
    } catch {
      /* 登録に失敗しても保存・閲覧に影響させない。 */
    }
    return () => lifecycle.abort();
  }, [stats, findPlayer]);
}
