import 'dotenv/config';
import express from 'express';
import { createAccessRouter } from './src/access.routes.js';
import { createAuthRouter } from './src/auth.routes.js';
import { initializeSupabase } from './src/supabase.js';

const app = express();
const port = Number(process.env.PORT) || 3000;

app.use(express.json());
app.use('/auth', createAuthRouter());
app.use(createAccessRouter());

app.get('/health', (_request, response) => {
  response.json({ status: 'ok' });
});

if (initializeSupabase()) {
  console.info('Supabase client initialized from environment variables.');
} else {
  console.warn('Supabase is not configured. Set SUPABASE_URL and the anon SUPABASE_KEY in .env.');
}

app.listen(port, () => {
  console.info(`Express server listening on port ${port}.`);
});