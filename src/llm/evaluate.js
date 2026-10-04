import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { promptVersion } from './model.js';

if (process.env.LLM_STUB === '1') {
  throw new Error('Evaluation requires real model calls; unset LLM_STUB first.');
}
if (process.env.LLM_ENABLED?.toLowerCase() === 'false') {
  throw new Error('Evaluation is disabled because LLM_ENABLED=false.');
}

const cases = JSON.parse(await readFile(new URL('../../evals/cases.json', import.meta.url), 'utf8'));
const endpoint = process.env.LLM_EVAL_URL ?? `http://localhost:${process.env.PORT || 3000}/enrich`;
const results = [];

for (const [index, evaluationCase] of cases.entries()) {
  if (index > 0) await delay(1000);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(evaluationCase.input),
      signal: AbortSignal.timeout(60_000),
    });

    const body = await response.json();
    const matched = response.status === 200 && body.category === evaluationCase.expected.category;
    results.push({ id: evaluationCase.id, matched, actual: body.category ?? null, status: response.status });
    console.log(`${matched ? 'PASS' : 'FAIL'} ${evaluationCase.id}: expected=${evaluationCase.expected.category} actual=${body.category ?? 'none'} status=${response.status}`);
  } catch (error) {
    results.push({ id: evaluationCase.id, matched: false, actual: null, error: error.message });
    console.log(`FAIL ${evaluationCase.id}: request_error=${error.message}`);
  }
}

const matched = results.filter((result) => result.matched).length;
const percentage = Math.round((matched / cases.length) * 100);
console.log(`${matched}/${cases.length} matched`);
console.log(`${percentage}%`);
console.log(`date=${new Date().toISOString().slice(0, 10)}`);
console.log(`prompt_version=${promptVersion}`);
const failed = results.filter((result) => !result.matched);
console.log('Failed cases:');
if (failed.length === 0) console.log('- none');
else for (const result of failed) console.log(`- ${result.id}`);
