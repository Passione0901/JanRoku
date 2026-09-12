import { copyHash } from "./editorial";

// 最終更新: 2026-09-12 — 読者ごとに約8割は呼び捨て、約2割は「選手」。選手本人のインタビューには適用しない。
export function readerVoice(template: string, readerKey: string): string {
  const suffix = copyHash(readerKey) % 5 === 0 ? "選手" : "";
  return template.replace(/(\{(?:player|opponent)\.name\})(?:選手|さん)?/g, `$1${suffix}`);
}
