import assert from 'node:assert/strict';
import { once } from 'node:events';
import express from 'express';
import { afterEach, test } from 'node:test';
import { createAccessRouter } from '../src/access.routes.js';

const servers = new Set();

async function request(path, authorization, auth = {}) {
  const app = express();
  app.use(createAccessRouter(() => ({ auth })));

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

test('protected profile verifies the token and returns safe user metadata', async () => {
  const user = {
    id: 'user-123',
    email: 'person@example.com',
    created_at: '2026-10-04T12:00:00.000Z',
    app_metadata: { provider: 'email' },
    password: 'must-not-be-returned',
  };
  let receivedToken;
  const auth = {
    getUser: async (token) => {
      receivedToken = token;
      return { data: { user }, error: null };
    },
  };
  const response = await request('/protected/profile', 'Bearer verified-token', auth);

  assert.equal(response.status, 200);
  assert.equal(receivedToken, 'verified-token');
  assert.deepEqual(await response.json(), {
    id: user.id,
    email: user.email,
    created_at: user.created_at,
  });
});

test('protected profile rejects invalid or tampered tokens', async () => {
  const auth = {
    getUser: async () => ({ data: { user: null }, error: new Error('invalid token') }),
  };

  for (const token of ['invalid-token', 'tampered-token']) {
    const response = await request('/protected/profile', `Bearer ${token}`, auth);
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: 'Invalid or expired token' });
  }
});