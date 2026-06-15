// JULIA Home — Hype Map v2 (canvas) + переключатель на Граф связей. Креды из env.

import { initGraph, showGraph, hideGraph } from './graph.js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const PHASES = {
  trigger: { color: '#94A3B8', label: 'Технологический триггер', short: 'Триггер', band: [80, 250] },
  peak:    { color: '#FB923C', label: 'Пик завышенных ожиданий', short: 'Пик', band: [250, 365] },
  trough:  { color: '#F87171', label: 'Дно разочарования', short: 'Дно', band: [385, 650] },
  slope:   { color: '#60A5FA', label: 'Склон просветления', short: 'Склон', band: [668, 822] },
  plateau: { color: '#4ADE80', label: 'Плато продуктивности', short: 'Плато', band: [838, 942] },
};
const ORDER = ['trigger', 'peak', 'trough', 'slope', 'plateau'];
const W = 1000, H = 520;
const ANCHORS = [{ x: 70, y: 410 }, { x: 300, y: 70 }, { x: 540, y: 422 }, { x: 800, y: 182 }, { x: 945, y: 202 }];

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

function catmullRom(a, per = 28) {
  const p = [];
  for (let i = 0; i < a.length - 1; i++) {
    const p0 = a[i - 1] || a[i], p1 = a[i], p2 = a[i + 1], p3 = a[i + 2] || a[i + 1];
    for (let s = 0; s < per; s++) {
      const t = s / per, t2 = t * t, t3 = t2 * t;
      p.push({
        x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y: 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      });
    }
  }
  p.push(a[a.length - 1]);
  return p;
}
const CURVE = catmullRom(ANCHORS);

function yAt(x) {
  if (x <= CURVE[0].x) return CURVE[0].y;
  for (let i = 0; i < CURVE.length - 1; i++) {
    const A = CURVE[i], B = CURVE[i + 1];
    if (x >= A.x && x <= B.x) return A.y + (x - A.x) / ((B.x - A.x) || 1) * (B.y - A.y);
  }
  return CURVE[CURVE.length - 1].y;
}

function layout(rows) {
  const maxV = Math.max(1e-6, ...rows.map(r => Math.abs(Number(r.velocity) || 0)));
  const byPhase = {}; ORDER.forEach(p => (byPhase[p] = []));
  rows.forEach(r => { if (byPhase[r.phase]) byPhase[r.phase].push(r); });
  const out = [];
  for (const p of ORDER) {
    const list = byPhase[p].slice().sort((a, b) => Math.abs(b.velocity || 0) - Math.abs(a.velocity || 0));
    const [x0, x1] = PHASES[p].band, k = list.length;
    if (!k) continue;
    const cols = Math.max(1, Math.min(k, Math.round((x1 - x0) / 22)));
    list.forEach((c, idx) => {
      const col = idx % cols, row = Math.floor(idx / cols);
      const x = cols === 1 ? (x0 + x1) / 2 : x0 + (col / (cols - 1)) * (x1 - x0);
      const y = yAt(x) - 13 - row * 15;
      const baseR = 3 + (Math.abs(Number(c.velocity) || 0) / maxV) * 6;
      out.push({ ...c, x, y, baseR });
    });
  }
  return out;
}

const glowCache = {};
function glowSprite(color) {
  if (glowCache[color]) return glowCache[color];
  const S = 64, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  grad.addColorStop(0, color + 'cc'); grad.addColorStop(0.25, color + '66'); grad.addColorStop(1, color + '00');
  g.fillStyle = grad; g.beginPath(); g.arc(S / 2, S / 2, S / 2, 0, 7); g.fill();
  glowCache[color] = c; return c;
}

let canvas, ctx, dpr = 1, cssW = W, cssH = H;
let placed = [], hovered = -1, intro = 0, reduced = false, mapVisible = true;
let compareMode = false, compareSel = [];

function resize() {
  const rect = canvas.parentElement.getBoundingClientRect();
  if (rect.width === 0) return;
  cssW = Math.max(320, rect.width - 28);
  cssH = cssW * H / W;
  dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.style.width = cssW + 'px';
  canvas.style.height = cssH + 'px';
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
}

function drawCurvePath() { ctx.beginPath(); CURVE.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); }

function frame(ts) {
  if (!mapVisible) { requestAnimationFrame(frame); return; }
  ctx.setTransform(cssW / W * dpr, 0, 0, cssH / H * dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  const t = ts / 1000;
  if (!reduced && intro < 1) intro = Math.min(1, intro + 0.018); else intro = 1;

  ctx.strokeStyle = 'rgba(59,46,102,0.55)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(50, 470); ctx.lineTo(960, 470); ctx.stroke();

  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const grad = ctx.createLinearGradient(0, 0, W, 0);
  grad.addColorStop(0, '#C084FC'); grad.addColorStop(0.55, '#C084FC'); grad.addColorStop(1, '#4ADE80');
  ctx.strokeStyle = grad;
  ctx.globalAlpha = 0.16; ctx.lineWidth = 11; drawCurvePath(); ctx.stroke();
  ctx.globalAlpha = 0.92; ctx.lineWidth = 2.4; drawCurvePath(); ctx.stroke();
  ctx.globalAlpha = 1;

  placed.forEach((d, i) => {
    const ph = PHASES[d.phase] || PHASES.trough;
    const stagger = reduced ? 1 : Math.min(1, Math.max(0, (intro - (i / Math.max(1, placed.length)) * 0.5) * 2));
    if (stagger <= 0) return;
    const pulse = reduced ? 1 : 1 + Math.sin(t * 1.4 + i * 0.7) * 0.06;
    const isH = i === hovered;
    const r = d.baseR * (isH ? 1.6 : 1) * stagger;
    const glowR = r * (isH ? 5 : 3.4) * pulse;
    ctx.globalAlpha = (isH ? 0.95 : 0.68) * stagger;
    ctx.drawImage(glowSprite(ph.color), d.x - glowR, d.y - glowR, glowR * 2, glowR * 2);
    ctx.globalAlpha = stagger;
    ctx.fillStyle = ph.color;
    ctx.beginPath(); ctx.arc(d.x, d.y, r, 0, 7); ctx.fill();
    if (isH) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(d.x, d.y, r + 4, 0, 7); ctx.stroke(); }
    if (compareMode && compareSel.some(s => s.slug === d.slug)) {
      ctx.strokeStyle = '#F0ABFC'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.arc(d.x, d.y, r + 7, 0, 7); ctx.stroke();
    }
  });
  ctx.globalAlpha = 1;

  ctx.font = '600 11px Inter, system-ui, sans-serif'; ctx.textAlign = 'center';
  ORDER.forEach(p => {
    const b = PHASES[p].band, cx = (b[0] + b[1]) / 2;
    const cnt = placed.filter(d => d.phase === p).length;
    ctx.fillStyle = PHASES[p].color; ctx.globalAlpha = 0.82;
    ctx.fillText(`${PHASES[p].short} · ${cnt}`, cx, 502);
  });
  ctx.globalAlpha = 1;

  requestAnimationFrame(frame);
}

function toLogical(e) {
  const rect = canvas.getBoundingClientRect();
  return { x: (e.clientX - rect.left) / rect.width * W, y: (e.clientY - rect.top) / rect.height * H };
}

function onMove(e) {
  const m = toLogical(e); let best = -1, bd = 1e9;
  placed.forEach((d, i) => { const dx = d.x - m.x, dy = d.y - m.y, dist = dx * dx + dy * dy; if (dist < bd) { bd = dist; best = i; } });
  const hit = best >= 0 && Math.sqrt(bd) <= (placed[best].baseR + 10);
  hovered = hit ? best : -1;
  canvas.style.cursor = hit ? 'pointer' : 'default';
  const tip = document.getElementById('tip');
  if (hit) {
    const d = placed[hovered], ph = PHASES[d.phase] || {};
    tip.innerHTML = `<div class="tip-name">${escapeHtml(d.canonical_name)}</div>
      <div class="tip-row"><span style="color:${ph.color}">●</span> ${escapeHtml(ph.label || d.phase)}</div>
      <div class="tip-grid"><span>скорость</span><b>${(Number(d.velocity) || 0).toFixed(2)}</b>
      <span>уверенность</span><b>${Math.round((Number(d.confidence) || 0) * 100)}%</b>
      <span>статьи</span><b>${d.recent_papers ?? 0}/${d.total_papers ?? 0}</b></div>`;
    tip.hidden = false;
    const pad = 14; let x = e.clientX + pad, y = e.clientY + pad;
    if (x + tip.offsetWidth > innerWidth) x = e.clientX - tip.offsetWidth - pad;
    if (y + tip.offsetHeight > innerHeight) y = e.clientY - tip.offsetHeight - pad;
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
  } else tip.hidden = true;
}
function onLeave() { hovered = -1; const tip = document.getElementById('tip'); if (tip) tip.hidden = true; }
function onClick() {
  if (hovered < 0) return;
  const d = placed[hovered];
  if (!d || !d.slug) return;
  if (compareMode) { toggleCompareSel(d); return; }
  window.location.href = `/concept.html?slug=${encodeURIComponent(d.slug)}`;
}

function toggleCompareSel(d) {
  const i = compareSel.findIndex(s => s.slug === d.slug);
  if (i >= 0) compareSel.splice(i, 1);
  else { if (compareSel.length >= 2) compareSel.shift(); compareSel.push({ slug: d.slug, name: d.canonical_name }); }
  updateCompareTray();
  if (compareSel.length === 2) openCompareModal(compareSel[0], compareSel[1]);
}

function wireSearch() {
  const q = document.getElementById('q'), go = document.getElementById('go');
  if (!q || !go) return;
  const submit = () => { const v = q.value.trim(); if (v) window.location.href = `/search.html?q=${encodeURIComponent(v)}`; };
  go.addEventListener('click', submit);
  q.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
}

function wireSwitcher() {
  const tabMap = document.getElementById('tab-map'), tabGraph = document.getElementById('tab-graph'), tabGap = document.getElementById('tab-gap'), tabFlow = document.getElementById('tab-flow');
  const panelMap = document.getElementById('stage-map'), panelGraph = document.getElementById('stage-graph'), panelGap = document.getElementById('stage-gap'), panelFlow = document.getElementById('stage-flow');
  const legMap = document.getElementById('legend-map'), legGraph = document.getElementById('legend-graph');
  if (!tabMap || !tabGraph) return;
  const setView = (v) => {
    panelMap.style.display = v === 'map' ? 'block' : 'none';
    panelGraph.style.display = v === 'graph' ? 'block' : 'none';
    if (panelGap) panelGap.style.display = v === 'gap' ? 'block' : 'none';
    if (panelFlow) panelFlow.style.display = v === 'flow' ? 'block' : 'none';
    // tier legend только для графа; фазовая легенда для map/gap/flow (всё окрашено по фазе)
    legMap.style.display = v === 'graph' ? 'none' : 'flex';
    legGraph.style.display = v === 'graph' ? 'flex' : 'none';
    tabMap.classList.toggle('on', v === 'map');
    tabGraph.classList.toggle('on', v === 'graph');
    if (tabGap) tabGap.classList.toggle('on', v === 'gap');
    if (tabFlow) tabFlow.classList.toggle('on', v === 'flow');
    if (v === 'graph') { mapVisible = false; initGraph(); }
    else { hideGraph(); }
    if (v === 'map') { mapVisible = true; resize(); } else { mapVisible = false; }
    if (v === 'gap') renderRealityGap();
    if (v === 'flow') renderPhaseFlow();
  };
  tabMap.addEventListener('click', () => setView('map'));
  tabGraph.addEventListener('click', () => setView('graph'));
  if (tabGap) tabGap.addEventListener('click', () => setView('gap'));
  if (tabFlow) tabFlow.addEventListener('click', () => setView('flow'));
}

function fmtMonth(d) {
  if (!d) return '';
  try { return new Date(d).toLocaleDateString('ru-RU', { year: 'numeric', month: 'short' }); } catch { return d; }
}
function phasePill(key) {
  const ph = PHASES[key] || { color: '#6B5E93', short: '—' };
  return `<span class="mv-pill" style="background:${ph.color}22;color:${ph.color}"><i></i>${ph.short}</span>`;
}
const CURATED = [
  'RAG против fine-tuning — что выбрать?', 'Будущее reasoning-моделей', 'Что угасает в 2026?',
  'Автономные кодинг-агенты: хайп или реальность?', 'Мультимодальные модели в 2026',
  'Векторные БД против графовых для RAG', 'Diffusion против autoregressive в генерации видео',
  'Стоит ли ставить на edge AI?', 'RLHF против DPO', 'Куда движется генерация изображений',
  'Function calling и tool use — зрелость', 'AI-агенты для бизнес-процессов', 'Что с генерацией музыки AI?',
  'Inference-оптимизация: главные подходы', 'Малые языковые модели против больших',
  'AI в кибербезопасности — тренды', 'Интерпретируемость моделей: прогресс', 'Робо-эдвайзеры в финансах',
  'Промышленное компьютерное зрение', 'Сегментация изображений: SAM и дальше', 'MLOps-платформы — что выбрать',
  'AI-скрининг резюме: риски', 'Генерация видео text-to-video в 2026', 'Что растёт быстрее всего в AI?',
  'Какие концепты вышли на плато?', 'Adversarial-атаки и защита моделей', 'Локальный запуск LLM на устройствах',
  'Агенты против пайплайнов: когда что', 'Будущее мультиагентных систем', 'Генеративный AI в дизайне',
  'Retrieval-augmented generation: ограничения', 'AI-копилоты для разработчиков', 'Длинный контекст против RAG',
  'Квантизация и сжатие моделей', 'Синтетические данные для обучения', 'Open-source против закрытых моделей',
  'Эмбеддинги: какие выбрать', 'Оценка качества LLM-ответов', 'Голосовые AI-ассистенты в 2026',
  'Тренды в обучении с подкреплением', 'Когда reasoning-модели окупаются', 'Генерация кода: лидеры и аутсайдеры',
  'Что переоценено в AI прямо сейчас?', 'Векторный поиск против полнотекстового', 'AI-агенты и безопасность',
];

function pickRandom(arr, n) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a.slice(0, n);
}

function fillSuggestions(queries, label) {
  const wrap = document.getElementById('try-chips'), lab = document.getElementById('try-l');
  if (!wrap) return;
  if (lab && label) lab.textContent = label;
  wrap.innerHTML = queries.map(q => `<button type="button" data-q="${escapeHtml(q)}">${escapeHtml(q)}</button>`).join('');
  wrap.querySelectorAll('button').forEach(b =>
    b.addEventListener('click', () => { const v = b.getAttribute('data-q'); if (v) window.location.href = `/search.html?q=${encodeURIComponent(v)}`; }));
}

async function renderSuggestions() {
  // мгновенно показываем curated (чипы никогда не пустые), затем апгрейдим до реальных запросов
  fillSuggestions(pickRandom(CURATED, 4), 'Попробуйте:');
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/julia_public_recent_queries`, {
      method: 'POST',
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_limit: 8 }),
    });
    if (!res.ok) return;
    const rows = await res.json();
    if (!Array.isArray(rows)) return;
    const qs = rows.map(r => (r.query || '').trim()).filter(q => q.length >= 4 && q.length <= 120);
    const uniq = [...new Set(qs)];
    if (uniq.length >= 3) fillSuggestions(uniq.slice(0, 4), 'Сейчас спрашивают:');
  } catch (_) { /* остаёмся на curated */ }
}
function renderTrending(rows) {
  const el = document.getElementById('trend-chips'); if (!el) return;
  const vel = r => Number(r.velocity) || 0;
  const recent = r => Number(r.recent_papers) || 0;
  const byHeat = (a, b) => vel(b) - vel(a) || recent(b) - recent(a);
  // «на пике»: сначала фаза peak, затем slope (восхождение), затем растущие.
  // НЕ по модулю velocity — иначе наверх лезут падающие и шум малых выборок.
  const peak = rows.filter(r => r.phase === 'peak').sort(byHeat);
  const slope = rows.filter(r => r.phase === 'slope').sort(byHeat);
  const rising = rows.filter(r => vel(r) > 0).sort(byHeat);
  const seen = new Set(), top = [];
  for (const r of [...peak, ...slope, ...rising]) {
    if (seen.has(r.slug)) continue;
    seen.add(r.slug); top.push(r);
    if (top.length === 4) break;
  }
  el.innerHTML = top.map(r => {
    const ph = PHASES[r.phase] || { color: '#C084FC' };
    return `<a class="trend-chip" href="/concept.html?slug=${encodeURIComponent(r.slug)}"><i style="background:${ph.color};box-shadow:0 0 8px ${ph.color}"></i>${escapeHtml(r.canonical_name)}</a>`;
  }).join('');
}
async function renderMovers() {
  const el = document.getElementById('movers'); if (!el) return;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/julia_public_movers`, {
      method: 'POST',
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_limit: 6 }),
    });
    if (!res.ok) return;
    const rows = await res.json();
    if (!Array.isArray(rows) || !rows.length) return;
    el.innerHTML = rows.map(m => `
      <a class="mv-card" href="/concept.html?slug=${encodeURIComponent(m.slug)}">
        <div class="mv-name">${escapeHtml(m.canonical_name)}</div>
        <div class="mv-trans">${phasePill(m.from_phase)}<span class="mv-arr">→</span>${phasePill(m.to_phase)}</div>
        <div class="mv-meta">${fmtMonth(m.transition_month)} · скорость ${(Number(m.velocity) || 0).toFixed(2)}</div>
      </a>`).join('');
  } catch (_) { /* movers optional */ }
}

const SOURCE_LABEL = {
  aiworldjournal: 'AI World Journal', venturebeat: 'VentureBeat', techcrunch_ai: 'TechCrunch',
  crunchbase: 'Crunchbase', habr: 'Habr', vc_ru: 'vc.ru', hn: 'Hacker News', a16z: 'a16z',
};
function prettySource(s) { return SOURCE_LABEL[s] || s; }
function safeUrl(u) { return (typeof u === 'string' && /^https?:\/\//i.test(u)) ? u : '#'; }
function relTime(iso) {
  if (!iso) return '';
  const d = new Date(iso); if (isNaN(d.getTime())) return '';
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 0) return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  if (diff < 3600) return `${Math.max(1, Math.round(diff / 60))} мин назад`;
  if (diff < 86400) return `${Math.round(diff / 3600)} ч назад`;
  if (diff < 7 * 86400) return `${Math.round(diff / 86400)} дн назад`;
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

function addMoreToggle(container, moreSelector, hiddenCount, displayVal) {
  const host = container.parentElement || container;
  const old = host.querySelector('.more-toggle');
  if (old) old.remove();
  if (hiddenCount < 1) return;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'more-toggle';
  const label = `Показать ещё ${hiddenCount}`;
  btn.textContent = label;
  let open = false;
  btn.addEventListener('click', () => {
    open = !open;
    container.querySelectorAll(moreSelector).forEach(el => { el.style.display = open ? displayVal : 'none'; });
    btn.textContent = open ? 'Свернуть' : label;
  });
  host.appendChild(btn);
}

async function renderNews() {
  const el = document.getElementById('news'); if (!el) return;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/julia_public_news`, {
      method: 'POST',
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_limit: 9 }),
    });
    if (!res.ok) return;
    const rows = await res.json();
    if (!Array.isArray(rows) || !rows.length) return;
    el.innerHTML = rows.map((n, i) => `
      <a class="nw-card${i >= 3 ? ' nw-more' : ''}" href="${escapeHtml(safeUrl(n.url))}" target="_blank" rel="noopener noreferrer">
        <div class="nw-top">
          <span class="nw-src">${escapeHtml(prettySource(n.source_name))}</span>
          <span class="nw-lang">${escapeHtml((n.language || '').toUpperCase())}</span>
        </div>
        <div class="nw-title">${escapeHtml(n.title)}</div>
        ${n.excerpt ? `<div class="nw-excerpt">${escapeHtml(n.excerpt)}</div>` : ''}
        <div class="nw-date">${escapeHtml(relTime(n.published_at))}</div>
      </a>`).join('');
    addMoreToggle(el, '.nw-more', rows.length - 3, 'flex');
  } catch (_) { /* news optional */ }
}

async function renderFreshConcepts() {
  const sec = document.getElementById('fresh');
  const grid = document.getElementById('fresh-grid');
  if (!sec || !grid) return;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/julia_public_fresh_concepts`, {
      method: 'POST',
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_limit: 8 }),
    });
    if (!res.ok) return;
    const rows = await res.json();
    if (!Array.isArray(rows) || !rows.length) return;
    grid.innerHTML = rows.map(c => `
      <a class="fr-card" href="/concept.html?slug=${encodeURIComponent(c.slug)}">
        <div class="fr-name">${escapeHtml(c.canonical_name)}</div>
        ${phasePill(c.phase)}
        ${c.short_description ? `<div class="fr-desc">${escapeHtml(c.short_description)}</div>` : ''}
      </a>`).join('');
    sec.style.display = '';
  } catch (_) { /* fresh concepts optional */ }
}

async function renderDigest() {
  const sec = document.getElementById('digest');
  const list = document.getElementById('digest-list');
  const upd = document.getElementById('digest-upd');
  if (!sec || !list) return;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/julia_public_news_digest`, {
      method: 'POST',
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}`, 'Content-Type': 'application/json' },
      body: '{}',
    });
    if (!res.ok) return;
    const rows = await res.json();
    const d = Array.isArray(rows) ? rows[0] : rows;
    if (!d || !Array.isArray(d.themes) || !d.themes.length) return;
    list.innerHTML = d.themes.map((t, i) => `
      <div class="dg-item${i > 0 ? ' dg-more' : ''}">
        <div class="dg-title">${escapeHtml(t.title || '')}</div>
        <div class="dg-blurb">${escapeHtml(t.blurb || '')}</div>
        ${Array.isArray(t.sources) && t.sources.length ? `<div class="dg-src">${t.sources.map(s =>
          `<a href="${escapeHtml(safeUrl(s.url))}" target="_blank" rel="noopener noreferrer">${escapeHtml(prettySource(s.source_name))}</a>`
        ).join('')}</div>` : ''}
      </div>`).join('');
    addMoreToggle(list, '.dg-more', d.themes.length - 1, 'block');
    if (upd && d.generated_at) upd.textContent = `обновлено ${relTime(d.generated_at)}`;
    sec.style.display = '';
  } catch (_) { /* digest optional */ }
}

async function renderRealityGap() {
  const wrap = document.getElementById('gap-wrap');
  if (!wrap || wrap.dataset.rendered) return;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/julia_public_reality_gap`, {
      method: 'POST',
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_limit: 300 }),
    });
    if (!res.ok) return;
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length < 3) return;
    const pts = rows.map(r => ({
      slug: r.slug, name: r.canonical_name, phase: r.phase,
      v: Math.max(-1, Math.min(1, Number(r.velocity) || 0)),
      a: Number(r.adoption), stage: r.adoption_stage || '',
    })).filter(p => isFinite(p.a));
    if (pts.length < 3) return;

    const W = 760, H = 480, ml = 60, mr = 24, mt = 30, mb = 46;
    const x0 = ml, x1 = W - mr, y0 = mt, y1 = H - mb;
    const aMin = 0.15, aMax = 0.80;
    const ax = a => x0 + (Math.max(aMin, Math.min(aMax, a)) - aMin) / (aMax - aMin) * (x1 - x0);
    const vy = v => y0 + (1 - v) / 2 * (y1 - y0);
    const sorted = pts.map(p => p.a).sort((m, n) => m - n);
    const aMed = sorted[Math.floor(sorted.length / 2)];
    const xMed = ax(aMed), yZero = vy(0);
    const phaseColor = ph => (PHASES[ph] && PHASES[ph].color) || '#6B5E93';

    const circles = pts.map(p => {
      const cx = ax(p.a).toFixed(1), cy = vy(p.v).toFixed(1), col = phaseColor(p.phase);
      return `<a href="/concept.html?slug=${encodeURIComponent(p.slug)}"><circle class="gap-pt" cx="${cx}" cy="${cy}" r="5.5" fill="${col}" fill-opacity="0.82" stroke="${col}" stroke-opacity="0.4"><title>${escapeHtml(p.name)} — внедрение ${p.a.toFixed(2)}, скорость ${p.v.toFixed(2)}${p.stage ? ' • ' + escapeHtml(p.stage) : ''}</title></circle></a>`;
    }).join('');

    const txt = (x, y, s, anchor, op) => `<text x="${x}" y="${y}" fill="var(--muted)" font-family="Inter,sans-serif" font-size="12" text-anchor="${anchor}" opacity="${op}">${s}</text>`;
    const cy2 = ((y0 + y1) / 2).toFixed(1);

    wrap.innerHTML = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Разрыв наука-внедрение">
      <line x1="${x0}" y1="${yZero.toFixed(1)}" x2="${x1}" y2="${yZero.toFixed(1)}" stroke="var(--border)" stroke-dasharray="4 4"/>
      <line x1="${xMed.toFixed(1)}" y1="${y0}" x2="${xMed.toFixed(1)}" y2="${y1}" stroke="var(--border)" stroke-dasharray="4 4"/>
      <rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" fill="none" stroke="var(--border)"/>
      ${txt(x0 + 10, y0 + 18, 'Наука впереди внедрения', 'start', '0.5')}
      ${txt(x1 - 10, y1 - 12, 'Внедрены · наука остывает', 'end', '0.5')}
      ${txt(x1 - 10, y0 + 18, 'Горячие', 'end', '0.32')}
      ${txt(x0 + 10, y1 - 12, 'Нишевые / угасают', 'start', '0.32')}
      ${txt((x0 + x1) / 2, H - 14, 'Внедрение (adoption) →', 'middle', '0.7')}
      <text x="18" y="${cy2}" fill="var(--muted)" font-family="Inter,sans-serif" font-size="12" text-anchor="middle" opacity="0.7" transform="rotate(-90 18 ${cy2})">← скорость науки →</text>
      ${circles}
    </svg>`;
    wrap.dataset.rendered = '1';
  } catch (_) { /* reality-gap optional */ }
}

async function renderPhaseFlow() {
  const wrap = document.getElementById('flow-wrap');
  if (!wrap || wrap.dataset.rendered) return;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/julia_public_phase_flow`, {
      method: 'POST',
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}`, 'Content-Type': 'application/json' },
      body: '{}',
    });
    if (!res.ok) return;
    const rows = await res.json();
    if (!Array.isArray(rows) || !rows.length) return;

    const ORD = ['trigger', 'peak', 'trough', 'slope', 'plateau'];
    const phName = ph => (PHASES[ph] && PHASES[ph].short) || ph;
    const phColor = ph => (PHASES[ph] && PHASES[ph].color) || '#6B5E93';

    // sort: by origin phase, then destination phase, then name → tidy stacking
    rows.sort((a, b) =>
      ORD.indexOf(a.from_phase) - ORD.indexOf(b.from_phase) ||
      ORD.indexOf(a.to_phase) - ORD.indexOf(b.to_phase) ||
      String(a.name).localeCompare(String(b.name)));

    const leftTot = {}, rightTot = {};
    rows.forEach(r => { leftTot[r.from_phase] = (leftTot[r.from_phase] || 0) + 1; rightTot[r.to_phase] = (rightTot[r.to_phase] || 0) + 1; });
    const total = rows.length;
    const leftPhases = ORD.filter(p => leftTot[p]);
    const rightPhases = ORD.filter(p => rightTot[p]);

    const W = 760, H = 480, padY = 22, nodeW = 14, ml = 84, gap = 14;
    const leftX = ml, rightX = W - ml - nodeW;
    const colH = H - 2 * padY;
    const maxNodes = Math.max(leftPhases.length, rightPhases.length);
    const vScale = (colH - (maxNodes - 1) * gap) / total;   // px per concept

    const place = (phases, totals) => {
      const pos = {}; let y = padY;
      phases.forEach(p => { const h = totals[p] * vScale; pos[p] = { y0: y, h }; y += h + gap; });
      return pos;
    };
    const L = place(leftPhases, leftTot), R = place(rightPhases, rightTot);
    const lOff = {}, rOff = {};
    leftPhases.forEach(p => lOff[p] = 0);
    rightPhases.forEach(p => rOff[p] = 0);

    const x0 = leftX + nodeW, x1 = rightX, xc = (x0 + x1) / 2;
    const strands = rows.map(r => {
      const th = vScale;
      const yA = L[r.from_phase].y0 + lOff[r.from_phase];
      const yB = R[r.to_phase].y0 + rOff[r.to_phase];
      lOff[r.from_phase] += th; rOff[r.to_phase] += th;
      const col = phColor(r.to_phase);
      const d = `M${x0} ${yA.toFixed(1)} C${xc} ${yA.toFixed(1)}, ${xc} ${yB.toFixed(1)}, ${x1} ${yB.toFixed(1)} L${x1} ${(yB + th).toFixed(1)} C${xc} ${(yB + th).toFixed(1)}, ${xc} ${(yA + th).toFixed(1)}, ${x0} ${(yA + th).toFixed(1)} Z`;
      const moved = r.from_phase === r.to_phase ? '' : ` (${phName(r.from_phase)}→${phName(r.to_phase)})`;
      return `<a href="/concept.html?slug=${encodeURIComponent(r.slug)}"><path class="flow-strand" d="${d}" fill="${col}" fill-opacity="0.5"><title>${escapeHtml(r.name)}${moved}</title></path></a>`;
    }).join('');

    const nodes = (phases, pos, x, labelX, anchor, totals) => phases.map(p => {
      const col = phColor(p), nd = pos[p];
      return `<rect x="${x}" y="${nd.y0.toFixed(1)}" width="${nodeW}" height="${Math.max(2, nd.h).toFixed(1)}" rx="3" fill="${col}"/>
        <text x="${labelX}" y="${(nd.y0 + nd.h / 2).toFixed(1)}" fill="var(--text)" font-family="Inter,sans-serif" font-size="12.5" dominant-baseline="middle" text-anchor="${anchor}">${phName(p)} <tspan fill="var(--muted)">${totals[p]}</tspan></text>`;
    }).join('');

    wrap.innerHTML = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Поток концептов по фазам">
      ${strands}
      ${nodes(leftPhases, L, leftX, leftX - 8, 'end', leftTot)}
      ${nodes(rightPhases, R, rightX, rightX + nodeW + 8, 'start', rightTot)}
      <text x="${leftX - 8}" y="12" fill="var(--muted)" font-family="Inter,sans-serif" font-size="10.5" letter-spacing="0.06em" text-anchor="end">ОТКУДА</text>
      <text x="${rightX + nodeW + 8}" y="12" fill="var(--muted)" font-family="Inter,sans-serif" font-size="10.5" letter-spacing="0.06em" text-anchor="start">ГДЕ СЕЙЧАС</text>
    </svg>`;
    wrap.dataset.rendered = '1';
  } catch (_) { /* flow optional */ }
}

function wireCompare() {
  const btn = document.getElementById('cmp-toggle');
  if (btn) btn.addEventListener('click', () => {
    compareMode = !compareMode;
    compareSel = [];
    btn.classList.toggle('on', compareMode);
    btn.textContent = compareMode ? '✕ Выйти' : '⚖ Сравнить';
    updateCompareTray();
  });
  const close = document.getElementById('cmp-close'), backdrop = document.getElementById('cmp-backdrop');
  if (close) close.addEventListener('click', closeCompareModal);
  if (backdrop) backdrop.addEventListener('click', closeCompareModal);
}

function updateCompareTray() {
  const tray = document.getElementById('cmp-tray');
  if (!tray) return;
  if (!compareMode) { tray.hidden = true; tray.innerHTML = ''; return; }
  tray.hidden = false;
  const chips = compareSel.map(s => `<span class="cmp-chip">${escapeHtml(s.name)}</span>`).join('');
  tray.innerHTML = `<span class="cmp-hint">Кликни 2 концепта на карте</span>${chips}`;
}

function closeCompareModal() {
  const modal = document.getElementById('compare-modal');
  if (modal) modal.hidden = true;
  compareSel = [];
  updateCompareTray();
}

async function openCompareModal(a, b) {
  const modal = document.getElementById('compare-modal'), body = document.getElementById('cmp-body');
  if (!modal || !body) return;
  modal.hidden = false;
  body.innerHTML = '<div class="cmp-loading">Сравниваю…</div>';
  const call = (fn, slug) => fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_slug: slug }),
  }).then(r => r.ok ? r.json() : null).then(x => Array.isArray(x) ? x[0] : x).catch(() => null);
  try {
    const [ca, sa, aa, cb, sb, ab] = await Promise.all([
      call('julia_public_concept', a.slug), call('julia_public_signals', a.slug), call('julia_public_adoption', a.slug),
      call('julia_public_concept', b.slug), call('julia_public_signals', b.slug), call('julia_public_adoption', b.slug),
    ]);
    if (!ca || !cb) { body.innerHTML = '<div class="cmp-loading">Не удалось загрузить данные.</div>'; return; }
    body.innerHTML = renderCompare({ c: ca, s: sa, a: aa, name: a.name }, { c: cb, s: sb, a: ab, name: b.name });
  } catch (_) {
    body.innerHTML = '<div class="cmp-loading">Ошибка сравнения.</div>';
  }
}

function renderCompare(A, B) {
  const PH = ph => (PHASES[ph] && PHASES[ph].label) || '—';
  const phc = ph => (PHASES[ph] && PHASES[ph].color) || '#6B5E93';
  const num = v => (v == null || !isFinite(Number(v))) ? '—' : v;
  const vel = c => { const v = Number(c.velocity) || 0; return `${v > 0 ? '+' : ''}${Math.round(v * 100)}%`; };
  const adopt = a => (a && a.composite_adoption_score != null) ? `${Math.round(Number(a.composite_adoption_score) * 100)}% · ${a.adoption_stage || '—'}` : '—';
  const usd = n => { n = Number(n) || 0; if (!n) return '—'; if (n >= 1e9) return '$' + (n / 1e9).toFixed(1) + 'B'; if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M'; if (n >= 1e3) return '$' + (n / 1e3).toFixed(0) + 'k'; return '$' + n; };
  const rows = [
    ['Фаза', `<span style="color:${phc(A.c.phase)}">${PH(A.c.phase)}</span>`, `<span style="color:${phc(B.c.phase)}">${PH(B.c.phase)}</span>`],
    ['Импульс (г/г)', vel(A.c), vel(B.c)],
    ['Свежие статьи', num(A.s && A.s.recent_papers), num(B.s && B.s.recent_papers)],
    ['Внедрение', adopt(A.a), adopt(B.a)],
    ['Патенты · 180д', num(A.a && A.a.patent_filings_180d), num(B.a && B.a.patent_filings_180d)],
    ['Финансирование', usd(A.a && A.a.total_funding_usd), usd(B.a && B.a.total_funding_usd)],
    ['Вакансии · 30д', num(A.a && A.a.hiring_mentions_30d), num(B.a && B.a.hiring_mentions_30d)],
  ];
  return `<table class="cmp-table">
      <thead><tr><th></th><th>${escapeHtml(A.name)}</th><th>${escapeHtml(B.name)}</th></tr></thead>
      <tbody>${rows.map(r => `<tr><th>${r[0]}</th><td>${r[1]}</td><td>${r[2]}</td></tr>`).join('')}</tbody>
    </table>
    <div class="cmp-verdict"><span class="verdict-ic">💡</span><span>${escapeHtml(compareVerdict(A, B))}</span></div>`;
}

function compareVerdict(A, B) {
  const ad = x => (x.a && x.a.composite_adoption_score != null) ? Number(x.a.composite_adoption_score) : 0;
  const adA = ad(A), adB = ad(B), vA = Number(A.c.velocity) || 0, vB = Number(B.c.velocity) || 0;
  const mature = adA === adB ? null : (adA > adB ? A : B);
  const faster = vA === vB ? null : (vA > vB ? A : B);
  if (mature && faster && mature === faster) return `${mature.name} впереди и по зрелости, и по импульсу — явный фаворит.`;
  if (mature && faster) return `${mature.name} зрелее — внедрять сейчас; ${faster.name} разгоняется быстрее — ранняя ставка.`;
  if (mature) return `${mature.name} ближе к внедрению; по импульсу — паритет.`;
  if (faster) return `${faster.name} разгоняется быстрее; по зрелости — паритет.`;
  return 'Концепты сопоставимы по зрелости и импульсу.';
}

function setStats(count, updated) {
  const c = document.getElementById('stat-count'), u = document.getElementById('stat-updated');
  if (c) c.textContent = count;
  if (u) u.textContent = updated ? new Date(updated).toLocaleDateString('ru-RU') : '—';
}

async function fetchHype() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/julia_public_hype`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_include_unknown: false }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

(async function init() {
  reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  canvas = document.getElementById('map');
  ctx = canvas.getContext('2d');
  wireSearch();
  wireSwitcher();
  renderSuggestions();
  wireCompare();
  renderMovers();
  renderNews();
  renderDigest();
  renderFreshConcepts();
  resize();
  window.addEventListener('resize', () => { if (mapVisible) resize(); });
  canvas.addEventListener('mousemove', onMove);
  canvas.addEventListener('mouseleave', onLeave);
  canvas.addEventListener('click', onClick);
  requestAnimationFrame(frame);

  if (!SUPABASE_URL || !ANON_KEY) { setStats('—', null); return; }
  try {
    const rows = await fetchHype();
    placed = layout(rows);
    intro = 0;
    const updated = rows.map(r => r.updated_at).filter(Boolean).sort().pop();
    setStats(rows.length, updated);
    renderTrending(rows);
  } catch (_) { setStats('—', null); }
})();
