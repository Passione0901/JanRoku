import { createResultGame, validateResultInput } from "../domain/directResults";
import { previousPlayers } from "../data/lastPlayers";
import { RuleEditor } from "../components/RuleEditor";
import { useRef, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  CircleCheck,
  Minus,
  Save,
  AlertTriangle,
  Circle,
} from "lucide-react";
import { usePlayers } from "../hooks/usePlayers";
import { entryRules as rules } from "../config/rules";
import type { Four, Game, GameFormat } from "../domain/types";
import { createGame, calculateGameResults } from "../domain/scoring";
import {
  parseScoreUnits,
  validateGameInput,
  type DraftEntry,
} from "../domain/input";
import { localDate } from "../utils/date";
import { rawScore, result, resultClass } from "../utils/format";
import { ConfirmDialog } from "../components/ConfirmDialog";

// 最終更新: 2026-09-10 — 入力は100点単位。編集時は当時のルールと登録日時を維持する。
export function InputPage({
  game,
  busy,
  onSave,
}: {
  game?: Game;
  busy: boolean;
  onSave: (game: Game, editing: boolean) => Promise<void>;
}) {
  const { players } = usePlayers();
  const [mode, setMode] = useState<"points" | "results">(
    game?.inputMode ?? "points",
  );
  const isResults = mode === "results";
  const formatTotal = (n: number) =>
    isResults ? `${result(n)}pt` : rawScore(n);
  const initialRevision = useRef(game?.syncRevision);
  const [config, setConfig] = useState(() =>
    structuredClone(game?.rules ?? rules),
  );
  const [format, setFormat] = useState<GameFormat>(game?.format ?? "hanchan");
  const [date, setDate] = useState(game?.date ?? localDate());
  const [draft, setDraft] = useState<
    Four<DraftEntry & { resultUnits?: string }>
  >(() =>
    game
      ? (game.players.map((entry) => ({
          playerId: entry.playerId,
          resultUnits: String(entry.result),
          units:
            entry.rawScore === null
              ? ""
              : String(entry.rawScore / config.scoreUnit),
        })) as Four<DraftEntry & { resultUnits?: string }>)
      : (previousPlayers(players).map((playerId) => ({
          playerId,
          units: "",
        })) as Four<DraftEntry & { resultUnits?: string }>),
  );
  const [submitted, setSubmitted] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [saveError, setSaveError] = useState("");
  const formError = useRef<HTMLDivElement>(null);
  const stableId = useRef(game?.id ?? crypto.randomUUID());
  const availableIds = [
    ...new Set([
      ...players.map((player) => player.id),
      ...(game?.players.map((entry) => entry.playerId) ?? []),
    ]),
  ];
  const pointValidation = validateGameInput(date, draft, config, availableIds);
  const resultValidation = validateResultInput(date, draft, availableIds);
  const validation = isResults ? resultValidation : pointValidation;
  const hasCompleteInput = validation.entries !== null;
  const previews = isResults
    ? resultValidation.previews
    : pointValidation.entries
      ? calculateGameResults(pointValidation.entries, config)
      : null;
  const updateEntry = (
    seat: number,
    next: Partial<DraftEntry & { resultUnits: string }>,
  ) => {
    setDraft(
      (previous) =>
        previous.map((entry, i) =>
          i === seat ? { ...entry, ...next } : entry,
        ) as Four<DraftEntry & { resultUnits?: string }>,
    );
    setSaveError("");
  };
  const save = async (acceptMismatch: boolean) => {
    if (!validation.entries || busy) return;
    setSaveError("");
    try {
      const next = isResults
        ? createResultGame({
            id: stableId.current,
            date,
            format,
            createdAt: game?.createdAt ?? new Date().toISOString(),
            entries: resultValidation.entries!,
            acceptMismatch,
          })
        : createGame({
            id: stableId.current,
            date,
            format,
            createdAt: game?.createdAt ?? new Date().toISOString(),
            entries: pointValidation.entries!,
            config,
            acceptMismatch,
          });
      if (game) {
        next.syncRevision = initialRevision.current;
        next.updatedAt = new Date().toISOString();
        next.registeredBy = game.registeredBy;
        next.note = game.note;
      }
      await onSave(next, !!game);
      setConfirm(false);
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : "保存できませんでした。",
      );
      setConfirm(false);
    }
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    if (!validation.entries) {
      requestAnimationFrame(() => formError.current?.focus());
      return;
    }
    if (validation.mismatch) setConfirm(true);
    else void save(false);
  };
  return (
    <div className="input-layout">
      <div className="page-heading">
        <div>
          <p className="eyebrow">RECORD A GAME</p>
          <h1>
            {`${format === "tonpu" ? "東風" : "半荘"}を${game ? "編集" : "記録"}`}
            <span className="heading-dot" aria-hidden="true">
              .
            </span>
          </h1>
          <p className="muted input-context">
            {isResults
              ? "4人を選んで、精算済みの収支を入力。"
              : "4人を選んで、最終持ち点を入力。"}
          </p>
        </div>
        {game && (
          <a className="button subtle" href="#/history">
            <ArrowLeft size={16} />
            戻る
          </a>
        )}
      </div>
      <div className={`input-columns ${isResults ? "results-only" : ""}`}>
        <form onSubmit={submit} noValidate className="game-form">
          <div className="input-mode-switch" role="group" aria-label="入力方法">
            {(
              [
                ["points", "持ち点入力"],
                ["results", "収支入力"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className="button mode-option"
                aria-pressed={mode === value}
                disabled={busy}
                onClick={() => {
                  setMode(value);
                  setSubmitted(false);
                  setSaveError("");
                  setConfirm(false);
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="form-top">
            <label htmlFor="game-date">対局日</label>
            <input
              id="game-date"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              required
              disabled={busy}
            />
          </div>
          <div className="form-top">
            <label htmlFor="game-format">対局形式</label>
            <select
              id="game-format"
              value={format}
              onChange={(event) => setFormat(event.target.value as GameFormat)}
              disabled={busy}
            >
              <option value="hanchan">半荘</option>
              <option value="tonpu">東風</option>
            </select>
          </div>
          <p className="muted input-context">
            {isResults
              ? "ウマ・オカを含む精算済みの収支を入力してください。持ち点は未記録になります。"
              : "集計には「今回のルール」を使用します。"}
          </p>
          <div className="form-instruction">
            <div>
              <h2>{isResults ? "メンバーと収支" : "メンバーと持ち点"}</h2>
              <p>
                {isResults
                  ? "順位は収支の高い順です。同じ収支の場合は入力順を優先します。"
                  : "メンバーを選んで持ち点を入力してください。同点時は入力順を優先します。"}
              </p>
            </div>
          </div>
          <div className="entry-list">
            {draft.map((entry, seat) => {
              const value = isResults ? (entry.resultUnits ?? "") : entry.units;
              const score = isResults
                ? /^[+-]?\d+(?:\.\d)?$/.test(value)
                  ? Number(value)
                  : null
                : parseScoreUnits(value, config.scoreUnit);
              const invalid = submitted && score === null;
              return (
                <div className="entry-row" key={seat}>
                  <div className="seat-indicator">
                    <span>{seat + 1}</span>
                    <small>人目</small>
                  </div>
                  <div className="entry-player">
                    <label htmlFor={`player-${seat}`}>メンバー</label>
                    <select
                      id={`player-${seat}`}
                      required
                      disabled={busy}
                      value={entry.playerId}
                      aria-invalid={submitted && !entry.playerId}
                      onChange={(event) =>
                        updateEntry(seat, { playerId: event.target.value })
                      }
                    >
                      <option value="">選択してください</option>
                      {availableIds.map((id) => (
                        <option
                          key={id}
                          value={id}
                          disabled={draft.some(
                            (other, i) => i !== seat && other.playerId === id,
                          )}
                        >
                          {players.find((player) => player.id === id)?.name ??
                            id}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="entry-score">
                    <label htmlFor={`score-${seat}`}>
                      {isResults ? "収支（pt）" : "持ち点"}
                    </label>
                    <div className="score-input">
                      <button
                        className={`sign-button ${value.startsWith("-") ? "negative" : ""}`}
                        type="button"
                        disabled={busy}
                        aria-label={`${seat + 1}人目の${isResults ? "収支" : "点数"}のプラス・マイナスを切り替え`}
                        aria-pressed={value.startsWith("-")}
                        onClick={() =>
                          updateEntry(seat, {
                            [isResults ? "resultUnits" : "units"]:
                              value.startsWith("-")
                                ? value.slice(1)
                                : `-${value.replace(/^\+/, "")}`,
                          })
                        }
                      >
                        <Minus size={17} />
                      </button>
                      <input
                        id={`score-${seat}`}
                        type="text"
                        inputMode={isResults ? "decimal" : "numeric"}
                        pattern={isResults ? undefined : "-?[0-9]+"}
                        autoComplete="off"
                        placeholder={isResults ? "35" : "250"}
                        value={value}
                        required
                        disabled={busy}
                        aria-invalid={invalid}
                        aria-describedby={`score-hint-${seat}`}
                        onChange={(event) =>
                          updateEntry(seat, {
                            [isResults ? "resultUnits" : "units"]:
                              event.target.value,
                          })
                        }
                      />
                      <span
                        className={`score-suffix ${isResults ? "score-unit" : ""}`}
                        aria-hidden="true"
                      >
                        {isResults ? "pt" : "00"}
                      </span>
                    </div>
                    <span
                      id={`score-hint-${seat}`}
                      className={invalid ? "score-hint negative" : "sr-only"}
                    >
                      {score === null
                        ? value && value !== "-"
                          ? isResults
                            ? "0.1pt単位で入力してください"
                            : "整数で入力してください"
                          : isResults
                            ? "収支を入力してください。"
                            : "末尾の00は自動で付きます。"
                        : formatTotal(score)}
                    </span>
                  </div>
                  {previews && (
                    <span
                      className={`entry-preview ${resultClass(previews[seat].result)}`}
                    >
                      {previews[seat].rank}位{" "}
                      <b>{result(previews[seat].result)} pt</b>
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          <div
            className={`total-check ${!hasCompleteInput ? "pending" : validation.mismatch ? "mismatch" : "matched"}`}
          >
            <div>
              {!hasCompleteInput ? (
                <Circle size={19} />
              ) : validation.mismatch ? (
                <AlertTriangle size={19} />
              ) : (
                <CircleCheck size={19} />
              )}
              <span>{isResults ? "合計収支" : "合計持ち点"}</span>
            </div>
            <div>
              <strong>
                {hasCompleteInput ? formatTotal(validation.total) : "—"}
              </strong>
              <small>
                {hasCompleteInput
                  ? `基準 ${formatTotal(validation.expected)}`
                  : "4人分を入力すると表示します"}{" "}
                {hasCompleteInput &&
                  validation.mismatch &&
                  ` / 差 ${formatTotal(validation.total - validation.expected)}`}
              </small>
            </div>
          </div>
          {submitted && validation.errors.length > 0 && (
            <div
              className="error-panel form-errors"
              role="alert"
              tabIndex={-1}
              ref={formError}
            >
              {validation.errors.map((error) => (
                <p key={error}>{error}</p>
              ))}
            </div>
          )}
          {saveError && (
            <div className="error-panel" role="alert">
              {saveError}
            </div>
          )}
          <button
            className="button primary save-button"
            type="submit"
            disabled={busy}
          >
            <Save size={18} />
            {busy
              ? "保存中…"
              : game
                ? "変更を保存"
                : format === "tonpu"
                  ? "この東風を登録"
                  : "この半荘を登録"}
          </button>
          <p className="form-note">
            {game
              ? "保存すると、すべての戦績が再集計されます。"
              : "登録後も履歴から編集・削除できます。"}
          </p>
        </form>
        {!isResults && (
          <aside className="input-aside">
            <RuleEditor
              config={config}
              busy={busy}
              onChange={(next) => {
                setConfig(next);
                setConfirm(false);
                setSaveError("");
              }}
            />
          </aside>
        )}
      </div>
      {confirm && (
        <ConfirmDialog
          title={
            isResults
              ? "収支の合計が0ではありません"
              : "合計点が一致していません"
          }
          confirmLabel={isResults ? "この収支で保存" : "この点数で保存"}
          onCancel={() => setConfirm(false)}
          onConfirm={() => {
            void save(true);
          }}
          busy={busy}
        >
          <p>
            合計は <b>{formatTotal(validation.total)}</b>、想定は{" "}
            <b>{formatTotal(validation.expected)}</b> です。
          </p>
          <p>
            {isResults
              ? "入力した収支を調整せず保存します。入力内容を確認してください。"
              : "この点数のまま保存すると、収支の合計が0にならない場合があります。入力内容を確認してください。"}
          </p>
        </ConfirmDialog>
      )}
    </div>
  );
}
