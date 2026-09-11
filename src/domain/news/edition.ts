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
  comparisonOptions,
  dayHighlightOptions,
  strugglingGroupOptions,
  createCopyDesk,
  playerLineOptions,
  interviewOptions,
  playerParagraphOptions,
} from "./editorial";
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

// 最終更新: 2026-09-12 — 号ごとに文型を巡回し、同じ号では重複を避けて比較記事を組み立てる。
export function createNewsEdition(
  source: NewsSource,
  now = Date.now(),
): NewsEdition | null {
  if (!isNewsAvailable(source.date, now) || !source.realRecords) return null;
  const subjects = collectNewsFacts(source).sort(
    (a, b) =>
      Number(b.facts["player.totalResult"]) -
        Number(a.facts["player.totalResult"]) || a.id.localeCompare(b.id),
  );
  if (!subjects.length) return null;
  const dayGames = source.games.filter((g) => g.date === source.date);
  const editionIndex =
    new Set(
      source.games.filter((g) => g.date <= source.date).map((g) => g.date),
    ).size - 1;
  const desk = createCopyDesk(source.groupId, editionIndex);
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
              (!role ||
                (role === "lead" || role === "body"
                  ? t.paragraphRole !== "closing"
                  : t.paragraphRole === role)) &&
              templateEligible(t, subject.facts),
          )
          .map((template) => ({ template, subject })),
      )
      .sort(
        (a, b) =>
          b.template.priority - a.template.priority ||
          distance(kind, a) - distance(kind, b) ||
          hash(seed + a.subject.id + a.template.event) -
            hash(seed + b.subject.id + b.template.event) ||
          a.template.id.localeCompare(b.template.id),
      );
  const render = (c: Candidate) =>
    fillNewsText(c.template.text!, c.subject.facts);
  const take = (list: Candidate[]) => {
    const c = list.find((c) => !usedTemplates.has(c.template.id));
    if (c) usedTemplates.add(c.template.id);
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
  for (const c of candidates("news")) {
    if (newsEvents.has(c.template.event) || newsPeople.has(c.subject.id))
      continue;
    news.push(render(c));
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

  const members = subjects.map((subject) => {
    const total = Number(subject.facts["player.totalResult"]),
      games = Number(subject.facts["player.gamesPlayed"]);
    const summary = take(candidates("summary", subject.id));
    const interview = take(
      candidates("interview", subject.id).filter(
        (c) => !negativeTopics.has(c.template.event),
      ),
    );
    const lineOptions = playerLineOptions(subject);
    const line = summary
      ? undefined
      : (desk(
          "summary",
          subject.id,
          lineOptions.filter((o) => !o.id.startsWith("general")),
        ) ?? desk("summary", subject.id, lineOptions));
    const answers = interviewOptions(subject);
    const answer = interview
      ? undefined
      : (desk(
          "interview",
          subject.id,
          answers.filter((o) => !o.id.startsWith("open")),
        ) ?? desk("interview", subject.id, answers));
    return {
      id: subject.id,
      name: subject.name,
      color: subject.color,
      total,
      games,
      summary: summary
        ? render(summary)
        : (line?.text ??
          subject.name + "、" + games + "戦で" + result(total) + "pt。"),
      question: interview
        ? fillNewsText(interview.template.question!, subject.facts)
        : (answer?.question ?? "次の対局への意気込みを。"),
      answer: interview
        ? fillNewsText(interview.template.answer!, subject.facts)
        : (answer?.answer ?? "次は自分らしい見せ場を作れるように頑張ります。"),
    };
  });

  const paragraphs: string[] = [];
  const articleEvents = new Set<string>();
  const articlePeople = new Set<string>();
  const selectedArticle: Candidate[] = [];
  const add = (c: Candidate) => {
    paragraphs.push(render(c));
    articleEvents.add(c.template.event);
    articlePeople.add(c.subject.id);
    selectedArticle.push(c);
    usedTemplates.add(c.template.id);
  };
  const lead = take(candidates("article", primary?.subject.id, "lead"));
  if (lead) add(lead);
  else
    paragraphs.push(
      formatDate(source.date) +
        "、" +
        subjects.length +
        "選手が計" +
        dayGames.length +
        "戦で競った。一日の収支とそれぞれの勝利に焦点を当て、今回の勝負を振り返る。",
    );

  // 同じ号の類似成績を比較としてまとめ、記事の入口も開催日ごとに変える。
  if (subjects.length >= 2) {
    paragraphs.push(
      desk(
        "comparison",
        "edition",
        comparisonOptions(subjects[0], subjects[1]),
      )!.text,
    );
    articlePeople.add(subjects[0].id);
    articlePeople.add(subjects[1].id);
  }
  const struggling = subjects.filter(
    (s) => Number(s.facts["player.totalResult"]) <= -50,
  );
  if (struggling.length >= 2) {
    paragraphs.push(
      desk("struggling", "edition", strugglingGroupOptions(struggling))!.text,
    );
    struggling.forEach((s) => articlePeople.add(s.id));
    articleEvents.add("tough-day");
  }
  for (const role of ["body"]) {
    for (const c of candidates("article", undefined, role)) {
      if (
        articleEvents.has(c.template.event) ||
        articlePeople.has(c.subject.id)
      )
        continue;
      if (paragraphs.join("").length + render(c).length > 1000) continue;
      add(c);
      if (paragraphs.join("").length >= 800) break;
    }
    if (paragraphs.join("").length >= 800) break;
  }
  if (dayGames.length > 1)
    for (const s of subjects) {
      if (paragraphs.join("").length >= 820) break;
      if (articlePeople.has(s.id)) continue;
      const p = desk("article-extra", s.id, playerParagraphOptions(s));
      if (p && paragraphs.join("").length + p.text.length <= 1050) {
        paragraphs.push(p.text);
        articlePeople.add(s.id);
      }
    }
  for (const options of dayHighlightOptions(subjects, dayGames)) {
    if (paragraphs.join("").length >= 820) break;
    const highlight = desk("day-highlight", "edition", options);
    if (highlight && paragraphs.join("").length + highlight.text.length <= 1050)
      paragraphs.push(highlight.text);
  }
  // 材料が少ない日は短くまとめる。選手紹介を言い換えて文字数だけを埋めない。
  const endings = [
    "勝利を重ねた選手も、悔しさを残した選手も、次はまた新しい勝負に臨む。今回の結果が、次の対戦を楽しみにする理由になる。",
    "この日の主役が次も勝つとは限らない。追う側にも追われる側にも、また見せ場は訪れる。次の対局での新しい話題を待ちたい。",
    "一日の成績には、それぞれ違った見どころがあった。次に同じ卓を囲んだとき、今度は誰が主役になるのか。楽しみは続いていく。",
    "今回の成果はたたえ、悔しい結果には次の機会を。一日だけで物語を閉じず、選手たちの次の戦いに目を向けたい。",
    "大きな勝利も小さな前進も、次の勝負への足場になる。雪辱を目指す選手の巻き返しと、新しい活躍に期待がかかる。",
    "勝負を重ねれば、選手たちの関係も成績もまた変わる。今回の結果を胸に臨む次の対局で、どんな一日が生まれるか注目したい。",
  ];
  const end = desk(
    "closing",
    "edition",
    endings.map((text, i) => ({ id: String(i), text })),
  )!;
  paragraphs.push(end.text);
  const commentTexts: string[] = [];
  for (const item of selectedArticle) {
    if (negativeTopics.has(item.template.event)) continue;
    const c = take(
      candidates("reader", item.subject.id).filter(
        (c) => c.template.event === item.template.event,
      ),
    );
    if (c) commentTexts.push(render(c));
    if (commentTexts.length === 4) break;
  }
  const readerExtras = [
    "出場回数も違うから、合計だけで選手を決めつけたくない。",
    "勝った選手には拍手。次は追いかける側の活躍も見たい。",
    "次に同じ顔ぶれで打ったら、また違う結果になるんだろうな。",
    "今日の主役と、次回の主役が同じとは限らない。そこが楽しみ。",
    "悔しかった人の次の勝利も、ちゃんと取り上げてほしい。",
    "結果を知ると、次の対局まで気になってくる。",
  ];
  if (commentTexts.length < 3) {
    const c = desk(
      "reader-extra",
      "edition",
      readerExtras.map((text, i) => ({ id: String(i), text })),
    )!;
    commentTexts.push(c.text);
  }
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
      dayGames.length - tonpu ? "半荘 " + (dayGames.length - tonpu) + "戦" : "",
      tonpu ? "東風 " + tonpu + "戦" : "",
    ]
      .filter(Boolean)
      .join("・"),
    ticker: [...new Set([headline, ...news])],
  };
}
