import { getSupabaseClient } from './supabase.js';

export function createAuthMiddleware(getClient = getSupabaseClient) {
  return async function authenticate(request, response, next) {
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

      request.user = data.user;
      request.accessToken = bearerToken;
      return next();
    } catch {
      return response.status(401).json({ error: 'Invalid or expired token' });
    }
  };
}