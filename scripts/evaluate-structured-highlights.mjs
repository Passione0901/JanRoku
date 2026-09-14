import { build } from 'esbuild';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Updated 2026-09-15: This corpus was already used for development; unknown fields are omissions, not invented facts.
const outputDirectory = resolve('dist-worker/structured-highlight-evaluation');
mkdirSync(outputDirectory, { recursive: true });
await build({
  entryPoints: ['src/domain/news/highlightAnalysis.ts', 'src/test/fixtures.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outdir: outputDirectory,
});
const { analyzeHighlight } = await import(pathToFileURL(resolve(outputDirectory, 'domain/news/highlightAnalysis.js')).href);
const { fixture } = await import(pathToFileURL(resolve(outputDirectory, 'test/fixtures.js')).href);
const corpus = JSON.parse(readFileSync('src/test/structured-highlight-corpus.json', 'utf8'));
const players = ['山田', '佐藤', '伊藤', '斎藤'].map((name, i) => ({ id: `sample0${i + 1}`, name, color: '#123456' }));
const names = new Map(players.map(player => [player.id, player.name]));
const ids = new Map(players.map(player => [player.name, player.id]));

function scoresFor(row) {
  if (row.fixtureScores) return row.fixtureScores;
  const order = players.map(player => player.name);
  if (row.finalWinnerName) {
    order.splice(order.indexOf(row.finalWinnerName), 1);
    order.unshift(row.finalWinnerName);
  }
  for (const [name, rank] of Object.entries(row.finalRanks ?? {})) {
    order.splice(order.indexOf(name), 1);
    order.splice(rank - 1, 0, name);
  }
  return players.map(player => [40000, 30000, 20000, 10000][order.indexOf(player.name)]);
}

function semanticEvent(event) {
  return {
    kind: event.kind,
    actorName: names.get(event.actorId) ?? null,
    winnerName: names.get(event.winnerId) ?? null,
    discarderName: names.get(event.discarderId) ?? null,
    targetName: names.get(event.targetId) ?? null,
    method: event.method,
    level: event.level,
    yaku: event.yaku,
    roles: Object.fromEntries(Object.entries(event.roles).map(([id, role]) => [names.get(id) ?? id, role])),
    basicGain: event.basicGain,
    amounts: event.amounts,
    finalRank: event.finalRank,
    state: event.state,
    time: event.time,
  };
}

function differences(event, expected, row) {
  const actual = semanticEvent(event);
  const contradictions = [];
  const missingFields = [];
  const coreFields = expected.kind === 'win' ? ['kind', 'winnerName', 'method'] : ['kind', 'actorName'];
  const missingCoreFields = [];
  for (const key of ['kind', 'actorName', 'winnerName', 'discarderName', 'targetName', 'method', 'level']) {
    if (Object.hasOwn(expected, key) && actual[key] !== expected[key]) {
      const message = `${key}: expected ${JSON.stringify(expected[key])}, got ${JSON.stringify(actual[key])}`;
      const unknown = actual[key] == null || (key === 'method' && actual[key] === 'unspecified');
      if (unknown) {
        missingFields.push(message);
        if (coreFields.includes(key)) missingCoreFields.push(key);
      } else {
        contradictions.push(message);
      }
    }
  }
  if (expected.kind === 'win') {
    for (const [name, role] of Object.entries(row.roles ?? {})) {
      const actualRole = event.roles[ids.get(name)];
      if (actualRole == null) missingFields.push(`role of ${name}: expected ${role}, got unknown`);
      else if (actualRole !== role) contradictions.push(`role of ${name}: expected ${role}, got ${actualRole}`);
    }
    for (const yaku of row.requiredYaku ?? []) {
      if (!event.yaku.includes(yaku)) missingFields.push(`required yaku missing: ${yaku}`);
    }
    if (row.basicGain != null) {
      if (event.basicGain.value == null) missingFields.push(`basicGain: expected confirmed ${row.basicGain}, got unknown`);
      else if (event.basicGain.value !== row.basicGain) contradictions.push(`basicGain: expected ${row.basicGain}, got ${event.basicGain.value}`);
      if (event.basicGain.lowerBound != null && event.basicGain.lowerBound > row.basicGain) contradictions.push(`basicGain lower bound ${event.basicGain.lowerBound} exceeds known gain ${row.basicGain}`);
    }
  }
  if (event.state !== 'asserted') contradictions.push(`accepted event is ${event.state}`);
  return { contradictions, missingFields, coreComplete: contradictions.length === 0 && missingCoreFields.length === 0 };
}

function sourceErrors(analysis) {
  const errors = [];
  const check = (span, context) => {
    if (!Number.isInteger(span.start) || !Number.isInteger(span.end) || span.start < 0 || span.start >= span.end || span.end > analysis.source.length) {
      errors.push(`${context}: invalid UTF-16 span ${span.start}:${span.end}`);
    } else if (analysis.source.slice(span.start, span.end) !== span.text) {
      errors.push(`${context}: evidence text does not match original source`);
    }
  };
  for (const token of analysis.lexing?.tokens ?? []) check(token, 'token');
  for (const event of analysis.events) {
    for (const [field, spans] of Object.entries(event.evidence)) for (const span of spans) check(span, `${event.id}.${field}`);
    for (const amount of event.amounts) for (const span of amount.evidence) check(span, `${event.id}.amount`);
  }
  return errors;
}

const results = corpus.map(row => {
  const game = { ...fixture(`semantic-corpus-${row.number}`, '2026-09-01', scoresFor(row)), highlight: row.text };
  const analysis = analyzeHighlight(game, players);
  const accepted = analysis.events.filter(event => event.decision === 'accepted');
  const spanErrors = sourceErrors(analysis);
  const expectedEvents = [row.expected, ...(row.also ?? [])];
  const comparisons = accepted.map(event => {
    if (row.expected.category !== 'extractable') return { event, comparison: { contradictions: [`expected ${row.expected.category}`], missingFields: [], coreComplete: false } };
    const candidates = expectedEvents.map(expected => differences(event, expected, row));
    // A wrong non-null value always takes precedence over incompleteness in selecting an interpretation.
    candidates.sort((a, b) => a.contradictions.length - b.contradictions.length || Number(b.coreComplete) - Number(a.coreComplete) || a.missingFields.length - b.missingFields.length);
    return { event, comparison: candidates[0] };
  });
  const unexpected = comparisons.filter(({ comparison }) => comparison.contradictions.length).map(({ event, comparison }) => ({ event: semanticEvent(event), closestExpectationErrors: comparison.contradictions }));
  const missingFields = comparisons.filter(({ comparison }) => !comparison.contradictions.length && comparison.missingFields.length).map(({ event, comparison }) => ({ event: semanticEvent(event), fields: comparison.missingFields, coreComplete: comparison.coreComplete }));
  const winGroups = new Map();
  for (const event of accepted.filter(event => event.kind === 'win')) {
    const key = JSON.stringify([event.time.segment, event.actorId, event.winnerId, event.method]);
    const group = winGroups.get(key) ?? [];
    group.push(event);
    winGroups.set(key, group);
  }
  // This known corpus has at most one winning occurrence per note; explicit next-hand cases belong to separate tests.
  const doubleExtraction = [...winGroups.values()].filter(group => group.length > 1).map(group => ({
    scene: group[0].time.segment,
    actorName: names.get(group[0].actorId) ?? null,
    winnerName: names.get(group[0].winnerId) ?? null,
    method: group[0].method,
    count: group.length,
    extraEvents: group.length - 1,
    eventIds: group.map(event => event.id),
  }));
  const hasCompleteCore = comparisons.some(({ comparison }) => comparison.coreComplete);
  const classification = spanErrors.length || unexpected.length
    ? 'incorrect-extraction'
    : hasCompleteCore
      ? 'correct-extraction'
      : row.expected.category === 'extractable'
        ? 'unsupported-extractable'
        : 'intentional-non-adoption';
  return {
    number: row.number,
    text: row.text,
    expected: row.expected,
    expectedAdditionalEvents: row.also ?? [],
    annotation: row.note,
    classification,
    accepted: accepted.map(semanticEvent),
    rejected: analysis.events.filter(event => event.decision !== 'accepted').map(event => ({ ...semanticEvent(event), decision: event.decision, reasons: event.reasons })),
    diagnostics: analysis.diagnostics,
    unexpected,
    missingFields,
    doubleExtraction,
    spanErrors,
  };
});

const classifications = ['correct-extraction', 'intentional-non-adoption', 'unsupported-extractable', 'incorrect-extraction'];
const summary = {
  total: results.length,
  evaluationType: 'known synthetic regression corpus; not independent real-user validation',
  classificationPolicy: 'Correct extraction requires at least one correct kind, subject/winner and method; missing optional details are reported separately. Every accepted event must contain no contradiction.',
  expected: Object.fromEntries(['extractable', 'reject', 'out-of-scope'].map(category => [category, corpus.filter(row => row.expected.category === category).length])),
  counts: Object.fromEntries(classifications.map(category => [category, results.filter(row => row.classification === category).length])),
  cases: Object.fromEntries(classifications.map(category => [category, results.filter(row => row.classification === category).map(row => row.number)])),
  spanErrors: results.reduce((sum, row) => sum + row.spanErrors.length, 0),
  casesWithMissingFields: results.filter(row => row.missingFields.length).map(row => row.number),
  missingFields: results.reduce((sum, row) => sum + row.missingFields.reduce((count, event) => count + event.fields.length, 0), 0),
  doubleExtraction: {
    cases: results.filter(row => row.doubleExtraction.length).map(row => row.number),
    groups: results.reduce((sum, row) => sum + row.doubleExtraction.length, 0),
    extraEvents: results.reduce((sum, row) => sum + row.doubleExtraction.reduce((count, group) => count + group.extraEvents, 0), 0),
  },
};
const reportPath = resolve(outputDirectory, 'report.json');
writeFileSync(reportPath, JSON.stringify({ summary, results }, null, 2) + '\n');
console.log(JSON.stringify({ ...summary, reportPath }, null, 2));
if (summary.counts['incorrect-extraction'] > 0 || summary.doubleExtraction.groups > 0) process.exitCode = 1;
