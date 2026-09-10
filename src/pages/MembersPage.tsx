import { ConfirmDialog } from "../components/ConfirmDialog";
import type { Player } from "../domain/types";
import { useRef, useState, type FormEvent } from "react";
import { UserPlus } from "lucide-react";
import { usePlayers } from "../hooks/usePlayers";
import { PlayerIdentity } from "../components/PlayerIdentity";
// 最終更新: 2026-09-10 — 追加後は全画面へ即時反映し、連続送信を防ぐ。
export function MembersPage({ shared = false }: { shared?: boolean }) {
  const { players, addPlayer, deletePlayer, canDelete } = usePlayers();
  const [deleteTarget, setDeleteTarget] = useState<Player | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await addPlayer(name);
      setNotice(`${name.trim()}さんを追加しました。対局入力で選択できます。`);
      setName("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "追加できませんでした。");
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="members-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">MEMBERS</p>
          <h1>メンバー</h1>
          <p>一緒に卓を囲む仲間を追加しましょう。</p>
        </div>
      </div>
      <div className="members-layout">
        <section className="panel member-add">
          <h2>
            <UserPlus size={21} /> 新しいメンバー
          </h2>
          <form onSubmit={(event) => void submit(event)}>
            <label htmlFor="member-name">メンバー名</label>
            <input
              id="member-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="例：田中"
              autoComplete="off"
              required
              aria-describedby="member-help"
              disabled={busy}
            />
            <p id="member-help">1〜30文字。同じ名前は登録できません。</p>
            <button className="button primary" disabled={busy || !name.trim()}>
              {busy ? "保存中…" : "メンバーを追加"}
            </button>
          </form>
          {error && (
            <p role="alert" className="negative">
              {error}
            </p>
          )}
          {notice && (
            <div role="status">
              <p>{notice}</p>
              <a href="#/input" className="button subtle">
                対局を入力する
              </a>
            </div>
          )}
          <p className="member-storage-note">
            {shared
              ? "追加したメンバーはGitHubへ保存し、他の端末にも反映します。保存には同期設定で認証してください。"
              : "追加したメンバーはこのブラウザーに保存されます。他の端末や友人のブラウザーには共有されません。"}
          </p>
        </section>
        <section className="panel member-roster">
          <h2>
            登録メンバー <span>{players.length}人</span>
          </h2>
          <div className="member-grid">
            {players.map((player) => (
              <div className="member-row" key={player.id}>
                <PlayerIdentity id={player.id} />
                {canDelete && (
                  <button
                    className="button subtle"
                    disabled={busy}
                    aria-label={`${player.name}を削除`}
                    onClick={() => {
                      setDeleteError("");
                      setDeleteTarget(player);
                    }}
                  >
                    削除
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
      {deleteTarget && (
        <ConfirmDialog
          title={`${deleteTarget.name}さんを削除しますか？`}
          confirmLabel="メンバーを削除"
          danger
          busy={busy}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => {
            if (saving.current) return;
            saving.current = true;
            setBusy(true);
            void deletePlayer(deleteTarget.id)
              .then(() => {
                setNotice(`${deleteTarget.name}さんを削除しました。`);
                setDeleteTarget(null);
              })
              .catch((e: unknown) =>
                setDeleteError(
                  e instanceof Error ? e.message : "削除できませんでした。",
                ),
              )
              .finally(() => {
                saving.current = false;
                setBusy(false);
              });
          }}
        >
          <p>
            メンバー一覧から削除します。この操作は取り消せません。対局履歴があるメンバーは削除できません。
          </p>
          {deleteError && (
            <p role="alert" className="negative">
              {deleteError} <a href="#/history">履歴を開く</a>
            </p>
          )}
        </ConfirmDialog>
      )}
    </section>
  );
}
