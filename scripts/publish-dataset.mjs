import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const ACTIVE = 'history:dataset:active';
const LOG = 'history:quiz:v1';
const TRANSITION = `local active = redis.call('GET', KEYS[1]);
if active == ARGV[2] then
  local current = redis.call('GET', KEYS[2]);
  if not current or (ARGV[3] ~= '' and current ~= ARGV[3]) then return -3 end
  return 0
end
if active ~= ARGV[1] then return -1 end
local bundle = redis.call('GET', KEYS[2]);
if not bundle or (ARGV[3] ~= '' and bundle ~= ARGV[3]) then return -2 end
redis.call('SET', KEYS[1], ARGV[2]);
return 1`;

export function validateBundle(bundle) {
  const units = bundle?.data?.units;
  if (![2, 3, 4, 5, 6].includes(bundle?.version) || !Array.isArray(units) || !units.length || !Array.isArray(bundle.questions)) throw new Error('invalid dataset bundle');
  const byId = new Map(units.map(unit => [unit.id, unit]));
  if (byId.size !== units.length || units.some(unit => !unit.lines?.length || unit.lines.map(line => line.text).join('\n') !== unit.answer)) throw new Error('invalid source cards');
  for (const question of bundle.questions) {
    if (!question.q || !question.a || !Array.isArray(question.refs) || !question.refs.length || question.refs.length > 6 || question.refs.some(id => !byId.has(id))) throw new Error('invalid question reference');
    if (bundle.version >= 4 && (!Array.isArray(question.facts) || !question.facts.length || !Array.isArray(question.covers) || !question.covers.length || question.covers.some(c => !question.refs.includes(c.id) || !byId.get(c.id)?.lines[c.line]))) throw new Error('invalid question evidence');
  }
  return { version: bundle.version, cards: units.length, questions: bundle.questions.length };
}

export function eventSummary(events) {
  const attempts = events.filter(event => event.type === 'attempt');
  const grades = events.filter(event => event.type === 'grade');
  const counts = new Map();
  for (const attempt of attempts) counts.set(attempt.id, (counts.get(attempt.id) || 0) + 1);
  const ids = new Set(attempts.map(attempt => attempt.id));
  const graded = new Set(grades.map(grade => grade.attemptId));
  return {
    events: events.length,
    attempts: attempts.length,
    uniqueAttempts: ids.size,
    pending: attempts.filter(attempt => !graded.has(attempt.id)).length,
    duplicateAttempts: [...counts.values()].filter(count => count > 1).length,
    danglingGrades: grades.filter(grade => !ids.has(grade.attemptId)).length,
  };
}

export async function transitionDataset(redis, { from, to, bundle }) {
  const serialized = bundle ? JSON.stringify(bundle) : '';
  const bundleKey = `history:dataset:v${to}`;
  if (bundle) {
    if (bundle.version !== to) throw new Error('dataset version mismatch');
    const result = await redis('SET', bundleKey, serialized, 'NX');
    if (result !== 'OK') {
      const existing = await redis('GET', bundleKey);
      if (existing !== serialized) throw new Error('immutable dataset version conflict');
    }
  }
  const result = Number(await redis('EVAL', TRANSITION, 2, ACTIVE, bundleKey, String(from), String(to), serialized));
  if (result < 0) throw new Error('dataset active version changed or bundle missing');
  return result === 0 ? 'unchanged' : 'activated';
}

async function redis(...command) {
  const response = await fetch(process.env.KV_REST_API_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
  });
  const body = await response.json();
  if (!response.ok || body.error) throw new Error('Redis operation failed');
  return body.result;
}

async function main() {
  const [action, arg1, arg2] = process.argv.slice(2);
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) throw new Error('Redis environment unavailable');
  let from, to, bundle;
  if (action === 'publish' && arg1 && arg2) {
    bundle = JSON.parse(fs.readFileSync(arg1, 'utf8'));
    ({ version: to } = validateBundle(bundle));
    from = Number(arg2);
  } else if (action === 'rollback' && arg1 && arg2) {
    from = Number(arg1);
    to = Number(arg2);
  } else {
    throw new Error('usage: publish-dataset.mjs publish <bundle.json> <active-version> | rollback <active-version> <target-version>');
  }
  if (![from, to].every(Number.isInteger) || from === to) throw new Error('invalid version transition');
  const activeBefore = await redis('GET', ACTIVE);
  const rawEventsBefore = await redis('LRANGE', LOG, 0, -1) || [];
  const eventsBefore = rawEventsBefore.map(value => JSON.parse(value));
  const summaryBefore = eventSummary(eventsBefore);
  if (summaryBefore.duplicateAttempts || summaryBefore.danglingGrades) throw new Error('existing quiz log failed integrity checks');
  if (Number(activeBefore) !== from && Number(activeBefore) !== to) throw new Error('unexpected active version');
  if (!bundle && !(await redis('GET', `history:dataset:v${to}`))) throw new Error('rollback bundle is missing');
  const outcome = await transitionDataset(redis, { from, to, bundle });
  if (Number(await redis('GET', ACTIVE)) !== to) throw new Error('active version verification failed');
  const stored = await redis('GET', `history:dataset:v${to}`);
  if (!stored || (bundle && stored !== JSON.stringify(bundle))) throw new Error('stored bundle verification failed');
  const rawEventsAfter = await redis('LRANGE', LOG, 0, -1) || [];
  if (rawEventsBefore.some((value, index) => rawEventsAfter[index] !== value)) throw new Error('quiz log changed during dataset transition');
  const summaryAfter = eventSummary(rawEventsAfter.map(value => JSON.parse(value)));
  if (summaryAfter.duplicateAttempts || summaryAfter.danglingGrades || summaryAfter.uniqueAttempts < summaryBefore.uniqueAttempts) throw new Error('quiz log post-check failed');
  console.log(JSON.stringify({ outcome, activeVersion: to, bundleVersion: to, ...(bundle ? validateBundle(bundle) : {}), eventsBefore: summaryBefore, eventsAfter: summaryAfter }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
