// JULIA auth actions.
// Minimal signup (email+password only) — полный профиль собираем позже в MIRA через модалку.
import { supabase } from './supabase.js';

// Minimal sign-up. emailRedirectTo возвращает в JULIA, если включено подтверждение почты
// (требует https://julia-ai.pro/** в Redirect URLs allowlist — см. настройку).
export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: window.location.origin + '/' },
  });
  if (error) throw error;
  return data;
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

// JULIA has no dashboard — OAuth returns to home. (Требует Google в Supabase + julia-ai.pro в allowlist.)
export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin + '/' },
  });
  if (error) throw error;
  return data;
}
