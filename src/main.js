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
function onClick() { if (hovered >= 0) { const d = placed[hovered]; if (d.slug) window.location.href = `/concept.html?slug=${encodeURIComponent(d.slug)}`; } }

function wireSearch() {
  const q = document.getElementById('q'), go = document.getElementById('go');
  if (!q || !go) return;
  const submit = () => { const v = q.value.trim(); if (v) window.location.href = `/search.html?q=${encodeURIComponent(v)}`; };
  go.addEventListener('click', submit);
  q.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
}

function wireSwitcher() {
  const tabMap = document.getElementById('tab-map'), tabGraph = document.getElementById('tab-graph');
  const panelMap = document.getElementById('stage-map'), panelGraph = document.getElementById('stage-graph');
  const legMap = document.getElementById('legend-map'), legGraph = document.getElementById('legend-graph');
  if (!tabMap || !tabGraph) return;
  const setView = (v) => {
    const graph = v === 'graph';
    panelMap.style.display = graph ? 'none' : 'block';
    panelGraph.style.display = graph ? 'block' : 'none';
    legMap.style.display = graph ? 'none' : 'flex';
    legGraph.style.display = graph ? 'flex' : 'none';
    tabMap.classList.toggle('on', !graph);
    tabGraph.classList.toggle('on', graph);
    if (graph) { mapVisible = false; initGraph(); }
    else { hideGraph(); mapVisible = true; resize(); }
  };
  tabMap.addEventListener('click', () => setView('map'));
  tabGraph.addEventListener('click', () => setView('graph'));
}

function fmtMonth(d) {
  if (!d) return '';
  try { return new Date(d).toLocaleDateString('ru-RU', { year: 'numeric', month: 'short' }); } catch { return d; }
}
function phasePill(key) {
  const ph = PHASES[key] || { color: '#6B5E93', short: '—' };
  return `<span class="mv-pill" style="background:${ph.color}22;color:${ph.color}"><i></i>${ph.short}</span>`;
}
function wireTry() {
  document.querySelectorAll('.try button').forEach(b =>
    b.addEventListener('click', () => { const v = b.getAttribute('data-q'); if (v) window.location.href = `/search.html?q=${encodeURIComponent(v)}`; }));
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
  wireTry();
  renderMovers();
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
