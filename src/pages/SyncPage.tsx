import { isInitialSample } from "../data/sampleDetection";
import { groupInfo } from "../data/groups";
import { useState } from "react";
import type { GitHubStore } from "../data/GitHubStore";
import {
  LocalStorageGameRepository,
  STORAGE_KEY,
} from "../data/LocalStorageGameRepository";
import { LocalStoragePlayerRepository } from "../data/PlayerRepository";
import { mergeLocal, type SharedData } from "../data/sharedData";
// 最終更新: 2026-09-10 — 認証情報は接続成功後に端末へ保存し、取り込み前に件数を提示する。
export function SyncPage({ store }: { store: GitHubStore }) {
  const [token, setToken] = useState("");
  const [connected, setConnected] = useState(store.authenticated);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [local, setLocal] = useState<SharedData | null>(null);
  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : "処理に失敗しました。");
    } finally {
      setBusy(false);
      setConnected(store.authenticated);
    }
  }
  return (
    <section className="panel settings-card sync-page">
      <h1>GitHub同期設定</h1>
      <p>保存先：{groupInfo(store.groupId).label}</p>
      <p>
        メンバー・対局・ルールは、開いている麻雀会の共有データへ保存します。PC・スマホも同じ麻雀会を選んでください。
      </p>
      <p>
        状態：
        {connected
          ? "接続済み・保存できます"
          : "閲覧モード・保存するには接続してください"}
      </p>
      <p className="muted">
        名前・戦績は暗号化して保存され、表示には合言葉が必要です。トークンはこのブラウザーに保存され、次回も接続を維持します。共用端末では、使い終わったら接続を解除してください。
      </p>
      <details>
        <summary>トークンの権限と保存について</summary>
        <p>
          トークンはアプリ側で暗号化せず、このブラウザーに保存します。認証のためGitHubに送信しますが、戦績データには保存しません。権限は戦績ファイルだけでなく、選択したリポジトリ内のコードなどにも及びます。
        </p>
        <p>
          接続解除は端末内のトークンを削除する操作です。トークン自体を無効にするには、
          <a
            href="https://github.com/settings/personal-access-tokens"
            target="_blank"
            rel="noreferrer"
          >
            GitHubのトークン設定
          </a>
          から削除してください。
        </p>
      </details>
      {!connected ? (
        <>
          <ol>
            <li>
              <a
                href="https://github.com/settings/personal-access-tokens/new?name=Jang-roku-sync&target_name=Passione0901&contents=write"
                target="_blank"
                rel="noreferrer"
              >
                GitHubで専用トークンを作成
              </a>
            </li>
            <li>
              Repository accessを「Only select
              repositories」にし、「JanRoku」だけを選択します。
            </li>
            <li>
              Repository permissionsの「Contents」を「Read and
              write」にし、有効期限を設定して作成します。
            </li>
            <li>
              表示されたトークンを下の欄に貼り付けます。トークンを他の人に共有しないでください。
            </li>
          </ol>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const value = token;
              setToken("");
              void run(async () => {
                await store.connect(value);
                setMessage("GitHubに接続しました。保存と取り込みができます。");
              });
            }}
          >
            <label className="chart-picker">
              GitHubトークン
              <input
                type="password"
                autoComplete="off"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                required
                disabled={busy}
              />
            </label>
            <button className="button primary" disabled={busy || !token.trim()}>
              接続する
            </button>
          </form>
        </>
      ) : (
        <button
          className="button subtle"
          disabled={busy}
          onClick={() => {
            void run(async () => {
              store.disconnect();
              setMessage("接続を解除し、この端末のトークンを削除しました。");
            });
          }}
        >
          接続を解除
        </button>
      )}
      <hr />
      {store.groupId === "main" && (
        <>
          <h2>この端末のデータを取り込む</h2>
          <p>
            以前このブラウザーだけに保存していたメンバー・対局を、共有データに追加できます。取り込み後も端末内の元データは残ります。
          </p>
          <button
            className="button subtle"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                const players =
                  await new LocalStoragePlayerRepository().getPlayers();
                const games =
                  window.localStorage.getItem(STORAGE_KEY) === null
                    ? []
                    : await new LocalStorageGameRepository().getGames();
                setLocal({
                  version: 1,
                  players,
                  games: games.filter((game) => !isInitialSample(game)),
                });
              })
            }
          >
            取り込む内容を確認
          </button>
          {local && (
            <div>
              <p>
                この端末：{local.players.length}人・{local.games.length}対局
              </p>
              <p>{local.players.map((p) => p.name).join("、")}</p>
              <p className="muted">
                同名メンバーと同じ対局は重複登録しません。既存対局と内容が異なる場合は、上書きせず中止します。初期サンプルの対局は取り込みません。
              </p>
              <button
                className="button primary"
                disabled={busy || !connected}
                onClick={() =>
                  void run(async () => {
                    await store.mutate((d) => mergeLocal(d, local));
                    setLocal(null);
                    setMessage(
                      "共有データへ取り込みました。他の端末でも確認できます。",
                    );
                  })
                }
              >
                この内容を共有データへ取り込む
              </button>
            </div>
          )}
        </>
      )}
      <hr />
      <button
        className="button subtle"
        disabled={busy}
        onClick={() =>
          void run(async () => {
            await store.refresh();
            setMessage("最新の共有データを取得しました。");
          })
        }
      >
        最新データを読み込む
      </button>
      <p className="muted">
        接続済みの場合は約30秒、閲覧モードは約2分ごとに更新します。画面へ戻った時も最新データを確認します。
      </p>
      {busy && <p role="status">処理中…</p>}
      {message && <p role="status">{message}</p>}
      {error && (
        <p role="alert" className="negative">
          {error}
        </p>
      )}
    </section>
  );
}
