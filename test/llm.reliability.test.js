import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ModelTimeoutError, retryWithBackoff } from '../src/llm/model.js';

test('model retry uses exponential backoff with jitter', async () => {
  const waits = [];
  let calls = 0;
  const result = await retryWithBackoff(async () => {
    calls += 1;
    if (calls < 3) {
      const error = new Error('temporary server error');
      error.status = 503;
      throw error;
    }
    return 'done';
  }, {
    sleep: async (milliseconds) => waits.push(milliseconds),
    random: () => 0.5,
  });

  assert.equal(result, 'done');
  assert.equal(calls, 3);
  assert.deepEqual(waits, [1125, 2125]);
});

test('model retry honors Retry-After seconds', async () => {
  const waits = [];
  let calls = 0;
  const result = await retryWithBackoff(async () => {
    calls += 1;
    if (calls === 1) {
      const error = new Error('rate limited');
      error.status = 429;
      error.headers = new Headers({ 'retry-after': '2' });
      throw error;
    }
    return 'done';
  }, {
    sleep: async (milliseconds) => waits.push(milliseconds),
    random: () => 0,
  });

  assert.equal(result, 'done');
  assert.deepEqual(waits, [2000]);
});

test('model retry never retries 401', async () => {
  let calls = 0;
  const waits = [];
  const unauthorized = new Error('unauthorized');
  unauthorized.status = 401;

  await assert.rejects(retryWithBackoff(async () => {
    calls += 1;
    throw unauthorized;
  }, { sleep: async (milliseconds) => waits.push(milliseconds) }), unauthorized);

  assert.equal(calls, 1);
  assert.deepEqual(waits, []);
});

test('model timeout is retried at most three times and surfaced as ModelTimeoutError', async () => {
  let calls = 0;
  const waits = [];

  await assert.rejects(retryWithBackoff(async () => {
    calls += 1;
    const error = new Error('timeout');
    error.name = 'TimeoutError';
    throw error;
  }, {
    sleep: async (milliseconds) => waits.push(milliseconds),
    random: () => 0,
  }), ModelTimeoutError);

  assert.equal(calls, 4);
  assert.deepEqual(waits, [1000, 2000, 4000]);
});
