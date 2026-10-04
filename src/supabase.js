import { createClient } from '@supabase/supabase-js';

let client;

export function initializeSupabase() {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_KEY;

  if (!url || !anonKey) return null;
  if (!client) client = createClient(url, anonKey);
  return client;
}

export function getSupabaseClient() {
  const supabase = initializeSupabase();
  if (!supabase) {
    throw new Error('Supabase is not configured. Set SUPABASE_URL and the anon SUPABASE_KEY in .env.');
  }
  return supabase;
}