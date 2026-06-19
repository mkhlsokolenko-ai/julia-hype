// src/authModal.js — C3: login/signup modal (JULIA style).
// Defines window.openAuth('login'|'signup') — used by the header badge (C2) and bottom CTA (C4).
// Minimal signup (email+password). Email confirmation is ON → after signUp shows "check your inbox".
import { signIn, signUp, signInWithGoogle } from './auth.js';

let overlay = null;          // root .am-overlay
let body = null;             // .am-body (re-rendered per view)
let state = { mode: 'login', busy: false };

const CSS = `
.am-overlay{ position:fixed; inset:0; z-index:9999; display:none; align-items:center; justify-content:center;
  background:rgba(10,6,22,.72); backdrop-filter:blur(4px); padding:20px; }
.am-overlay.am-open{ display:flex; }
.am-card{ position:relative; width:100%; max-width:380px; background:#15102a; border:1px solid rgba(192,132,252,.22);
  border-radius:18px; padding:28px 26px 24px; box-shadow:0 24px 60px rgba(0,0,0,.5);
  font-family:'Plus Jakarta Sans', system-ui, sans-serif; color:#ECE7F5; }
.am-x{ position:absolute; top:12px; right:14px; background:none; border:0; color:#9aa3b2; font-size:22px;
  line-height:1; cursor:pointer; padding:4px; }
.am-x:hover{ color:#ECE7F5; }
.am-title{ margin:0 0 18px; font-size:20px; font-weight:800; letter-spacing:.01em; }
.am-google{ width:100%; cursor:pointer; border-radius:11px; padding:11px; font:inherit; font-weight:600;
  background:#fff; color:#1a1a1a; border:0; margin-bottom:14px; }
.am-google:hover{ opacity:.92; }
.am-or{ text-align:center; color:#9aa3b2; font-size:12px; margin:6px 0 14px; font-family:'Space Grotesk', monospace; }
.am-field{ display:block; width:100%; box-sizing:border-box; margin-bottom:11px; padding:11px 13px; border-radius:11px;
  background:#0f0a1e; border:1px solid rgba(192,132,252,.22); color:#ECE7F5; font:inherit; font-size:14px; }
.am-field:focus{ outline:none; border-color:#C084FC; box-shadow:0 0 0 3px rgba(192,132,252,.18); }
.am-field::placeholder{ color:#6b7280; }
.am-err{ min-height:18px; color:#FB7185; font-size:12.5px; margin:2px 0 10px; }
.am-submit{ width:100%; cursor:pointer; border:0; border-radius:11px; padding:12px; font:inherit; font-weight:700;
  color:#fff; background:linear-gradient(96deg,#C084FC,#FB7185); letter-spacing:.01em; }
.am-submit:hover{ opacity:.94; }
.am-submit:disabled{ opacity:.55; cursor:default; }
.am-switch{ text-align:center; margin-top:16px; font-size:13px; color:#9aa3b2; }
.am-switch a{ color:#C084FC; cursor:pointer; text-decoration:none; font-weight:600; }
.am-switch a:hover{ text-decoration:underline; }
.am-sent{ text-align:center; }
.am-sent .am-sent-ico{ font-size:34px; margin-bottom:8px; }
.am-sent p{ color:#c8c2d8; font-size:14px; line-height:1.5; margin:8px 0 18px; }
.am-sent b{ color:#ECE7F5; }
`;

function injectCss() {
  if (document.getElementById('auth-modal-css')) return;
  const s = document.createElement('style');
  s.id = 'auth-modal-css';
  s.textContent = CSS;
  document.head.appendChild(s);
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (m) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]
  ));
}

function mapError(err) {
  const m = (err && err.message ? err.message : String(err)).toLowerCase();
  if (m.includes('invalid login credentials')) return 'Неверный email или пароль.';
  if (m.includes('already registered') || m.includes('already been registered')) return 'Этот email уже зарегистрирован — войдите.';
  if (m.includes('at least 6')) return 'Пароль должен быть не короче 6 символов.';
  if (m.includes('not confirmed')) return 'Email не подтверждён — проверьте почту.';
  if (m.includes('rate limit') || m.includes('too many')) return 'Слишком много попыток. Подождите немного.';
  if (m.includes('unable to validate email') || m.includes('invalid email')) return 'Проверьте формат email.';
  return 'Что-то пошло не так. Попробуйте ещё раз.';
}

function build() {
  injectCss();
  overlay = document.createElement('div');
  overlay.className = 'am-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.innerHTML = `<div class="am-card"><button class="am-x" type="button" aria-label="Закрыть">×</button><div class="am-body"></div></div>`;
  document.body.appendChild(overlay);
  body = overlay.querySelector('.am-body');

  overlay.querySelector('.am-x').addEventListener('click', close);
  overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && overlay.classList.contains('am-open')) close(); });
}

function renderForm() {
  const isSignup = state.mode === 'signup';
  body.innerHTML = `
    <h3 class="am-title">${isSignup ? 'Создать аккаунт' : 'Вход'}</h3>
    <button class="am-google" type="button">Продолжить с Google</button>
    <div class="am-or">или по email</div>
    <form class="am-form" novalidate>
      <input class="am-field am-email" type="email" placeholder="email" autocomplete="email" />
      <input class="am-field am-pass" type="password" placeholder="пароль" autocomplete="${isSignup ? 'new-password' : 'current-password'}" />
      <div class="am-err"></div>
      <button class="am-submit" type="submit">${isSignup ? 'Зарегистрироваться' : 'Войти'}</button>
    </form>
    <div class="am-switch">
      ${isSignup
        ? 'Уже есть аккаунт? <a class="am-toggle">Войти</a>'
        : 'Нет аккаунта? <a class="am-toggle">Регистрация</a>'}
    </div>`;

  body.querySelector('.am-google').addEventListener('click', handleGoogle);
  body.querySelector('.am-toggle').addEventListener('click', () => { state.mode = isSignup ? 'login' : 'signup'; renderForm(); });
  body.querySelector('.am-form').addEventListener('submit', handleSubmit);
  setTimeout(() => body.querySelector('.am-email')?.focus(), 30);
}

function renderSent(email) {
  body.innerHTML = `
    <div class="am-sent">
      <div class="am-sent-ico">📩</div>
      <h3 class="am-title" style="margin-bottom:4px">Проверьте почту</h3>
      <p>Письмо отправлено на <b>${esc(email)}</b>.<br>Перейдите по ссылке, чтобы активировать аккаунт и войти.</p>
      <button class="am-submit am-ok" type="button">Понятно</button>
    </div>`;
  body.querySelector('.am-ok').addEventListener('click', close);
}

function setBusy(b) {
  state.busy = b;
  const btn = body.querySelector('.am-submit');
  if (btn) { btn.disabled = b; btn.textContent = b ? 'Минутку…' : (state.mode === 'signup' ? 'Зарегистрироваться' : 'Войти'); }
}

function showErr(msg) {
  const e = body.querySelector('.am-err');
  if (e) e.textContent = msg || '';
}

async function handleSubmit(ev) {
  ev.preventDefault();
  if (state.busy) return;
  const email = body.querySelector('.am-email').value.trim();
  const pass = body.querySelector('.am-pass').value;
  showErr('');
  if (!/^\S+@\S+\.\S+$/.test(email)) { showErr('Проверьте формат email.'); return; }
  if (pass.length < 6) { showErr('Пароль должен быть не короче 6 символов.'); return; }

  setBusy(true);
  try {
    if (state.mode === 'signup') {
      const data = await signUp(email, pass);
      // Supabase quirk: signUp для уже существующего email возвращает user без identities и без ошибки.
      if (data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        setBusy(false);
        showErr('Этот email уже зарегистрирован — войдите.');
        return;
      }
      renderSent(email); // подтверждение ON → сессии пока нет, ждём письмо
    } else {
      await signIn(email, pass);
      close(); // бейдж (C2) обновится через onAuthChange
    }
  } catch (err) {
    setBusy(false);
    showErr(mapError(err));
  }
}

async function handleGoogle() {
  showErr('');
  try { await signInWithGoogle(); } // редиректит на Google → обратно на JULIA
  catch (err) { showErr(mapError(err)); }
}

function open(mode) {
  if (!overlay) build();
  state.mode = (mode === 'signup') ? 'signup' : 'login';
  state.busy = false;
  renderForm();
  overlay.classList.add('am-open');
  document.documentElement.style.overflow = 'hidden';
}

function close() {
  if (!overlay) return;
  overlay.classList.remove('am-open');
  document.documentElement.style.overflow = '';
}

// Public hook used by the header badge and bottom CTA.
window.openAuth = (mode = 'login') => open(mode);
