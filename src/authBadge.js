// src/authBadge.js — C2: header auth badge (login state), JULIA style.
// Self-contained: injects its own CSS, auto-mounts to every #auth-badge, reacts to auth changes.
//   Logged out → "Войти" / "Регистрация"  (call window.openAuth(mode) — форма/модалка в C3)
//   Logged in  → email + "Выйти"           (Выйти работает уже сейчас)
import { getCurrentUser, onAuthChange } from './supabase.js';
import { signOut } from './auth.js';

const CSS = `
.auth-badge{ margin-left:auto; display:inline-flex; align-items:center; gap:10px;
  font-family:'Space Grotesk', monospace; font-size:13px; }
.topbar-right{ display:inline-flex; align-items:center; gap:16px; }
.auth-badge .ab-btn{ cursor:pointer; border:0; border-radius:999px; padding:7px 14px;
  font:inherit; font-weight:600; letter-spacing:.02em; transition:transform .12s ease, opacity .12s ease; }
.auth-badge .ab-btn:hover{ transform:translateY(-1px); }
.auth-badge .ab-login{ background:rgba(192,132,252,.12); color:#E9D5FF; border:1px solid rgba(192,132,252,.35); }
.auth-badge .ab-signup{ background:linear-gradient(96deg,#C084FC,#FB7185); color:#fff; }
.auth-badge .ab-email{ color:var(--muted,#9aa3b2); max-width:180px; overflow:hidden;
  text-overflow:ellipsis; white-space:nowrap; }
.auth-badge .ab-out{ cursor:pointer; color:#E9D5FF; opacity:.8; background:none; border:0; font:inherit; padding:0; }
.auth-badge .ab-out:hover{ opacity:1; text-decoration:underline; }
@media (max-width:520px){ .auth-badge .ab-email{ display:none; } .auth-badge .ab-btn{ padding:6px 11px; } }
`;

function injectCss() {
  if (document.getElementById('auth-badge-css')) return;
  const s = document.createElement('style');
  s.id = 'auth-badge-css';
  s.textContent = CSS;
  document.head.appendChild(s);
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (m) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]
  ));
}

function render(el, user) {
  if (user) {
    const email = user.email || 'аккаунт';
    el.innerHTML =
      `<span class="ab-email" title="${esc(email)}">${esc(email)}</span>` +
      `<button class="ab-out" type="button">Выйти</button>`;
    el.querySelector('.ab-out').addEventListener('click', async () => {
      try { await signOut(); } catch (e) { console.warn('[auth] signOut failed:', e); }
    });
  } else {
    el.innerHTML =
      `<button class="ab-btn ab-login" type="button">Войти</button>` +
      `<button class="ab-btn ab-signup" type="button">Регистрация</button>`;
    // window.openAuth реализуется в C3 (модалка входа/регистрации). До C3 — no-op.
    el.querySelector('.ab-login').addEventListener('click', () => window.openAuth?.('login'));
    el.querySelector('.ab-signup').addEventListener('click', () => window.openAuth?.('signup'));
  }
}

export async function mountAuthBadge() {
  const els = Array.from(document.querySelectorAll('#auth-badge'));
  if (!els.length) return;
  injectCss();
  let user = null;
  try { user = await getCurrentUser(); } catch { user = null; }
  els.forEach((el) => render(el, user));
  onAuthChange((u) => els.forEach((el) => render(el, u)));
}

// Auto-mount.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountAuthBadge);
} else {
  mountAuthBadge();
}
