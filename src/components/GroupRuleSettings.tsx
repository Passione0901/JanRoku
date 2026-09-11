import { useState } from "react";
import { useGroup } from "../hooks/useGroup";
import { RuleEditor } from "./RuleEditor";

// 最終更新: 2026-09-11 — 保存先は現在の麻雀会だけ。保存済み対局の計算は変えない。
export function GroupRuleSettings() {
  const group = useGroup();
  const [draft, setDraft] = useState(group.rules);
  const [base, setBase] = useState(group.rules);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  return (
    <>
      <RuleEditor
        scope="group"
        config={draft}
        onChange={(value) => {
          setDraft(value);
          setMessage("");
        }}
        busy={busy}
      />
      <p className="muted">
        この麻雀会の新規対局に使うルールです。過去の対局には影響しません。
      </p>
      <button
        className="button primary"
        disabled={busy || JSON.stringify(draft) === JSON.stringify(group.rules)}
        onClick={async () => {
          setBusy(true);
          setError("");
          setMessage("");
          try {
            await group.saveRules?.(draft, base);
            setBase(draft);
            setMessage("この麻雀会のルールを保存しました。");
          } catch (e) {
            setError(e instanceof Error ? e.message : "保存できませんでした。");
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "保存中…" : "ルールを保存"}
      </button>
      {message && <p role="status">{message}</p>}
      {error && (
        <p role="alert" className="negative">
          {error}
        </p>
      )}
    </>
  );
}
