import { useState } from "react";
import { Database, RotateCcw, Info } from "lucide-react";
import { entryRules as rules } from "../config/rules";
import { titleConfig } from "../config/titleConfig";
import { usePlayers } from "../hooks/usePlayers";
import { rawScore, result } from "../utils/format";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { TitleBadge } from "../components/TitleBadge";

// 最終更新: 2026-09-10 — 全件の置換は件数を提示した確認後だけ行う。
export function SettingsPage({
  shared = false,
  gameCount,
  onReset,
  busy,
}: {
  shared?: boolean;
  gameCount: number;
  onReset: () => Promise<void>;
  busy: boolean;
}) {
  const { players } = usePlayers();
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState("");
  const reset = async () => {
    try {
      await onReset();
      setConfirm(false);
      setError("");
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "復元できませんでした。",
      );
      setConfirm(false);
    }
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">LEAGUE SETTINGS</p>
          <h1>
            ルール・データ設定
            <span className="heading-dot" aria-hidden="true">
              .
            </span>
          </h1>
        </div>
      </div>
      <div className="settings-grid">
        <section className="panel settings-card">
          <h2>新規対局の初期ルール</h2>
          <dl className="settings-list">
            <div>
              <dt>人数</dt>
              <dd>{rules.playerCount}人麻雀</dd>
            </div>
            <div>
              <dt>持ち点</dt>
              <dd>{rawScore(rules.startingPoints)}</dd>
            </div>
            <div>
              <dt>返し</dt>
              <dd>{rawScore(rules.returnPoints)}</dd>
            </div>
            <div>
              <dt>順位ウマ（1〜4位）</dt>
              <dd>{rules.uma.map((value) => result(value)).join(" / ")}</dd>
            </div>
            <div>
              <dt>オカ</dt>
              <dd>
                {rules.oka === "winner"
                  ? `${result(((rules.returnPoints - rules.startingPoints) * 4) / rules.resultDivisor)}を1位へ`
                  : "なし"}
              </dd>
            </div>
            <div>
              <dt>入力単位</dt>
              <dd>{rules.scoreUnit}点</dd>
            </div>
            <div>
              <dt>同点時</dt>
              <dd>入力順を優先</dd>
            </div>
            <div>
              <dt>箱割れ</dt>
              <dd>{rules.bustIncludesZero ? "0点以下" : "0点未満"}</dd>
            </div>
            <div>
              <dt>箱下計算</dt>
              <dd>{rules.countNegativePoints === false ? "なし" : "あり"}</dd>
            </div>
            <div>
              <dt>精算</dt>
              <dd>5捨6入（1pt単位）</dd>
            </div>
          </dl>
          <p className="muted">
            持ち点入力時のルールです。入力画面の「今回のルール」で対局ごとに変更できます。収支入力では入力したptをそのまま保存します。
          </p>
        </section>
        <section className="panel settings-card">
          <h2>
            <Database size={18} />
            保存データ
          </h2>
          <p>
            現在 <b>{gameCount}</b> 戦を記録しています。
          </p>
          {shared ? (
            <p>
              GitHubの共通データを表示しています。
              <a href="#/sync">同期設定・この端末のデータ取り込み</a>
            </p>
          ) : (
            <div className="local-storage-note">
              <Info size={18} />
              <p>
                記録は、
                <b>今使っている端末の、このブラウザーだけ</b>
                に保存されます。ほかのメンバーや端末とは共有されません。ブラウザーのデータを消去すると記録も消えます。
              </p>
            </div>
          )}
          {!shared && (
            <>
              <h3>サンプルデータ</h3>
              <p className="muted">
                48戦のサンプル対局に置き換えます。現在の対局履歴は削除されます。メンバー一覧は変更しません。
              </p>
              <button
                className="button subtle reset-button"
                disabled={busy}
                onClick={() => setConfirm(true)}
              >
                <RotateCcw size={16} />
                サンプルデータに戻す
              </button>
            </>
          )}
          {error && (
            <p className="negative" role="alert">
              {error}
            </p>
          )}
        </section>
        <section className="panel settings-card">
          <h2>強さP・肩書きについて</h2>
          <p className="muted">
            強さPは、対局済みメンバーの1対局あたりの平均収支から計算する偏差値です。50＋10×（本人の平均収支−全員の平均収支の平均）÷標準偏差。未対局は比較対象から除外し、差がない場合は50です。少数対局の値は変動しやすくなります。
          </p>
          <p className="muted">
            肩書きは表示中の強さPが指定値以上で切り替わります。30未満はレアメタル、70以上はレジェンドです。未対局には肩書きを付けません。
          </p>
          <div className="title-candidates">
            {titleConfig.map((title) => (
              <span className="title-candidate" key={title.name}>
                <small>{title.minStrength}〜</small>
                <TitleBadge title={title.name} />
              </span>
            ))}
          </div>
        </section>
        <section className="panel settings-card">
          <h2>
            参加メンバー <small>{players.length}人</small>
          </h2>
          <div className="member-list">
            {players.map((player) => (
              <a href={`#/players/${player.id}`} key={player.id}>
                {player.name}
              </a>
            ))}
          </div>
          <p className="muted">メンバータブから新しい人を追加できます。</p>
        </section>
      </div>
      {confirm && (
        <ConfirmDialog
          title="サンプルデータに戻しますか？"
          confirmLabel="48半荘のサンプルに戻す"
          danger
          busy={busy}
          onCancel={() => setConfirm(false)}
          onConfirm={() => {
            void reset();
          }}
        >
          <p>
            現在の全記録（読み込み済み {gameCount}{" "}
            半荘）を置き換えます。読み込めない保存データがある場合も置き換えます。この操作は取り消せません。
          </p>
        </ConfirmDialog>
      )}
    </>
  );
}
