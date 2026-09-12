import headlines from "../../content/daily-news/headlines.json";
import dailyNews from "../../content/daily-news/daily-news.json";
import summaries from "../../content/daily-news/member-summaries.json";
import interviews from "../../content/daily-news/fictional-interviews.json";
import articles from "../../content/daily-news/article-paragraphs.json";
import comments from "../../content/daily-news/fictional-reader-comments.json";
import contract from "../../content/daily-news/fact-contract.json";
import {
  collectNewsFacts,
  ruleSignature,
  type Facts,
  type NewsSource,
  type NewsSubject,
} from "./facts";
import {
  createCopyDesk,
  playerLineOptions,
  interviewOptions,
} from "./editorial";
import { isNewsAvailable } from "./availability";
import { CopyHistory, NEWS_LOOKBACK_DAYS, type CopyUsage } from "./repetition";
import { result } from "../../utils/format";
import { formatDate, isValidDate } from "../../utils/date";
import { createReaderThreads, type CommentSource, type ReaderThread } from "./discussion";
import { readerVoice } from "./readerVoice";
import { titleChangeOptions } from "./titleChanges";
import { dayLeadOptions, matchupImportance } from "./featurePolicy";
import { selectNewsPhotos } from "./photos";

interface Condition {
  fact: string;
  op: string;
  value?: string | boolean | number;
  valueFact?: string;
}
export interface NewsTemplate {
  id: string;
  event: string;
  topic: string;
  priority: number;
  conditions: { all: Condition[] };
  requiredFacts: string[];
  text?: string;
  question?: string;
  answer?: string;
  paragraphRole?: string;
}
interface Catalog {
  templates: NewsTemplate[];
}
type Kind =
  | "headline"
  | "news"
  | "summary"
  | "interview"
  | "article"
  | "reader";
const catalogs: Record<Kind, Catalog> = {
  headline: headlines,
  news: dailyNews,
  summary: summaries,
  interview: interviews,
  article: articles,
  reader: comments,
};
interface Definition {
  type: string;
  minimum?: number;
  maximum?: number;
  enum?: string[];
  format?: string;
}
const definitions = contract.facts as Record<string, Definition>;
const negativeTopics = new Set([
  "small-negative",
  "tough-day",
  "recovery-still-negative",
]);
interface Candidate {
  template: NewsTemplate;
  subject: NewsSubject;
}
const COMMENT_TARGET = 20;
export interface NewsEdition {
  headline: string;
  photos: { lead: string; secondary: string };
  news: string[];
  paragraphs: string[];
  comments: string[];
  commentThreads: ReaderThread[];
  ticker: string[];
  members: {
    id: string;
    name: string;
    color: string;
    summary: string;
    question: string;
    answer: string;
    total: number;
    games: number;
  }[];
  playerCount: number;
  gameCount: number;
  formatSummary: string;
}

// 最終更新: 2026-09-12 — 欠損や型違いを0へ丸めず、成立する条件だけを採用する。
export function templateEligible(t: NewsTemplate, facts: Facts): boolean {
  if (
    !t.requiredFacts.every((key) => {
      const value = facts[key],
        d = definitions[key];
      if (!d || value === undefined || value === null) return false;
      if (
        d.type === "integer"
          ? !Number.isInteger(value)
          : typeof value !== d.type
      )
        return false;
      if (
        typeof value === "number" &&
        (!Number.isFinite(value) ||
          Math.abs(value * 10 - Math.round(value * 10)) > 1e-8)
      )
        return false;
      if (typeof value === "string" && !value.trim()) return false;
      if (d.format === "date" && !isValidDate(String(value))) return false;
      return (
        !(d.minimum !== undefined && Number(value) < d.minimum) &&
        !(d.maximum !== undefined && Number(value) > d.maximum) &&
        (!d.enum || d.enum.includes(String(value)))
      );
    })
  )
    return false;
  return t.conditions.all.every((c) => {
    const a = facts[c.fact],
      b = c.valueFact ? facts[c.valueFact] : c.value;
    if (a === undefined || b === undefined || typeof a !== typeof b)
      return false;
    if (c.op === "eq") return a === b;
    if (c.op === "ne") return a !== b;
    if (typeof a !== "number" || typeof b !== "number") return false;
    // 0.1ptの整数で比較し、二進浮動小数点の境界差を持ち込まない。
    const left = Math.round(a * 10),
      right = Math.round(b * 10);
    return c.op === "gt"
      ? left > right
      : c.op === "gte"
        ? left >= right
        : c.op === "lt"
          ? left < right
          : c.op === "lte"
            ? left <= right
            : false;
  });
}
// 表示用の文字列置換のみ。名前は描画側でもReactテキストとして扱う。
export function fillNewsText(text: string, facts: Facts): string {
  return text.replace(/\{([a-zA-Z][\w.]*)\}/g, (_, key: string) => {
    const value = facts[key];
    if (value === undefined)
      throw new Error("ニュースに必要な記録が不足しています。");
    if (key === "day.date") return formatDate(String(value));
    if (
      [
        "player.totalResult",
        "player.minCumulative",
        "player.beforeLatestResult",
        "player.latestResult",
        "player.previousBestDaily",
      ].includes(key)
    )
      return result(Number(value));
    return String(value);
  });
}
// 最終更新: 2026-09-12 — 架空取材の名前には必ず敬称を付け、既存の「さん」「選手」は二重にしない。
export function fillInterviewText(text: string, facts: Facts): string {
  return fillNewsText(text.replace(/\{(?:player|opponent)\.name\}(?!さん|選手)/g, "$&選手"), facts);
}
function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++)
    h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}
const variants = new Map<string, { index: number; count: number }>();
for (const catalog of Object.values(catalogs)) {
  const pools = new Map<string, NewsTemplate[]>();
  for (const t of catalog.templates) {
    const key = `${t.event}/${t.paragraphRole === "closing" ? "closing" : "body"}`;
    pools.set(key, [...(pools.get(key) ?? []), t]);
  }
  for (const pool of pools.values()) {
    pool.sort((a, b) => a.id.localeCompare(b.id));
    pool.forEach((t, index) =>
      variants.set(t.id, { index, count: pool.length }),
    );
  }
}

interface ReplayedEdition {
  edition: NewsEdition | null;
  usage: CopyUsage;
}
const replayCache = new WeakMap<
  NewsSource["games"],
  {
    fingerprint: string;
    groups: Map<string, Map<string, ReplayedEdition>>;
  }
>();

// 最終更新: 2026-09-12 — 古い開催日から再現し、対象日より前の10開催日で実際に採用した文案を参照する。
export function createNewsEdition(
  source: NewsSource,
  now = Date.now(),
): NewsEdition | null {
  if (!isNewsAvailable(source.date, now) || !source.realRecords) return null;
  const dates = [
    ...new Set(
      source.games
        .filter((g) => isValidDate(g.date) && g.date <= source.date)
        .map((g) => g.date),
    ),
  ].sort();
  if (!dates.includes(source.date)) return null;
  // 同じ読み込み済みデータの再閲覧では再集計しない。訂正は内容で検知し、公開データや端末ストレージには保存しない。
  const fingerprint = JSON.stringify([
    source.players.map((p) => [p.id, p.name, p.color]).sort(),
    source.games
      .map((g) => [
        g.id,
        g.date,
        g.createdAt,
        ruleSignature(g),
        g.format,
        g.players.map((p) => [p.playerId, p.rank, p.result]).sort(),
      ])
      .sort(),
  ]);
  let cache = replayCache.get(source.games);
  if (!cache || cache.fingerprint !== fingerprint) {
    cache = { fingerprint, groups: new Map() };
    replayCache.set(source.games, cache);
  }
  let archive = cache.groups.get(source.groupId);
  if (!archive) {
    archive = new Map();
    cache.groups.set(source.groupId, archive);
  }
  const previous: CopyUsage[] = [];
  for (const [index, date] of dates.entries()) {
    const cached = archive.get(date);
    if (cached) {
      if (date === source.date) return cached.edition;
      previous.push(cached.usage);
      if (previous.length > NEWS_LOOKBACK_DAYS) previous.shift();
      continue;
    }
    const history = new CopyHistory(
      previous,
      source.players.map((p) => p.name),
    );
    let edition: NewsEdition | null;
    let failed = false;
    try {
      edition = composeNewsEdition({ ...source, date }, index, history);
    } catch (error) {
      if (date === source.date) throw error;
      // 読めない過去日は文案を推測しない。開催日としては10日枠に数える。
      edition = null;
      failed = true;
    }
    const usage = edition ? history.usage(date) : { date, keys: [] };
    if (!failed) archive.set(date, { edition, usage });
    if (date === source.date) return edition;
    previous.push(usage);
    if (previous.length > NEWS_LOOKBACK_DAYS) previous.shift();
  }
  return null;
}

function composeNewsEdition(
  source: NewsSource,
  editionIndex: number,
  history: CopyHistory,
): NewsEdition | null {
  const subjects = collectNewsFacts(source).sort(
    (a, b) =>
      Number(b.facts["player.totalResult"]) -
        Number(a.facts["player.totalResult"]) || a.id.localeCompare(b.id),
  );
  if (!subjects.length) return null;
  const dayGames = source.games.filter((g) => g.date === source.date);
  const desk = createCopyDesk(source.groupId, editionIndex, history);
  const seed = String(
    hash(
      JSON.stringify([
        "daily-news-v2",
        source.groupId,
        source.date,
        dayGames
          .map((g) => [
            g.id,
            g.createdAt,
            ruleSignature(g),
            g.players.map((p) => [p.playerId, p.rank, p.result]).sort(),
          ])
          .sort(),
      ]),
    ),
  );
  const usedTemplates = new Set<string>();
  const distance = (kind: Kind, c: Candidate) => {
    const { index, count } = variants.get(c.template.id)!;
    const offset =
      (hash(source.groupId + c.subject.id + kind + c.template.event) +
        editionIndex) %
      count;
    return (index - offset + count) % count;
  };
  const readerTemplate = (c: Candidate) => c.template.id.startsWith("reader.")
    ? readerVoice(c.template.text!, `${source.groupId}/${source.date}/${c.template.id}`)
    : c.template.text!;
  const copy = (c: Candidate) => ({
    text: c.template.text
      ? fillNewsText(readerTemplate(c), c.subject.facts)
      : undefined,
    question: c.template.question
      ? fillInterviewText(c.template.question, c.subject.facts)
      : undefined,
    answer: c.template.answer
      ? fillInterviewText(c.template.answer, c.subject.facts)
      : undefined,
  });
  const repetition = (c: Candidate) =>
    history.score("catalog/" + c.template.id, copy(c));
  const remember = (c: Candidate) =>
    history.record("catalog/" + c.template.id, copy(c));
  // 最終更新: 2026-09-12 — 見出しの新鮮さより結果の重要度を優先。弱い対戦を隔日で強制採用しない。
  const importance = (kind: Kind, c: Candidate) => {
    if (!["headline", "news", "article"].includes(kind)) return c.template.priority;
    return c.template.topic === "matchup"
      ? matchupImportance(c.subject.facts, subjects, kind as "headline" | "news" | "article")
      : c.template.priority;
  };
  const candidates = (
    kind: Kind,
    subjectId?: string,
    role?: string,
    matchup?: boolean,
  ): Candidate[] =>
    subjects
      .filter((s) => !subjectId || s.id === subjectId)
      .flatMap((subject) =>
        catalogs[kind].templates.flatMap((t) => {
          if (matchup !== undefined && (t.topic === "matchup") !== matchup) return [];
          const contexts = t.topic === "matchup"
            ? (subject.relationships ?? []).map((facts) => ({ ...subject, facts: { ...subject.facts, ...facts } }))
            : [subject];
          return contexts.filter((s) =>
              (!role ||
                (role === "lead" || role === "body"
                  ? t.paragraphRole !== "closing"
                  : t.paragraphRole === role)) &&
              templateEligible(t, s.facts),
          ).map((s) => ({ template: t, subject: s }));
        }),
      )
      // 2026-09-12: 文面の整形と既出判定は候補ごとに一度。ソートの比較中に繰り返さない。
      .map(c => ({ c, importance: importance(kind, c), repeated: repetition(c), order: distance(kind, c), tie: hash(seed + c.subject.id + c.template.event) }))
      .filter(c => c.importance > 0)
      .sort(
        (a, b) =>
          (["headline", "news", "article"].includes(kind) ? b.importance - a.importance : 0) ||
          a.repeated - b.repeated ||
          b.c.template.priority - a.c.template.priority ||
          a.order - b.order || a.tie - b.tie ||
          a.c.template.id.localeCompare(b.c.template.id),
      ).map(({ c }) => c);
  const render = (c: Candidate) =>
    fillNewsText(readerTemplate(c), c.subject.facts);
  const take = (list: Candidate[]) => {
    const c = list.find((c) => !usedTemplates.has(c.template.id));
    if (c) {
      usedTemplates.add(c.template.id);
      remember(c);
    }
    return c;
  };
  const primary = take(candidates("headline"));
  const headline = primary
    ? render(primary)
    : formatDate(source.date) +
      "、" +
      subjects.length +
      "選手が競う一日を振り返る";
  const news: string[] = [];
  const newsEvents = new Set(primary ? [primary.template.event] : []);
  const newsPeople = new Set(primary ? [primary.subject.id] : []);
  // 最終更新: 2026-09-12 — 対戦記事の固定枠を廃止し、その日の成果が大きい話題を選ぶ。
  for (let slot = 0; slot < 4; slot++) {
    const unused = (c: Candidate) => !newsEvents.has(c.template.event) && !newsPeople.has(c.subject.id);
    const c = candidates("news").find(unused);
    if (!c) continue;
    news.push(render(c));
    remember(c);
    newsEvents.add(c.template.event);
    newsPeople.add(c.subject.id);
    usedTemplates.add(c.template.id);
    if (news.length === 4) break;
  }
  // 最低対局数に届かない全勝や複数勝利も、長期的な強さとは区別して当日の成果として報じる。
  for (const s of subjects) {
    if (news.length === 4) break;
    if (newsPeople.has(s.id)) continue;
    const options = playerLineOptions(s).filter(
      (o) => !o.id.startsWith("general"),
    );
    const line = desk("news-extra", s.id, options);
    if (line) {
      news.push(line.text);
      newsPeople.add(s.id);
    }
  }
  if (!news.length)
    news.push(
      subjects.length +
        "選手が" +
        dayGames.length +
        "戦で競った。勝利を手にした選手も、雪辱を期す選手も、次の対局へ向かう。",
    );

  const members = subjects.map((subject, index) => {
    const total = Number(subject.facts["player.totalResult"]),
      games = Number(subject.facts["player.gamesPlayed"]);
    // 補完文案も同じ選択肢に入れ、使い切った特別記事だけを延々と再利用しない。
    const preferMatchup = (index + editionIndex) % 2 === 0;
    const selectMemberPool = (kind: Kind) => {
      const pool = candidates(kind, subject.id, undefined, preferMatchup);
      return pool.length ? pool : candidates(kind, subject.id, undefined, false);
    };
    const summary = desk("summary", subject.id, [
      ...selectMemberPool("summary").map((c) => ({
        id: "catalog/" + c.template.id,
        text: render(c),
        priority: 100 + c.template.priority,
      })),
      ...(preferMatchup && selectMemberPool("summary").some((c) => c.template.topic === "matchup") ? [] : playerLineOptions(subject)).map((o) => ({
        ...o,
        id: "extra/" + o.id,
        priority: o.id.startsWith("general") ? 0 : 10,
      })),
    ]);
    const answer = desk("interview", subject.id, [
      ...selectMemberPool("interview")
        .filter((c) => !negativeTopics.has(c.template.event))
        .map((c) => ({
          id: "catalog/" + c.template.id,
          question: fillInterviewText(c.template.question!, c.subject.facts),
          answer: fillInterviewText(c.template.answer!, c.subject.facts),
          priority: 100 + c.template.priority,
        })),
      ...(preferMatchup && selectMemberPool("interview").some((c) => c.template.topic === "matchup") ? [] : interviewOptions(subject)).map((o) => ({
        ...o,
        id: "extra/" + o.id,
        priority: o.id.startsWith("open") ? 0 : 10,
      })),
    ]);
    return {
      id: subject.id,
      name: subject.name,
      color: subject.color,
      total,
      games,
      summary:
        summary?.text ??
        subject.name + "、" + games + "戦で" + result(total) + "pt。",
      question: answer?.question ?? "次の対局への意気込みを。",
      answer:
        answer?.answer ?? "次は自分らしい見せ場を作れるように頑張ります。",
    };
  });

  // 最終更新: 2026-09-12 — 見出しの人物を導入に置き、特筆する対戦だけ最大2組を取り上げる。
  const paragraphs: string[] = [];
  const reportedPairs = new Set<string>();
  const articleEvents = new Set<string>();
  const articleTemplates = new Set<string>();
  // 最終更新: 2026-09-12 — 昇格と降格を偏らせず最大2人。既存の対戦段落に添えて称号だけの記事にしない。
  const changed = subjects.filter(s => s.titleChange).sort((a, b) =>
    Math.abs(b.titleChange!.steps) - Math.abs(a.titleChange!.steps) || a.id.localeCompare(b.id));
  const highlighted = [changed.find(s => s.titleChange!.direction === "up"), changed.find(s => s.titleChange!.direction === "down")]
    .filter((s): s is NewsSubject => !!s);
  for (const s of changed) {
    if (highlighted.length >= 2) break;
    if (!highlighted.includes(s)) highlighted.push(s);
  }
  const titleNotes = highlighted.flatMap(subject => {
    const copy = desk("title-change", subject.id, titleChangeOptions(subject));
    return copy ? [{ subject, text: copy.text }] : [];
  });
  const noteLength = titleNotes.reduce((sum, note) => sum + note.text.length, 0);
  let titleParagraphUsed = titleNotes.length > 0;
  const pool = candidates("article", undefined, undefined, true);
  const pairKey = (c: Candidate) => [c.subject.id, String(c.subject.facts["opponent.id"])].sort().join("/");
  if (primary?.template.topic === "matchup") {
    // 同じ組・同じ出来事を先頭へ。見出しと本文で主役をすり替えない。
    pool.sort((a, b) => Number(pairKey(b) === pairKey(primary) && b.template.event === primary.template.event)
      - Number(pairKey(a) === pairKey(primary) && a.template.event === primary.template.event));
  } else {
    const focus = primary?.subject ?? subjects[0];
    const other = subjects.find(s => s.id !== focus.id)!;
    const lead = desk("article-day-lead", focus.id, dayLeadOptions(focus, other));
    const event = primary && candidates("news", focus.id, undefined, false).find(c => c.template.event === primary.template.event);
    if (lead) paragraphs.push((event ? render(event) : "") + lead.text);
  }
  // 文量のために小さな勝ち越しを追加しない。重要な対戦がなければ短い日次記事にする。
  for (const allowRepeatedEvent of [false, true]) {
    for (const c of pool) {
      if (reportedPairs.size >= 2) break;
      const mentionsTitle = c.template.requiredFacts.some(f => f.endsWith(".editionTitle"));
      if (mentionsTitle && titleParagraphUsed && !(primary?.template.topic === "matchup" && pairKey(c) === pairKey(primary) && paragraphs.length === 0)) continue;
      if (reportedPairs.has(pairKey(c)) || articleTemplates.has(c.template.id)) continue;
      if (!allowRepeatedEvent && articleEvents.has(c.template.event)) continue;
      const text = render(c);
      if (paragraphs.length && paragraphs.join("").length + text.length + noteLength > 1150) continue;
      paragraphs.push(text);
      remember(c);
      reportedPairs.add(pairKey(c));
      articleEvents.add(c.template.event);
      articleTemplates.add(c.template.id);
      if (mentionsTitle) titleParagraphUsed = true;
      if (paragraphs.join("").length + noteLength >= 850) break;
    }
    if (reportedPairs.size >= 2 || paragraphs.join("").length + noteLength >= 850) break;
  }
  for (const note of titleNotes) {
    const index = paragraphs.findIndex(text => text.includes(`${note.subject.name}選手`));
    if (index >= 0) paragraphs[index] += note.text;
    else paragraphs.push(note.text);
  }
  const commentTexts: string[] = [];
  const commentSources: CommentSource[] = [];
  const commentPairs = new Map<string, number>();
  const addReaderComments = (pool: Candidate[], target = COMMENT_TARGET) => {
    for (const c of pool) {
      if (commentTexts.length >= target) break;
      if (negativeTopics.has(c.template.event)) continue;
      if (commentTexts.includes(render(c))) continue;
      const pair = c.template.topic === "matchup" ? [c.subject.id, String(c.subject.facts["opponent.id"])].sort().join("/") : "";
      if (pair && (commentPairs.get(pair) ?? 0) >= 2) continue;
      const picked = take([c]);
      if (picked) {
        commentTexts.push(render(picked));
        commentSources.push({ id: picked.template.id, text: render(picked), event: picked.template.event, facts: picked.subject.facts });
        if (pair) commentPairs.set(pair, (commentPairs.get(pair) ?? 0) + 1);
      }
    }
  };
  addReaderComments(candidates("reader", undefined, undefined, true), COMMENT_TARGET / 2);
  if (commentTexts.length < COMMENT_TARGET) {
    const allReader = candidates("reader", undefined, undefined, false);
    addReaderComments(allReader);
  }
  const readerExtras = [
    "出場回数も違うから、合計だけで選手を決めつけたくない。",
    "勝った選手には拍手。次は追いかける側の活躍も見たい。",
    "次に同じ顔ぶれで打ったら、また違う結果になるんだろうな。",
    "今日の主役と、次回の主役が同じとは限らない。そこが楽しみ。",
    "悔しかった人の次の勝利も、ちゃんと取り上げてほしい。",
    "結果を知ると、次の対局まで気になってくる。",
  ];
  while (commentTexts.length < COMMENT_TARGET) {
    const c = desk(
      "reader-extra",
      "edition",
      readerExtras.map((text, i) => ({ id: String(i), text })),
    )!;
    if (!c) break;
    commentTexts.push(c.text);
    commentSources.push({ id: `extra/${c.id}`, text: c.text, event: "general", facts: {} });
  }
  const tonpu = dayGames.filter((g) => g.format === "tonpu").length;
  return {
    headline,
    photos: selectNewsPhotos(primary?.template.event ?? "general", source.groupId, source.date, history),
    news,
    paragraphs,
    comments: commentTexts,
    commentThreads: createReaderThreads(commentSources, `${source.groupId}/${source.date}`, editionIndex, history),
    members,
    playerCount: subjects.length,
    gameCount: dayGames.length,
    formatSummary: [
      dayGames.length - tonpu ? "半荘 " + (dayGames.length - tonpu) + "戦" : "",
      tonpu ? "東風 " + tonpu + "戦" : "",
    ]
      .filter(Boolean)
      .join("・"),
    ticker: [...new Set([headline, ...news])],
  };
}
