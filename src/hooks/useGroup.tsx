import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { entryRules } from "../config/rules";
import type { RuleConfig } from "../domain/types";
import type { GitHubStore } from "../data/GitHubStore";
import { groupInfo, type GroupId } from "../data/groups";

const GroupContext = createContext<{
  id: GroupId;
  label: string;
  rules: RuleConfig;
  saveRules?: (rules: RuleConfig, expected?: RuleConfig) => Promise<void>;
}>({ id: "main", label: "麻雀会1", rules: entryRules });
export const useGroup = () => useContext(GroupContext);

// 最終更新: 2026-09-11 — 共有ルールの読み込み前に入力欄を開かず、切替時は全状態を破棄する。
export function GroupProvider({
  store,
  children,
  onSwitch,
}: {
  store: GitHubStore;
  children: ReactNode;
  onSwitch: () => void;
}) {
  const [rules, setRules] = useState<RuleConfig>();
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    const load = () =>
      void store
        .read()
        .then(({ data }) => {
          if (active) {
            setRules(data.rules ?? entryRules);
            setError("");
          }
        })
        .catch((e) => {
          if (active)
            setError(
              e instanceof Error ? e.message : "ルールを読み込めませんでした。",
            );
        });
    load();
    const unsubscribe = store.subscribe(load);
    return () => {
      active = false;
      unsubscribe();
    };
  }, [store, retry]);
  if (!rules)
    return (
      <main className="main-content">
        <p role={error ? "alert" : "status"}>{error || "記録を読み込み中…"}</p>
        {error && (
          <>
            <button
              className="button subtle"
              onClick={() => setRetry((x) => x + 1)}
            >
              再読み込み
            </button>
            <button className="button subtle" onClick={onSwitch}>
              麻雀会を切り替え
            </button>
          </>
        )}
      </main>
    );
  return (
    <GroupContext.Provider
      value={{
        id: store.groupId,
        label: groupInfo(store.groupId).label,
        rules,
        saveRules: async (next, expected = rules) => {
          await store.mutate((data) => {
            if (
              JSON.stringify(data.rules ?? entryRules) !==
              JSON.stringify(expected)
            )
              throw new Error(
                "別の端末でルールが変更されました。設定画面を開き直してください。",
              );
            return { ...data, rules: next };
          });
          setRules(next);
        },
      }}
    >
      {children}
    </GroupContext.Provider>
  );
}
