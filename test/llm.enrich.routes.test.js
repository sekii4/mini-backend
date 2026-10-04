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

test('enrich rejects model output that does not match the output schema', async () => {
  const response = await request({ title: 'A Sample Book', description: 'A short description.' }, {
    isStub: () => false,
    modelCall: async () => ({ category: 'made-up', summary: 'Okay', quality_flags: [], extra: true }),
  });

  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), { error: 'Model response failed schema validation' });
});