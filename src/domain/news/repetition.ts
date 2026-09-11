export interface CopyText {
  text?: string;
  question?: string;
  answer?: string;
}
export interface CopyUsage {
  date: string;
  keys: string[];
}
export const NEWS_LOOKBACK_DAYS = 10;

// 最終更新: 2026-09-12 — 人名・日付・数字の差し替えも同じ文型として扱う。履歴はブラウザ内のみ。
export class CopyHistory {
  private readonly recent = new Map<string, number>();
  private readonly current = new Set<string>();
  private readonly cache = new Map<string, string[]>();
  private readonly names: string[];
  constructor(previous: readonly CopyUsage[], names: readonly string[]) {
    this.names = [...new Set(names.map((n) => n.normalize("NFKC")))]
      .filter(Boolean)
      .sort((a, b) => b.length - a.length);
    previous
      .slice(-NEWS_LOOKBACK_DAYS)
      .forEach((day, index) =>
        day.keys.forEach((key) => this.recent.set(key, index)),
      );
  }
  private keys(form: string, copy: CopyText): string[] {
    const texts = [copy.text, copy.question, copy.answer].filter(
      (t): t is string => !!t,
    );
    const cacheKey = JSON.stringify([form, texts]);
    const found = this.cache.get(cacheKey);
    if (found) return found;
    const keys = [`form:${form}`];
    for (const text of texts) {
      let normalized = text.normalize("NFKC");
      for (const name of this.names)
        normalized = normalized.split(name).join("〈選手〉");
      normalized = normalized
        .replace(/[+\-]?\d+(?:[.,/]\d+)*/g, "〈数値〉")
        .replace(/\s+/g, " ")
        .trim();
      // 短い定番の質問・挨拶だけでは、異なる回答まで同一扱いしない。
      if (normalized.length >= 12) keys.push(`text:${normalized}`);
      for (const sentence of normalized
        .split(/[。！？!?]/)
        .map((t) => t.trim()))
        if (sentence.length >= 24) keys.push(`sentence:${sentence}`);
    }
    this.cache.set(cacheKey, keys);
    return keys;
  }
  score(form: string, copy: CopyText): number {
    return Math.max(
      -1,
      ...this.keys(form, copy).map((key) =>
        this.current.has(key)
          ? NEWS_LOOKBACK_DAYS
          : (this.recent.get(key) ?? -1),
      ),
    );
  }
  record(form: string, copy: CopyText): void {
    this.keys(form, copy).forEach((key) => this.current.add(key));
  }
  usage(date: string): CopyUsage {
    return { date, keys: [...this.current].sort() };
  }
}
