import assert from 'node:assert/strict';
import { once } from 'node:events';
import express from 'express';
import { afterEach, test } from 'node:test';
import { createAccessRouter } from '../src/access.routes.js';

const servers = new Set();

async function request(path, authorization) {
  const app = express();
  app.use(createAccessRouter());

  const server = app.listen(0);
  servers.add(server);
  await once(server, 'listening');
  const { port } = server.address();

  try {
    return await fetch(`http://127.0.0.1:${port}${path}`, {
      headers: authorization === undefined ? {} : { authorization },
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

test('public info is available without authentication', async () => {
  const response = await request('/public/info');

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { message: 'Welcome stranger! This info is public.' });
});

test('protected profile rejects missing and malformed bearer headers', async () => {
  for (const authorization of [undefined, '', 'Basic token', 'Bearer', 'Bearer token extra']) {
    const response = await request('/protected/profile', authorization);
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: 'Access token required' });
  }
});

test('protected profile accepts token presence without verifying it at this stage', async () => {
  const response = await request('/protected/profile', 'Bearer arbitrary-token');

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { message: 'Access token provided' });
});