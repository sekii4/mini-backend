import assert from 'node:assert/strict';
import { once } from 'node:events';
import express from 'express';
import { afterEach, test } from 'node:test';
import { createAuthRouter } from '../src/auth.routes.js';

const servers = new Set();

async function requestWithAuth(mockAuth, path, body, authorization) {
  const app = express();
  app.use(express.json());
  app.use('/auth', createAuthRouter(() => ({ auth: mockAuth })));

  const server = app.listen(0);
  servers.add(server);
  await once(server, 'listening');
  const { port } = server.address();

  try {
    const headers = {};
    if (body !== undefined) headers['content-type'] = 'application/json';
    if (authorization !== undefined) headers.authorization = authorization;

    return await fetch(`http://127.0.0.1:${port}/auth/${path}`, {
      method: 'POST',
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
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

test('signup returns the Supabase user with 201', async () => {
  const user = { id: 'user-1', email: 'person@example.com' };
  const auth = { signUp: async () => ({ data: { user }, error: null }) };
  const response = await requestWithAuth(auth, 'signup', { email: user.email, password: 'correct horse' });

  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), user);
});

test('signup rejects missing credentials with 400', async () => {
  const auth = { signUp: async () => assert.fail('Supabase should not be called') };
  const response = await requestWithAuth(auth, 'signup', { email: 'person@example.com' });

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: 'Email and password are required' });
});

test('login returns Supabase access and refresh tokens with 200', async () => {
  const session = { access_token: 'access-token', refresh_token: 'refresh-token' };
  const auth = { signInWithPassword: async () => ({ data: { session }, error: null }) };
  const response = await requestWithAuth(auth, 'login', { email: 'person@example.com', password: 'correct horse' });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), session);
});

test('login rejects invalid credentials with the required 401 response', async () => {
  const auth = { signInWithPassword: async () => ({ data: { session: null }, error: new Error('invalid') }) };
  const response = await requestWithAuth(auth, 'login', { email: 'person@example.com', password: 'wrong' });

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: 'Invalid login credentials' });
});

test('logout verifies the bearer token, revokes its local session, and returns 204', async () => {
  let signedOutToken;
  let signedOutScope;
  const auth = {
    getUser: async () => ({ data: { user: { id: 'user-logout' } }, error: null }),
    admin: {
      signOut: async (token, scope) => {
        signedOutToken = token;
        signedOutScope = scope;
        return { error: null };
      },
    },
  };
  const response = await requestWithAuth(auth, 'logout', undefined, 'Bearer logout-token');

  assert.equal(response.status, 204);
  assert.equal(await response.text(), '');
  assert.equal(signedOutToken, 'logout-token');
  assert.equal(signedOutScope, 'local');
});

test('logout rejects missing bearer token without calling Supabase signOut', async () => {
  let signOutCalled = false;
  const auth = {
    admin: {
      signOut: async () => {
        signOutCalled = true;
        return { error: null };
      },
    },
  };
  const response = await requestWithAuth(auth, 'logout');

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: 'Access token required' });
  assert.equal(signOutCalled, false);
});