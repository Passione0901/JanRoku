import { useState } from "react";
import type { Four, RuleConfig } from "../domain/types";
import { rawScore, result } from "../utils/format";
// 最終更新: 2026-09-10 — 編集中の空欄を集計に流さず、検証済みルールだけを適用する。
export function RuleEditor({
  config,
  onChange,
  busy,
  scope = "game",
}: {
  config: RuleConfig;
  onChange: (config: RuleConfig) => void;
  busy: boolean;
  scope?: "game" | "group";
}) {
  const [editing, setEditing] = useState(false);
  const [start, setStart] = useState(String(config.startingPoints));
  const [returns, setReturns] = useState(String(config.returnPoints));
  const [uma, setUma] = useState(config.uma.map(String));
  const [oka, setOka] = useState(config.oka);
  const [countNegative, setCountNegative] = useState(
    config.countNegativePoints ?? true,
  );
  const [zero, setZero] = useState(config.bustIncludesZero);
  const [error, setError] = useState("");
  function open() {
    setStart(String(config.startingPoints));
    setReturns(String(config.returnPoints));
    setUma(config.uma.map(String));
    setOka(config.oka);
    setZero(config.bustIncludesZero);
    setCountNegative(config.countNegativePoints ?? true);
    setError("");
    setEditing(true);
  }
  function apply() {
    const s = Number(start),
      r = Number(returns),
      u = uma.map(Number);
    if (
      !start.trim() ||
      !returns.trim() ||
      ![s, r].every(
        (v) =>
          Number.isSafeInteger(v) && v > 0 && v <= 10000000 && v % 100 === 0,
      )
    ) {
      setError(
        "持ち点・返し点は100点単位の正の整数で入力してください（最大10,000,000点）。",
      );
      return;
    }
    if (
      uma.some((v) => !v.trim()) ||
      u.some(
        (v) =>
          !Number.isFinite(v) ||
          Math.abs(v) > 10000 ||
          Math.abs(v * 10 - Math.round(v * 10)) > 0.000001,
      )
    ) {
      setError("ウマは0.1pt単位、±10,000pt以内で入力してください。");
      return;
    }
    if (Math.round(u.reduce((a, b) => a + b, 0) * 10) !== 0) {
      setError("順位ウマの合計が0になるように入力してください。");
      return;
    }
    onChange({
      ...config,
      id: `custom-${crypto.randomUUID()}`,
      startingPoints: s,
      returnPoints: r,
      uma: u as Four<number>,
      oka,
      bustIncludesZero: zero,
      countNegativePoints: countNegative,
    });
    setEditing(false);
    setError("");
  }
  return (
    <section className="info-card rules-card">
      <p className="eyebrow">TABLE RULES</p>
      <h2>{scope === "group" ? "新規対局の初期ルール" : "今回のルール"}</h2>
      <p>
        精算：
        {config.settlementRounding === "five-down-six-up"
          ? "5捨6入（1pt単位）"
          : "小数第1位まで（0.1pt単位）"}
      </p>
      {!editing ? (
        <>
          <dl>
            <div>
              <dt>持ち点 / 返し</dt>
              <dd>
                {rawScore(config.startingPoints)} /{" "}
                {rawScore(config.returnPoints)}
              </dd>
            </div>
            <div>
              <dt>順位ウマ</dt>
              <dd>{config.uma.map(result).join(" / ")}</dd>
            </div>
            <div>
              <dt>オカ</dt>
              <dd>
                {config.oka === "winner"
                  ? `${result(((config.returnPoints - config.startingPoints) * 4) / config.resultDivisor)}を1位に加算`
                  : "なし"}
              </dd>
            </div>
            <div>
              <dt>箱下計算</dt>
              <dd>{config.countNegativePoints === false ? "なし" : "あり"}</dd>
            </div>
            <div>
              <dt>箱割れ</dt>
              <dd>{config.bustIncludesZero ? "0点以下" : "0点未満"}</dd>
            </div>
          </dl>
          <button
            type="button"
            className="button subtle"
            onClick={open}
            disabled={busy}
          >
            ルールを変更
          </button>
        </>
      ) : (
        <div className="rule-editor">
          <label>
            開始時の持ち点（点）
            <input
              type="number"
              step="100"
              min="100"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              disabled={busy}
            />
          </label>
          <label>
            返し点（点）
            <input
              type="number"
              step="100"
              min="100"
              value={returns}
              onChange={(e) => setReturns(e.target.value)}
              disabled={busy}
            />
          </label>
          <fieldset disabled={busy}>
            <legend>順位ウマ（pt）</legend>
            <div className="rule-presets">
              {[
                [10, 5, -5, -10],
                [20, 10, -10, -20],
                [0, 0, 0, 0],
              ].map((u, i) => (
                <button
                  type="button"
                  className="button subtle"
                  key={i}
                  onClick={() => setUma(u.map(String))}
                >
                  {["5-10", "10-20", "なし"][i]}
                </button>
              ))}
            </div>
            <div className="uma-fields">
              {uma.map((v, i) => (
                <label key={i}>
                  {i + 1}位
                  <input
                    type="number"
                    step="0.1"
                    value={v}
                    onChange={(e) =>
                      setUma((old) =>
                        old.map((x, j) => (i === j ? e.target.value : x)),
                      )
                    }
                  />
                </label>
              ))}
            </div>
          </fieldset>
          <label>
            オカ
            <select
              value={oka}
              onChange={(e) => setOka(e.target.value as RuleConfig["oka"])}
              disabled={busy}
            >
              <option value="winner">
                持ち点と返し点の差額×4人分を1位に加算
              </option>
              <option value="none">なし</option>
            </select>
          </label>
          <label>
            箱下計算
            <select
              value={String(countNegative)}
              onChange={(e) => setCountNegative(e.target.value === "true")}
              disabled={busy}
            >
              <option value="true">あり</option>
              <option value="false">なし（マイナス点は0点で計算）</option>
            </select>
          </label>
          <p className="muted">
            なしの場合も素点・順位はそのまま記録します。収支合計は0にならない場合があります。
          </p>
          <label>
            箱割れの判定
            <select
              value={String(zero)}
              onChange={(e) => setZero(e.target.value === "true")}
              disabled={busy}
            >
              <option value="false">0点未満</option>
              <option value="true">0点以下</option>
            </select>
          </label>
          {error && (
            <p role="alert" className="negative">
              {error}
            </p>
          )}
          <div className="rule-presets">
            <button
              type="button"
              className="button primary"
              disabled={busy}
              onClick={apply}
            >
              ルールを適用
            </button>
            <button
              type="button"
              className="button subtle"
              disabled={busy}
              onClick={() => setEditing(false)}
            >
              キャンセル
            </button>
          </div>
        </div>
      )}
      <p className="muted">
        {scope === "group"
          ? "変更を適用した後、「ルールを保存」でこの麻雀会の初期ルールに設定します。"
          : "この対局に適用し、登録時にルールも保存します。ほかの対局のルールは変更しません。"}
      </p>
    </section>
  );
}
