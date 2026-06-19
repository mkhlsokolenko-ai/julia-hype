// src/joinCta.js — C4: hide the registration CTA section when the user is already logged in.
// Button wiring is inline (onclick="window.openAuth(...)"); this only toggles visibility.
import { onAuthChange, getCurrentUser } from './supabase.js';

function toggle(user) {
  const s = document.getElementById('join-cta');
  if (s) s.style.display = user ? 'none' : '';
}

async function init() {
  let user = null;
  try { user = await getCurrentUser(); } catch { user = null; }
  toggle(user);
  onAuthChange(toggle);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
