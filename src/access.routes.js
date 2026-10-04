import express from 'express';
import { getSupabaseClient } from './supabase.js';
import { createAuthMiddleware } from './auth.middleware.js';

export function createAccessRouter(getClient = getSupabaseClient) {
  const router = express.Router();
  const requireAuth = createAuthMiddleware(getClient);

  router.get('/public/info', (_request, response) => {
    response.status(200).json({ message: 'Welcome stranger! This info is public.' });
  });

  router.get('/protected/profile', requireAuth, (request, response) => {
    const { id, email, created_at: createdAt } = request.user;
    response.status(200).json({ id, email, created_at: createdAt });
  });

  router.get('/protected/dashboard', requireAuth, (request, response) => {
    response.status(200).json({ message: 'Welcome to your dashboard', user_id: request.user.id });
  });

  return router;
}