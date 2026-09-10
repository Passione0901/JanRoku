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

const fileUrl =
  "https://raw.githubusercontent.com/Passione0901/JanRoku/main/data/encrypted.json";
// 最終更新: 2026-09-10 — 実際の戦績と入力由来のプレビューを別のリポジトリで扱う。
export function UnlockPage() {
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
        const r = await fetch(fileUrl, {
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
          vault = await EncryptedVault.restore(value, localStorage);
        } catch {
          /* 保存領域が使えなくても合言葉で開ける。 */
        }
        if (active) {
          setPayload(value);
          if (vault) setStore(new GitHubStore(undefined, undefined, vault));
          else {
            try {
              const seed = localStorage.getItem(PREVIEW_STORAGE_KEY);
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
  }, [retry]);
  useEffect(() => {
    const changed = (e: StorageEvent) => {
      if (
        e.key === VAULT_STORAGE_KEY ||
        e.key === PREVIEW_STORAGE_KEY ||
        e.key === null
      )
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
  }, []);
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
          localStorage.removeItem(VAULT_STORAGE_KEY);
          if (remember) localStorage.setItem(PREVIEW_STORAGE_KEY, seed);
          else localStorage.removeItem(PREVIEW_STORAGE_KEY);
        } catch {
          if (remember)
            throw new Error(
              "ブラウザーに保存できません。保存のチェックを外して開いてください。",
            );
        }
        setPreview(phrasePreview(seed));
        setFirst("");
        setSecond("");
        window.location.hash = "/";
        return;
      }
      try {
        localStorage.removeItem(PREVIEW_STORAGE_KEY);
      } catch {
        /* 保存領域を使わず開くこともできる。 */
      }
      if (remember) {
        try {
          await vault.remember(localStorage);
        } catch {
          throw new Error(
            "ブラウザーに保存できません。保存のチェックを外して開いてください。",
          );
        }
      } else {
        try {
          localStorage.removeItem(VAULT_STORAGE_KEY);
        } catch {
          /* 今回のセッションだけで開く。 */
        }
      }
      setFirst("");
      setSecond("");
      setStore(new GitHubStore(undefined, undefined, vault));
    } catch (e) {
      setError(e instanceof Error ? e.message : "合言葉を確認してください。");
    } finally {
      setBusy(false);
    }
  }
  function lock() {
    try {
      localStorage.removeItem(VAULT_STORAGE_KEY);
      localStorage.removeItem(PREVIEW_STORAGE_KEY);
      if (preview) {
        setPreview(null);
        setError("");
      } else window.location.reload();
    } catch {
      setError(
        "保存情報を削除できません。ブラウザーのサイトデータを削除してください。",
      );
      setStore(null);
    }
  }
  if (preview) return <App {...preview} preview onLock={lock} />;
  if (store)
    return (
      <App
        gameRepository={store.gameRepository}
        playerRepository={store.playerRepository}
        syncStore={store}
        onLock={lock}
      />
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
        ) : payload ? (
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
