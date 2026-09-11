import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// 最終更新: 2026-09-12 — 文案の件数・参照・採用条件を検査する。実記録の集計処理ではない。
const folder = fileURLToPath(
  new URL("../src/content/daily-news/", import.meta.url),
);
const read = (name) =>
  JSON.parse(fs.readFileSync(path.join(folder, name), "utf8"));
const { facts: contract } = read("fact-contract.json");
const schema = read("template.schema.json");
const specs = [
  ["headlines.json", "headline", 30, "headline", false],
  ["daily-news.json", "news", 30, "news-item", false],
  ["member-summaries.json", "summary", 100, "one-liner", false],
  ["fictional-interviews.json", "interview", 100, "question-answer", true],
  ["article-paragraphs.json", "article", 100, "paragraph", false],
  ["fictional-reader-comments.json", "reader", 100, "comment", true],
];
const ops = {
  eq: (a, b) => a === b,
  ne: (a, b) => a !== b,
  gt: (a, b) => a > b,
  gte: (a, b) => a >= b,
  lt: (a, b) => a < b,
  lte: (a, b) => a <= b,
};
const placeholders = (text) =>
  [...text.matchAll(/\{([a-zA-Z][\w.]*)\}/g)].map((m) => m[1]);
const sorted = (values) => [...new Set(values)].sort();
const typeMatches = (value, rule) => {
  if (value === undefined || value === null) return false;
  if (rule.type === "integer" && !Number.isInteger(value)) return false;
  if (rule.type !== "integer" && typeof value !== rule.type) return false;
  if (
    typeof value === "number" &&
    (!Number.isFinite(value) ||
      Math.abs(value * 10 - Math.round(value * 10)) > 1e-8)
  )
    return false;
  if (typeof value === "string" && !value.trim()) return false;
  if (rule.enum && !rule.enum.includes(value)) return false;
  if (rule.minimum !== undefined && value < rule.minimum) return false;
  if (rule.maximum !== undefined && value > rule.maximum) return false;
  if (
    rule.format === "date" &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      !Number.isFinite(Date.parse(value)) ||
      new Date(value).toISOString().slice(0, 10) !== value)
  )
    return false;
  return true;
};
// カタログの条件を確認する参照判定。欠損・型違い・未知演算子は必ず不採用。
function eligible(template, facts) {
  if (
    !template.requiredFacts.every(
      (f) => contract[f] && typeMatches(facts[f], contract[f]),
    )
  )
    return false;
  return template.conditions.all.every((rule) => {
    if (!Object.hasOwn(ops, rule.op)) return false;
    const left = facts[rule.fact];
    const right = rule.valueFact ? facts[rule.valueFact] : rule.value;
    return (
      typeof left === typeof right &&
      (["eq", "ne"].includes(rule.op) || typeof left === "number") &&
      ops[rule.op](left, right)
    );
  });
}

const baseFacts = {
  "context.dataScope": "unlocked-records",
  "context.factsValidated": true,
  "context.sameGroup": true,
  "context.orderVerified": true,
  "context.comparableHistoryComplete": true,
  "day.date": "2026-09-12",
  "day.playerCount": 4,
  "day.leadGap": 12,
  "player.id": "test-player",
  "player.name": "試験メンバー",
  "player.gamesPlayed": 4,
  "player.totalResult": 82,
  "player.topCount": 3,
  "player.secondCount": 0,
  "player.lastCount": 1,
  "player.topTwoCount": 3,
  "player.isSoleDailyLeader": true,
  "player.minCumulative": -30,
  "player.recovery": 112,
  "player.beforeLatestResult": -1,
  "player.latestResult": 83,
  "player.latestRank": 1,
  "player.onlyRank": 2,
  "player.maxTopStreak": 3,
  "player.maxTopTwoStreak": 3,
  "player.previousComparableDays": 3,
  "player.previousBestDaily": 60,
};
const witnesses = {
  "daily-leader": {},
  "narrow-leader": { "day.leadGap": 2 },
  "hundred-plus": { "player.totalResult": 150 },
  "three-tops": {},
  "all-tops": {
    "player.topCount": 4,
    "player.topTwoCount": 4,
    "player.lastCount": 0,
  },
  "no-last": { "player.lastCount": 0 },
  "all-top-two": {
    "player.topTwoCount": 4,
    "player.secondCount": 1,
    "player.lastCount": 0,
  },
  "second-specialist": { "player.topCount": 0, "player.secondCount": 3 },
  "back-to-positive": {},
  "latest-turns-positive": {},
  "latest-top": {},
  "consecutive-tops": {},
  "consecutive-top-two": {},
  "personal-daily-best": {},
  "small-positive": { "player.totalResult": 0.1 },
  "small-negative": { "player.totalResult": -0.1 },
  "recovery-still-negative": {
    "player.totalResult": -10,
    "player.recovery": 20,
  },
  "one-game": {
    "player.gamesPlayed": 1,
    "player.topCount": 0,
    "player.secondCount": 1,
    "player.lastCount": 0,
    "player.topTwoCount": 1,
  },
  "zero-day": { "player.totalResult": 0 },
  "tough-day": { "player.totalResult": -50 },
};
const all = [];
const ids = new Set();
const voices = new Set(schema.properties.voice.enum);
let missingFactChecks = 0;
for (const [file, kind, count, unit, fictional] of specs) {
  const catalog = read(file);
  assert.equal(catalog.$schema, "./template.schema.json");
  assert.equal(catalog.schemaVersion, 1);
  assert.equal(catalog.kind, kind);
  assert.equal(catalog.unit, unit);
  assert.equal(catalog.fictional, fictional);
  assert(voices.has(catalog.voice));
  if (fictional) assert(catalog.displayLabel.includes("架空"));
  assert.equal(catalog.templates.length, count, file);
  const texts = new Set();
  const roles = new Map();
  for (const t of catalog.templates) {
    assert(!ids.has(t.id), `Duplicate id: ${t.id}`);
    ids.add(t.id);
    assert(t.id.startsWith(kind + "." + t.event + "."), t.id);
    assert(schema.$defs.template.properties.event.enum.includes(t.event), t.id);
    assert(schema.$defs.template.properties.topic.enum.includes(t.topic), t.id);
    assert(
      Number.isInteger(t.priority) && t.priority >= 0 && t.priority <= 100,
      t.id,
    );
    if (kind === "article") {
      assert(
        ["lead", "feature", "detail", "spotlight", "closing"].includes(
          t.paragraphRole,
        ),
        t.id,
      );
      roles.set(t.paragraphRole, (roles.get(t.paragraphRole) ?? 0) + 1);
    } else assert.equal(t.paragraphRole, undefined, t.id);
    const fields = kind === "interview" ? [t.question, t.answer] : [t.text];
    if (kind === "interview") assert.equal(t.text, undefined);
    else {
      assert.equal(t.question, undefined);
      assert.equal(t.answer, undefined);
    }
    assert(
      fields.every((s) => typeof s === "string" && s.trim().length > 0),
      t.id,
    );
    const text = fields.join("\n");
    assert(!texts.has(text.normalize("NFKC")), `Duplicate text: ${t.id}`);
    texts.add(text.normalize("NFKC"));
    const holes = sorted(placeholders(text));
    assert.deepEqual(t.placeholders, holes, t.id);
    assert(!/[{}]/.test(text.replace(/\{([a-zA-Z][\w.]*)\}/g, "")), t.id);
    assert(t.conditions.all.length >= 6, t.id);
    for (const r of t.conditions.all) {
      assert(contract[r.fact], `Unknown fact ${r.fact}`);
      assert(Object.hasOwn(ops, r.op), t.id);
      assert.notEqual(
        Object.hasOwn(r, "value"),
        Object.hasOwn(r, "valueFact"),
        t.id,
      );
      const leftType = contract[r.fact].type.replace("integer", "number");
      const rightType = r.valueFact
        ? contract[r.valueFact]?.type.replace("integer", "number")
        : typeof r.value;
      assert.equal(leftType, rightType, t.id);
      if (!["eq", "ne"].includes(r.op)) assert.equal(leftType, "number", t.id);
    }
    assert.deepEqual(
      t.requiredFacts,
      sorted([
        "day.date",
        "player.id",
        "player.name",
        ...holes,
        ...t.conditions.all.flatMap((r) => [
          r.fact,
          ...(r.valueFact ? [r.valueFact] : []),
        ]),
      ]),
      t.id,
    );
    assert(witnesses[t.event], t.id);
    // These are predicate fixtures, not fabricated Game records or tests of a future aggregator.
    const facts = { ...baseFacts, ...witnesses[t.event] };
    assert(eligible(t, facts), `No accepting witness: ${t.id}`);
    for (const f of t.requiredFacts) {
      const missing = { ...facts };
      delete missing[f];
      assert(!eligible(t, missing), `Missing fact accepted: ${t.id} ${f}`);
      assert(
        !eligible(t, { ...facts, [f]: null }),
        `Null accepted: ${t.id} ${f}`,
      );
      missingFactChecks++;
    }
    for (const invalid of [
      { "context.dataScope": "fake-preview" },
      { "context.factsValidated": false },
      { "context.sameGroup": false },
      { "player.gamesPlayed": 0 },
      { "day.date": "2026-02-30" },
      { "player.name": "" },
    ])
      assert(
        !eligible(t, { ...facts, ...invalid }),
        `Unsafe scope accepted: ${t.id}`,
      );
    for (const field of holes) assert(Object.hasOwn(facts, field), t.id);
    const rendered = text.replace(/\{([a-zA-Z][\w.]*)\}/g, (_, f) =>
      String(facts[f]),
    );
    assert(!/[{}]/.test(rendered), t.id);
    all.push(t);
  }
  if (kind === "article") {
    assert.equal(roles.size, 5);
    for (const count of roles.values()) assert.equal(count, 20);
  }
  console.log(`${file}: ${count}, unique content and placeholders OK`);
}
assert.equal(all.length, 460);
const rejects = {
  "daily-leader": [{ "player.isSoleDailyLeader": false }],
  "narrow-leader": [
    { "day.leadGap": 0 },
    { "day.leadGap": 5.1 },
    { "player.isSoleDailyLeader": false },
  ],
  "hundred-plus": [
    { "player.totalResult": 99.9 },
    { "player.totalResult": 1000 },
  ],
  "three-tops": [{ "player.topCount": 2 }],
  "all-tops": [
    { "player.topCount": 3 },
    { "player.gamesPlayed": 1, "player.topCount": 1 },
  ],
  "no-last": [{ "player.lastCount": 1 }, { "player.gamesPlayed": 3 }],
  "all-top-two": [
    { "player.topTwoCount": 3 },
    { "player.gamesPlayed": 2, "player.topTwoCount": 2 },
  ],
  "second-specialist": [{ "player.secondCount": 2 }, { "player.topCount": 1 }],
  "back-to-positive": [
    { "player.totalResult": 0 },
    { "player.minCumulative": -29.9 },
  ],
  "latest-turns-positive": [
    { "player.beforeLatestResult": 0.1 },
    { "player.totalResult": 0 },
  ],
  "latest-top": [{ "player.latestRank": 2 }],
  "consecutive-tops": [{ "player.maxTopStreak": 1 }],
  "consecutive-top-two": [{ "player.maxTopTwoStreak": 2 }],
  "personal-daily-best": [
    { "player.totalResult": 60 },
    { "player.previousComparableDays": 2 },
    { "context.comparableHistoryComplete": false },
  ],
  "small-positive": [
    { "player.totalResult": 0 },
    { "player.totalResult": 5.1 },
  ],
  "small-negative": [
    { "player.totalResult": 0 },
    { "player.totalResult": -5.1 },
  ],
  "recovery-still-negative": [
    { "player.totalResult": 0 },
    { "player.recovery": 19.9 },
  ],
  "one-game": [{ "player.gamesPlayed": 2 }],
  "zero-day": [{ "player.totalResult": -0.1 }, { "player.totalResult": 0.1 }],
  "tough-day": [{ "player.totalResult": -49.9 }],
};
let boundaryChecks = 0;
for (const t of all) {
  const facts = { ...baseFacts, ...witnesses[t.event] };
  for (const bad of rejects[t.event]) {
    assert(!eligible(t, { ...facts, ...bad }), `Wrong event selected: ${t.id}`);
    boundaryChecks++;
  }
  if (t.requiredFacts.includes("context.orderVerified")) {
    assert(!eligible(t, { ...facts, "context.orderVerified": false }), t.id);
    boundaryChecks++;
  }
}
console.log(
  `PASS: 460 templates; ${missingFactChecks} missing/null field cases; ${boundaryChecks} event/order rejection cases.`,
);
console.log(
  "Scope: static catalogs and reference predicates only; no app integration or real-record aggregation tested.",
);
