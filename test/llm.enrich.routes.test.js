import assert from 'node:assert/strict';
import { once } from 'node:events';
import express from 'express';
import { afterEach, test } from 'node:test';
import { createEnrichRouter } from '../src/llm/enrich.routes.js';

const servers = new Set();

async function request(body, options = {}) {
  const app = express();
  app.use(express.json());
  app.use(createEnrichRouter(options));

  const server = app.listen(0);
  servers.add(server);
  await once(server, 'listening');
  const { port } = server.address();

  try {
    return await fetch(`http://127.0.0.1:${port}/enrich`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  } finally {
    server.close();
    servers.delete(server);
  }
}

afterEach(async () => {
  await Promise.all([...servers].map((server) => new Promise((resolve) => server.close(resolve))));
  servers.clear();
});

test('stub enrich returns a closed schema result without a model call', async () => {
  let modelCalls = 0;
  const response = await request({ title: 'A Sample Book', description: null }, {
    isStub: () => true,
    modelCall: async () => {
      modelCalls += 1;
      throw new Error('stub must not invoke the model');
    },
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    category: 'other',
    summary: 'The book is titled "A Sample Book"; no description was provided.',
    quality_flags: ['missing_description', 'unclear_category'],
  });
  assert.equal(modelCalls, 0);
});

test('enrich validates required input fields before any model call', async () => {
  let modelCalls = 0;
  const response = await request({ title: 'A Sample Book' }, {
    isStub: () => false,
    modelCall: async () => {
      modelCalls += 1;
      return {};
    },
  });

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: 'Invalid input',
    fields: { description: ['Invalid input: expected string, received undefined'] },
  });
  assert.equal(modelCalls, 0);
});

test('enrich rejects invalid types and oversized text before a model call', async () => {
  let modelCalls = 0;
  const response = await request({ title: 42, description: 'x'.repeat(5001) }, {
    isStub: () => false,
    modelCall: async () => {
      modelCalls += 1;
      return {};
    },
  });

  assert.equal(response.status, 400);
  const result = await response.json();
  assert.equal(result.error, 'Invalid input');
  assert.ok(result.fields.title);
  assert.ok(result.fields.description);
  assert.equal(modelCalls, 0);
});

test('enrich parses JSON surrounded by explanatory text and code fences', async () => {
  const response = await request({ title: 'A Sample Book', description: 'A short description.' }, {
    isStub: () => false,
    modelCall: async () => 'Here is the result:\n```json\n{"category":"fiction","summary":"A short fictional story.","quality_flags":[]}\n```',
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    category: 'fiction',
    summary: 'A short fictional story.',
    quality_flags: [],
  });
});

test('enrich performs exactly one repair with original input, broken output, and validation error', async () => {
  const input = { title: 'A Sample Book', description: 'A short description.' };
  const brokenOutput = '{"category":"made-up","summary":"Okay","quality_flags":[]}';
  let modelCalls = 0;
  let repairCalls = 0;
  const response = await request(input, {
    isStub: () => false,
    modelCall: async () => {
      modelCalls += 1;
      return brokenOutput;
    },
    repairCall: async (repair) => {
      repairCalls += 1;
      assert.deepEqual(repair.input, input);
      assert.equal(repair.brokenOutput, brokenOutput);
      assert.match(repair.validationError, /Schema validation error: category:/);
      return '{"category":"fiction","summary":"A short fictional story.","quality_flags":[]}';
    },
  });

  assert.equal(response.status, 200);
  assert.equal(modelCalls, 1);
  assert.equal(repairCalls, 1);
  assert.deepEqual(await response.json(), {
    category: 'fiction',
    summary: 'A short fictional story.',
    quality_flags: [],
  });
});

test('enrich quarantines the failed repair and returns 422 without raw model text', async () => {
  const input = { title: 'A Sample Book', description: 'A short description.' };
  const rawOutput = 'not json at all';
  let repairCalls = 0;
  let quarantined;
  const response = await request(input, {
    isStub: () => false,
    modelCall: async () => rawOutput,
    repairCall: async () => {
      repairCalls += 1;
      return '{"category":"invalid-category","summary":42,"quality_flags":[]}';
    },
    quarantine: async (entry) => {
      quarantined = entry;
    },
  });

  assert.equal(response.status, 422);
  assert.equal(repairCalls, 1);
  assert.deepEqual(await response.json(), {
    error: 'Model response could not be validated after one repair attempt',
  });
  assert.deepEqual(quarantined.input, input);
  assert.match(quarantined.error, /JSON parse error/);
  assert.equal(quarantined.prompt_version, 'book-enrichment-v1');
  assert.equal(quarantined.raw_model_output, rawOutput);
  assert.match(quarantined.repair_model_output, /invalid-category/);
});

test('LLM_ENABLED=false returns 503 without calling the model', async () => {
  let modelCalls = 0;
  const response = await request({ title: 'A Sample Book', description: 'A short description.' }, {
    isStub: () => false,
    isEnabled: () => false,
    modelCall: async () => {
      modelCalls += 1;
      return '{}';
    },
  });

  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: 'LLM is disabled' });
  assert.equal(modelCalls, 0);
});

test('model timeout maps to 504', async () => {
  const { ModelTimeoutError } = await import('../src/llm/model.js');
  const response = await request({ title: 'A Sample Book', description: 'A short description.' }, {
    isStub: () => false,
    modelCall: async () => { throw new ModelTimeoutError(); },
  });

  assert.equal(response.status, 504);
  assert.deepEqual(await response.json(), { error: 'Model request timed out' });
});