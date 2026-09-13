// 最終更新: 2026-09-13 — 数字・四則演算・括弧だけを解釈し、JavaScriptは実行しない。
export function evaluateScoreExpression(input: string): number | null {
  if (!input.trim() || input.length > 200) return null;
  const text = input.normalize("NFKC").replace(/[−ー]/g, "-").replace(/×/g, "*").replace(/÷/g, "/");
  let position = 0;
  const whitespace = () => { while (/\s/.test(text[position] ?? "") && position < text.length) position++; };
  const take = (char: string) => { whitespace(); if (text[position] !== char) return false; position++; return true; };
  const primary = (): number => {
    if (take("+")) return primary();
    if (take("-")) return -primary();
    if (take("(")) { const n = sum(); if (!take(")")) throw new Error(); return n; }
    whitespace();
    const match = /^\d+/.exec(text.slice(position));
    if (!match) throw new Error();
    position += match[0].length;
    const n = Number(match[0]);
    if (!Number.isSafeInteger(n)) throw new Error();
    return n;
  };
  const product = (): number => {
    let n = primary();
    while (true) {
      if (take("*")) n *= primary();
      else if (take("/")) { const divisor = primary(); if (divisor === 0) throw new Error(); n /= divisor; }
      else return n;
      if (!Number.isFinite(n) || Math.abs(n) > Number.MAX_SAFE_INTEGER) throw new Error();
    }
  };
  const sum = (): number => {
    let n = product();
    while (true) {
      if (take("+")) n += product();
      else if (take("-")) n -= product();
      else return n;
      if (!Number.isFinite(n) || Math.abs(n) > Number.MAX_SAFE_INTEGER) throw new Error();
    }
  };
  try { const n = sum(); whitespace(); return position === text.length && Number.isSafeInteger(n) ? n : null; }
  catch { return null; }
}
