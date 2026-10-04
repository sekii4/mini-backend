import express from 'express';

export function createAccessRouter() {
  const router = express.Router();

  router.get('/public/info', (_request, response) => {
    response.status(200).json({ message: 'Welcome stranger! This info is public.' });
  });

  router.get('/protected/profile', (request, response) => {
    const authorization = request.get('authorization') ?? '';
    const bearerToken = authorization.match(/^Bearer\s+(\S+)$/i)?.[1];

    if (!bearerToken) {
      return response.status(401).json({ error: 'Access token required' });
    }

    return response.status(200).json({ message: 'Access token provided' });
  });

  return router;
}