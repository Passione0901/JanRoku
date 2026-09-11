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
import { isNewsAvailable } from "./availability";
import { result } from "../../utils/format";
import { formatDate, isValidDate } from "../../utils/date";

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
export interface NewsEdition {
  headline: string;
  news: string[];
  paragraphs: string[];
  comments: string[];
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
function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++)
    h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}
function key(c: Candidate): string {
  return `${c.subject.id}/${c.template.topic}`;
}

// 最終更新: 2026-09-12 — 同じ会・対象記録なら同じ文案を選び、生成した実名入り文章を外へ保存しない。
export function createNewsEdition(
  source: NewsSource,
  now = Date.now(),
): NewsEdition | null {
  if (!isNewsAvailable(source.date, now) || !source.realRecords) return null;
  const subjects = collectNewsFacts(source);
  if (!subjects.length) return null;
  const dayGames = source.games.filter((g) => g.date === source.date);
  const seed = String(
    hash(
      JSON.stringify([
        "daily-news-v1",
        source.groupId,
        source.date,
        source.games
          .filter((g) => g.date <= source.date)
          .map((g) => [
            g.id,
            g.date,
            g.createdAt,
            ruleSignature(g),
            g.players.map((p) => [p.playerId, p.rank, p.result]).sort(),
          ])
          .sort(),
        subjects.map((p) => [p.id, p.name]).sort(),
      ]),
    ),
  );
  const candidates = (
    kind: Kind,
    subjectId?: string,
    role?: string,
  ): Candidate[] =>
    subjects
      .filter((s) => !subjectId || s.id === subjectId)
      .flatMap((subject) =>
        catalogs[kind].templates
          .filter(
            (t) =>
              (!role || t.paragraphRole === role) &&
              templateEligible(t, subject.facts),
          )
          .map((template) => ({ template, subject })),
      )
      .sort(
        (a, b) =>
          b.template.priority - a.template.priority ||
          hash(seed + a.subject.id + a.template.id) -
            hash(seed + b.subject.id + b.template.id) ||
          a.template.id.localeCompare(b.template.id),
      );
  const render = (c: Candidate) =>
    fillNewsText(c.template.text!, c.subject.facts);
  const primary = candidates("headline")[0];
  const headline = primary
    ? render(primary)
    : `${formatDate(source.date)}の対局を振り返る。${subjects.length}人・${dayGames.length}戦の記録`;
  const news: string[] = [];
  const usedNews = new Set(primary ? [key(primary)] : []);
  const newsPeople = new Set<string>();
  for (const candidate of candidates("news")) {
    if (usedNews.has(key(candidate)) || newsPeople.has(candidate.subject.id))
      continue;
    news.push(render(candidate));
    usedNews.add(key(candidate));
    newsPeople.add(candidate.subject.id);
    if (news.length === 4) break;
  }
  if (!news.length)
    news.push(
      `${subjects.length}人が参加し、${dayGames.length}戦が記録されています。各メンバーの結果は下の総評で振り返れます。`,
    );
  const members = subjects
    .map((subject) => {
      const total = Number(subject.facts["player.totalResult"]),
        games = Number(subject.facts["player.gamesPlayed"]);
      const summary = candidates("summary", subject.id)[0];
      // マイナスについての冗談を同じ人の総評・インタビューで重ねない。
      const interview = candidates("interview", subject.id).find(
        (c) => !negativeTopics.has(c.template.event),
      );
      return {
        id: subject.id,
        name: subject.name,
        color: subject.color,
        total,
        games,
        summary: summary
          ? render(summary)
          : `${subject.name}は${games}戦で${result(total)}pt。トップは${subject.facts["player.topCount"]}回。数字を並べれば、この日の見どころがある。`,
        question: interview
          ? fillNewsText(interview.template.question!, subject.facts)
          : "この日の記録を一言で表すなら？",
        answer: interview
          ? fillNewsText(interview.template.answer!, subject.facts)
          : `対局は${games}戦、合計は${result(total)}pt。収支欄は一行でも、記録はちゃんと残っています。`,
      };
    })
    .sort((a, b) => b.total - a.total || (a.id < b.id ? -1 : 1));
  const paragraphs: string[] = [];
  const usedArticle = new Set<string>();
  const articlePeople = new Map<string, number>();
  const selectedArticle: Candidate[] = [];
  const add = (c: Candidate) => {
    paragraphs.push(render(c));
    usedArticle.add(key(c));
    selectedArticle.push(c);
    articlePeople.set(c.subject.id, (articlePeople.get(c.subject.id) ?? 0) + 1);
  };
  const lead = candidates("article", primary?.subject.id, "lead")[0];
  if (lead) add(lead);
  else
    paragraphs.push(
      `${formatDate(source.date)}には${subjects.length}人が参加し、${dayGames.length}戦を記録した。ここでは保存された順位と収支から、一日の結果を振り返る。`,
    );
  // 主役一人の言い換えで文字数を埋めず、異なる人・話題を優先する。
  for (const role of ["feature", "spotlight", "detail"]) {
    for (const candidate of candidates("article", undefined, role).sort(
      (a, b) =>
        (articlePeople.get(a.subject.id) ?? 0) -
        (articlePeople.get(b.subject.id) ?? 0),
    )) {
      if (
        usedArticle.has(key(candidate)) ||
        (articlePeople.get(candidate.subject.id) ?? 0) >= 2
      )
        continue;
      if (paragraphs.join("").length + render(candidate).length > 1000)
        continue;
      add(candidate);
      if (paragraphs.join("").length >= 820) break;
    }
    if (paragraphs.join("").length >= 820) break;
  }
  // 特別な記録のない参加者も、保存済みの順位内訳で紹介する。架空の展開で尺を埋めない。
  if (dayGames.length > 1) {
    for (const member of members) {
      if (paragraphs.join("").length >= 820) break;
      if (articlePeople.has(member.id)) continue;
      const f = subjects.find((s) => s.id === member.id)!.facts;
      const top = Number(f["player.topCount"]),
        second = Number(f["player.secondCount"]),
        last = Number(f["player.lastCount"]);
      const third = member.games - top - second - last;
      const average = (
        (top + second * 2 + third * 3 + last * 4) /
        member.games
      ).toFixed(2);
      paragraphs.push(
        `${member.name}は${member.games}戦に参加し、日次収支は${result(member.total)}ptだった。順位の内訳は1位${top}回、2位${second}回、3位${third}回、4位${last}回。平均順位は${average}位となる。合計欄と順位の内訳を合わせて、この日の結果を見返しておきたい。`,
      );
      articlePeople.set(member.id, 1);
    }
  }
  const closing = candidates("article", undefined, "closing").find(
    (c) =>
      !usedArticle.has(key(c)) && (articlePeople.get(c.subject.id) ?? 0) < 2,
  );
  if (closing && paragraphs.join("").length + render(closing).length <= 1150)
    add(closing);
  else
    paragraphs.push(
      `この日は${subjects.length}人で${dayGames.length}戦。合計収支だけでなく、各対局の順位も並べて読むと、一人ひとりの結果が見えてくる。日別の記録から、いつでもこの一日を振り返れる。`,
    );
  const commentTexts: string[] = [];
  const commentPeople = new Set<string>();
  for (const item of selectedArticle) {
    if (
      commentPeople.has(item.subject.id) ||
      negativeTopics.has(item.template.event)
    )
      continue;
    const c = candidates("reader", item.subject.id).find(
      (c) => c.template.event === item.template.event,
    );
    if (c) {
      commentTexts.push(render(c));
      commentPeople.add(item.subject.id);
    }
    if (commentTexts.length === 4) break;
  }
  if (!commentTexts.length)
    commentTexts.push(
      "合計の一行だけでなく、対局数や順位も一緒に読めるのがいいですね。",
    );
  const tonpu = dayGames.filter((g) => g.format === "tonpu").length;
  return {
    headline,
    news,
    paragraphs,
    comments: commentTexts,
    members,
    playerCount: subjects.length,
    gameCount: dayGames.length,
    formatSummary: [
      dayGames.length - tonpu ? `半荘 ${dayGames.length - tonpu}戦` : "",
      tonpu ? `東風 ${tonpu}戦` : "",
    ]
      .filter(Boolean)
      .join("・"),
    ticker: [...new Set([headline, ...news])],
  };
}
