import {
  phraseSeed,
  phrasePreview,
  PREVIEW_STORAGE_KEY,
} from "../data/phrasePreview";
import { useEffect, useState, type FormEvent } from "react";
import App from "../App";
import { ThemeToggle } from "../components/ThemeToggle";
import {
  EncryptedVault,
  VAULT_STORAGE_KEY,
  UnlockMismatchError,
} from "../data/EncryptedVault";
import { GitHubStore } from "../data/GitHubStore";
import {
  groups,
  groupFileUrl,
  groupStorageKey,
  ACTIVE_GROUP_KEY,
  type GroupId,
} from "../data/groups";
import { GroupProvider } from "../hooks/useGroup";

// 最終更新: 2026-09-10 — 実際の戦績と入力由来のプレビューを別のリポジトリで扱う。
export function UnlockPage() {
  const [groupId, setGroupId] = useState<GroupId>(() => {
    try {
      return localStorage.getItem(ACTIVE_GROUP_KEY) === "second"
        ? "second"
        : "main";
    } catch {
      return "main";
    }
  });
  return (
    <GroupUnlock
      key={groupId}
      groupId={groupId}
      selectGroup={(id) => {
        setGroupId(id);
        try {
          localStorage.setItem(ACTIVE_GROUP_KEY, id);
        } catch {
          /* 今回だけの選択。 */
        }
        window.location.hash = "/";
      }}
    />
  );
}
// 最終更新: 2026-09-11 — 切替で画面を再生成し、鍵と保存済み入力を麻雀会ごとに管理する。
function GroupUnlock({
  groupId,
  selectGroup,
}: {
  groupId: GroupId;
  selectGroup: (id: GroupId) => void;
}) {
  const vaultKey = groupStorageKey(VAULT_STORAGE_KEY, groupId);
  const previewKey = groupStorageKey(PREVIEW_STORAGE_KEY, groupId);
  const [savedVault, setSavedVault] = useState<EncryptedVault | null>(null);
  const [payload, setPayload] = useState<unknown>();
  const [store, setStore] = useState<GitHubStore | null>(null);
  const [preview, setPreview] = useState<ReturnType<
    typeof phrasePreview
  > | null>(null);
  const [first, setFirst] = useState("");
  const [second, setSecond] = useState("");
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setError("");
    void (async () => {
      try {
        const r = await fetch(groupFileUrl(groupId), {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!r.ok)
          throw new Error(
            "記録を読み込めませんでした。時間をおいて再試行してください。",
          );
        const value: unknown = await r.json();
        let vault: EncryptedVault | null = null;
        try {
          vault = await EncryptedVault.restore(value, localStorage, vaultKey);
        } catch {
          /* 保存領域が使えなくても合言葉で開ける。 */
        }
        if (active) {
          setPayload(value);
          setSavedVault(vault);
          if (vault)
            setStore(new GitHubStore(undefined, undefined, vault, groupId));
          else {
            try {
              const seed = localStorage.getItem(previewKey);
              if (seed) setPreview(phrasePreview(seed));
            } catch {
              /* 壊れた保存内容は使わず再入力する。 */
            }
          }
        }
      } catch (e) {
        if (active)
          setError(
            e instanceof Error ? e.message : "記録を読み込めませんでした。",
          );
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
      controller.abort();
    };
  }, [retry, groupId, vaultKey, previewKey]);
  useEffect(() => {
    const changed = (e: StorageEvent) => {
      if (e.key === vaultKey || e.key === previewKey || e.key === null)
        window.location.reload();
    };
    const restored = (e: PageTransitionEvent) => {
      if (e.persisted) window.location.reload();
    };
    window.addEventListener("storage", changed);
    window.addEventListener("pageshow", restored);
    return () => {
      window.removeEventListener("storage", changed);
      window.removeEventListener("pageshow", restored);
    };
  }, [vaultKey, previewKey]);
  async function unlock(e: FormEvent) {
    e.preventDefault();
    if (busy || loading || !payload) return;
    setBusy(true);
    setError("");
    try {
      let vault: EncryptedVault;
      try {
        vault = await EncryptedVault.unlock(payload, first, second);
      } catch (failure) {
        if (!(failure instanceof UnlockMismatchError)) throw failure;
        const seed = await phraseSeed(first, second);
        try {
          localStorage.removeItem(vaultKey);
          if (remember) localStorage.setItem(previewKey, seed);
          else localStorage.removeItem(previewKey);
        } catch {
          if (remember)
            throw new Error(
              "ブラウザーに保存できません。保存のチェックを外して開いてください。",
            );
        }
        setSavedVault(null);
        setPreview(phrasePreview(seed));
        setFirst("");
        setSecond("");
        window.location.hash = "/";
        return;
      }
      try {
        localStorage.removeItem(previewKey);
      } catch {
        /* 保存領域を使わず開くこともできる。 */
      }
      if (remember) {
        try {
          await vault.remember(localStorage, vaultKey);
        } catch {
          throw new Error(
            "ブラウザーに保存できません。保存のチェックを外して開いてください。",
          );
        }
      } else {
        try {
          localStorage.removeItem(vaultKey);
        } catch {
          /* 今回のセッションだけで開く。 */
        }
      }
      setFirst("");
      setSecond("");
      setSavedVault(remember ? vault : null);
      setStore(new GitHubStore(undefined, undefined, vault, groupId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "合言葉を確認してください。");
    } finally {
      setBusy(false);
    }
  }
  function lock() {
    try {
      localStorage.removeItem(vaultKey);
      localStorage.removeItem(previewKey);
      setSavedVault(null);
      switchGroup();
    } catch {
      setError(
        "保存情報を削除できません。ブラウザーのサイトデータを削除してください。",
      );
      setStore(null);
    }
  }
  function switchGroup() {
    setStore(null);
    setPreview(null);
    setError("");
    setFirst("");
    setSecond("");
    window.location.hash = "/";
  }
  if (preview)
    return (
      <App {...preview} preview onLock={lock} onSwitchGroup={switchGroup} />
    );
  if (store)
    return (
      <GroupProvider store={store} onSwitch={switchGroup}>
        <App
          gameRepository={store.gameRepository}
          playerRepository={store.playerRepository}
          syncStore={store}
          onLock={lock}
          onSwitchGroup={switchGroup}
        />
      </GroupProvider>
    );
  return (
    <main className="unlock-page">
      <div className="unlock-heading">
        <span className="brand">
          雀録 <small>Jang-roku</small>
        </span>
        <ThemeToggle />
      </div>
      <section className="panel settings-card">
        <h1>合言葉で開く</h1>
        <div className="unlock-form">
          <label>
            麻雀会
            <select
              value={groupId}
              disabled={busy}
              onChange={(e) => selectGroup(e.target.value as GroupId)}
            >
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="muted">麻雀会の2つの合言葉を入力してください。</p>
        {loading ? (
          <p role="status">記録を読み込み中…</p>
        ) : payload ? (
          <>
            {savedVault && (
              <button
                className="button subtle"
                onClick={() =>
                  setStore(
                    new GitHubStore(undefined, undefined, savedVault, groupId),
                  )
                }
              >
                保存した情報で開く
              </button>
            )}
            <form className="unlock-form" onSubmit={unlock}>
              <label>
                合言葉1
                <input
                  type="text"
                  spellCheck={false}
                  autoCapitalize="off"
                  onKeyDown={(e) => {
                    if (
                      e.key === "Enter" &&
                      (e.nativeEvent.isComposing || e.keyCode === 229)
                    )
                      e.preventDefault();
                  }}
                  autoComplete="off"
                  required
                  value={first}
                  onChange={(e) => setFirst(e.target.value)}
                  disabled={busy}
                />
              </label>
              <label>
                合言葉2
                <input
                  type="text"
                  spellCheck={false}
                  autoCapitalize="off"
                  onKeyDown={(e) => {
                    if (
                      e.key === "Enter" &&
                      (e.nativeEvent.isComposing || e.keyCode === 229)
                    )
                      e.preventDefault();
                  }}
                  autoComplete="off"
                  required
                  value={second}
                  onChange={(e) => setSecond(e.target.value)}
                  disabled={busy}
                />
              </label>
              <label className="unlock-remember">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  disabled={busy}
                />
                このブラウザーに保存する
              </label>
              <p className="muted">
                保存すると次回から入力を省略できます。共用端末では保存しないでください。
              </p>
              <button className="button primary" disabled={busy}>
                {busy ? "確認中…" : "戦績を開く"}
              </button>
            </form>
          </>
        ) : (
          <button
            className="button subtle"
            onClick={() => setRetry((x) => x + 1)}
          >
            もう一度読み込む
          </button>
        )}
        {error && (
          <p role="alert" className="negative">
            {error}
          </p>
        )}
      </section>
    </main>
  );
}
