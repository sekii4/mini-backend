import express from 'express';
import { getSupabaseClient } from './supabase.js';

export function createAccessRouter(getClient = getSupabaseClient) {
  const router = express.Router();

  router.get('/public/info', (_request, response) => {
    response.status(200).json({ message: 'Welcome stranger! This info is public.' });
  });

  router.get('/protected/profile', async (request, response) => {
    const authorization = request.get('authorization') ?? '';
    const bearerToken = authorization.match(/^Bearer\s+(\S+)$/i)?.[1];

    if (!bearerToken) {
      return response.status(401).json({ error: 'Access token required' });
    }

    try {
      const { data, error } = await getClient().auth.getUser(bearerToken);
      if (error || !data.user) {
        return response.status(401).json({ error: 'Invalid or expired token' });
      }

      const { id, email, created_at: createdAt } = data.user;
      return response.status(200).json({ id, email, created_at: createdAt });
    } catch {
      return response.status(401).json({ error: 'Invalid or expired token' });
    }
  });

  return router;
}