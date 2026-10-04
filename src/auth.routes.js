import express from 'express';
import { getSupabaseClient } from './supabase.js';
import { createAuthMiddleware } from './auth.middleware.js';

export function createAuthRouter(getClient = getSupabaseClient) {
  const router = express.Router();
  const requireAuth = createAuthMiddleware(getClient);

  router.post('/signup', async (request, response) => {
    const { email, password } = request.body ?? {};
    if (typeof email !== 'string' || !email.trim() || typeof password !== 'string' || !password) {
      return response.status(400).json({ error: 'Email and password are required' });
    }

    try {
      const { data, error } = await getClient().auth.signUp({ email: email.trim(), password });
      if (error) return response.status(400).json({ error: error.message });
      if (!data.user) return response.status(500).json({ error: 'Unable to sign up' });
      return response.status(201).json(data.user);
    } catch {
      return response.status(500).json({ error: 'Unable to sign up' });
    }
  });

  router.post('/login', async (request, response) => {
    const { email, password } = request.body ?? {};
    if (typeof email !== 'string' || !email.trim() || typeof password !== 'string' || !password) {
      return response.status(400).json({ error: 'Email and password are required' });
    }

    try {
      const { data, error } = await getClient().auth.signInWithPassword({ email: email.trim(), password });
      if (error || !data.session) {
        return response.status(401).json({ error: 'Invalid login credentials' });
      }
      return response.status(200).json({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      });
    } catch {
      return response.status(500).json({ error: 'Unable to log in' });
    }
  });

  router.post('/logout', requireAuth, async (request, response) => {
    try {
      const { error } = await getClient().auth.admin.signOut(request.accessToken, 'local');
      if (error) return response.status(500).json({ error: 'Unable to log out' });
      return response.status(204).end();
    } catch {
      return response.status(500).json({ error: 'Unable to log out' });
    }
  });

  return router;
}