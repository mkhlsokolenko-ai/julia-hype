// JULIA auth — Supabase client.
// Shared project (zzwwobiypfkwaawxlyud) → same auth.users as MIRA/pmhucks.
// Public reads elsewhere keep using raw anon-fetch; this client only adds the auth layer.
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true, // OAuth callback + token-relay handoff to MIRA (C5)
  },
});

// Current user or null (no throw — на публичной витрине аноним = норма).
export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) return null;
  return user;
}

// Fast local check (reads stored session, без сетевого запроса).
export async function isAuthenticated() {
  const { data: { session } } = await supabase.auth.getSession();
  return !!session;
}

// Subscribe to login/logout for the header badge. Returns { data: { subscription } }.
export function onAuthChange(cb) {
  return supabase.auth.onAuthStateChange((_event, session) => cb(session?.user ?? null));
}
