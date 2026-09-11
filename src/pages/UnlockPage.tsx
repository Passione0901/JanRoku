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
  envelope,
} from "../data/EncryptedVault";
import { GitHubStore } from "../data/GitHubStore";
import {
  groups,
  groupFileUrl,
  groupStorageKey,
  ACTIVE_GROUP_KEY,
  type GroupId,
} from "../data/groups";
import { unlockGroups, type GroupPayloads } from "../data/unlockGroups";
import { GroupProvider } from "../hooks/useGroup";

function lastGroup(): GroupId {
  try {
    return localStorage.getItem(ACTIVE_GROUP_KEY) === "second"
      ? "second"
      : "main";
  } catch {
    return "main";
  }
}
// 最終更新: 2026-09-11 — 合言葉が復号できた記録を開き、その保存先へだけ読み書きする。
export function UnlockPage() {
  const [groupId, setGroupId] = useState<GroupId>(lastGroup);
  const vaultKey = groupStorageKey(VAULT_STORAGE_KEY, groupId);
  const previewKey = groupStorageKey(PREVIEW_STORAGE_KEY, groupId);
  const [payloads, setPayloads] = useState<GroupPayloads>();
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
    let active = true;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setPayloads(undefined);
    void (async () => {
      try {
        // 全保存先を確認する前に、不一致をプレビューと決めつけない。
        const entries = await Promise.all(
          groups.map(async ({ id }) => {
            const r = await fetch(groupFileUrl(id), {
              cache: "no-store",
              signal: controller.signal,
            });
            if (!r.ok)
              throw new Error(
                "記録を読み込めませんでした。時間をおいて再試行してください。",
              );
            return [id, envelope(await r.json())] as const;
          }),
        );
        const values = Object.fromEntries(entries) as GroupPayloads;
        const savedId = lastGroup();
        let vault: EncryptedVault | null = null;
        try {
          vault = await EncryptedVault.restore(
            values[savedId],
            localStorage,
            groupStorageKey(VAULT_STORAGE_KEY, savedId),
          );
        } catch {
          /* 手入力で開ける。 */
        }
        if (active) {
          setPayloads(values);
          setGroupId(savedId);
          if (vault)
            setStore(new GitHubStore(undefined, undefined, vault, savedId));
          else {
            try {
              const seed = localStorage.getItem(
                groupStorageKey(PREVIEW_STORAGE_KEY, savedId),
              );
              if (seed) setPreview(phrasePreview(seed));
            } catch {
              /* 保存内容を使わず再入力する。 */
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
  }, [retry]);
  useEffect(() => {
    const changed = (e: StorageEvent) => {
      // 別タブで鍵を削除した場合は閉じる。別の組への自動切替はしない。
      if (e.key === vaultKey || e.key === previewKey || e.key === null) {
        setStore(null);
        setPreview(null);
        setFirst("");
        setSecond("");
        setError("");
      }
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
    if (busy || loading || !payloads) return;
    setBusy(true);
    setError("");
    try {
      const match = await unlockGroups(payloads, first, second);
      if (!match) {
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
        setPreview(phrasePreview(seed));
        window.location.hash = "/";
      } else {
        const key = groupStorageKey(VAULT_STORAGE_KEY, match.id);
        try {
          localStorage.removeItem(
            groupStorageKey(PREVIEW_STORAGE_KEY, match.id),
          );
          if (remember) await match.vault.remember(localStorage, key);
          else localStorage.removeItem(key);
          localStorage.setItem(ACTIVE_GROUP_KEY, match.id);
        } catch {
          if (remember)
            throw new Error(
              "ブラウザーに保存できません。保存のチェックを外して開いてください。",
            );
        }
        setGroupId(match.id);
        setStore(new GitHubStore(undefined, undefined, match.vault, match.id));
      }
      setFirst("");
      setSecond("");
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
      setError("");
    } catch {
      setError(
        "保存情報を削除できません。ブラウザーのサイトデータを削除してください。",
      );
    }
    setStore(null);
    setPreview(null);
    setFirst("");
    setSecond("");
    window.location.hash = "/";
  }
  if (preview) return <App {...preview} preview onLock={lock} />;
  if (store)
    return (
      <GroupProvider key={store.groupId} store={store} onSwitch={lock}>
        <App
          gameRepository={store.gameRepository}
          playerRepository={store.playerRepository}
          syncStore={store}
          onLock={lock}
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
        <p className="muted">麻雀会の2つの合言葉を入力してください。</p>
        {loading ? (
          <p role="status">記録を読み込み中…</p>
        ) : payloads ? (
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
