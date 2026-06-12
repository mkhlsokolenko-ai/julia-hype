// src/graph.js — Граф связей концептов (canvas, своя физика). Креды из env.

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const TIER_COLOR = { T: '#C084FC', P: '#F0ABFC', I: '#FB923C' };
const TIER_LABEL = { T: 'Технология', P: 'Парадигма', I: 'Инфраструктура' };
const PHASE_RU = { trigger: 'Триггер', peak: 'Пик', trough: 'Дно', slope: 'Склон', plateau: 'Плато', unknown: '—' };
function tierColor(t) { return TIER_COLOR[t] || '#8B7FB0'; }

const GW = 1000, GH = 640;

let canvas, ctx, dpr = 1, cssW = GW, cssH = GH;
let nodes = [], edges = [], bySlug = new Map();
let hovered = null, dragging = null, downNode = null, moved = false;
let visible = false, started = false, inited = false, alpha = 1;
let view = { scale: 1, ox: 0, oy: 0 }, panning = false, lastV = { x: 0, y: 0 };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function esc(s) { return String(s ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])); }

async function rpc(fn) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}`, 'Content-Type': 'application/json' },
    body: '{}',
  });
  if (!r.ok) throw new Error(`${fn} ${r.status}`);
  return r.json();
}

function resize() {
  const rect = canvas.parentElement.getBoundingClientRect();
  cssW = Math.max(320, rect.width - 28);
  cssH = Math.min(680, Math.max(420, cssW * GH / GW));
  dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.style.width = cssW + 'px';
  canvas.style.height = cssH + 'px';
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
}

function build(nodeRows, edgeRows) {
  const have = new Set(nodeRows.map(n => n.slug));
  const valid = edgeRows.filter(e => have.has(e.from_slug) && have.has(e.to_slug));
  const used = new Set();
  valid.forEach(e => { used.add(e.from_slug); used.add(e.to_slug); });
  nodes = nodeRows.filter(n => used.has(n.slug)).map(n => ({
    slug: n.slug, name: n.canonical_name, tier: n.tier, phase: n.phase,
    r: 5 + Math.min(10, (Number(n.recent_papers) || 0) / 12),
    x: GW / 2 + (Math.random() - 0.5) * 420, y: GH / 2 + (Math.random() - 0.5) * 320,
    vx: 0, vy: 0, deg: 0,
  }));
  bySlug = new Map(nodes.map(n => [n.slug, n]));
  edges = valid
    .map(e => ({ a: bySlug.get(e.from_slug), b: bySlug.get(e.to_slug), type: e.relation_type, conf: Number(e.confidence) || 0 }))
    .filter(e => e.a && e.b);
  edges.forEach(e => { e.a.deg++; e.b.deg++; });
  alpha = 1;
}

function tick() {
  for (let i = 0; i < nodes.length; i++) {
    const a = nodes[i];
    for (let j = i + 1; j < nodes.length; j++) {
      const b = nodes[j];
      const dx = a.x - b.x, dy = a.y - b.y;
      const d2 = dx * dx + dy * dy || 1, d = Math.sqrt(d2);
      const rep = 2200 / d2 * alpha;
      const fx = dx / d * rep, fy = dy / d * rep;
      a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy;
    }
    a.vx += (GW / 2 - a.x) * 0.0008 * alpha;
    a.vy += (GH / 2 - a.y) * 0.0008 * alpha;
  }
  edges.forEach(e => {
    const dx = e.b.x - e.a.x, dy = e.b.y - e.a.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
    const f = (d - 95) * 0.01 * alpha;
    const fx = dx / d * f, fy = dy / d * f;
    e.a.vx += fx; e.a.vy += fy; e.b.vx -= fx; e.b.vy -= fy;
  });
  nodes.forEach(n => {
    if (n === dragging) return;
    n.vx *= 0.85; n.vy *= 0.85;
    n.x += n.vx; n.y += n.vy;
    n.x = Math.max(24, Math.min(GW - 24, n.x));
    n.y = Math.max(24, Math.min(GH - 24, n.y));
  });
  if (alpha > 0.04) alpha *= 0.992;
}

function neighbors(node) {
  const set = new Set();
  edges.forEach(e => { if (e.a === node) set.add(e.b); if (e.b === node) set.add(e.a); });
  return set;
}

function frame() {
  if (!visible) { requestAnimationFrame(frame); return; }
  tick();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(cssW / GW * dpr, 0, 0, cssH / GH * dpr, 0, 0);
  ctx.translate(view.ox, view.oy);
  ctx.scale(view.scale, view.scale);
  const nb = hovered ? neighbors(hovered) : null;

  edges.forEach(e => {
    const hot = hovered && (e.a === hovered || e.b === hovered);
    ctx.strokeStyle = hot ? 'rgba(192,132,252,0.75)' : (hovered ? 'rgba(150,130,200,0.07)' : 'rgba(150,130,200,0.17)');
    ctx.lineWidth = hot ? 1.8 : 1;
    ctx.beginPath(); ctx.moveTo(e.a.x, e.a.y); ctx.lineTo(e.b.x, e.b.y); ctx.stroke();
  });

  nodes.forEach(n => {
    const dim = hovered && n !== hovered && !(nb && nb.has(n));
    const col = tierColor(n.tier);
    ctx.globalAlpha = dim ? 0.22 : 1;
    ctx.shadowColor = col; ctx.shadowBlur = dim ? 0 : (n === hovered ? 16 : 7);
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(n.x, n.y, n.r * (n === hovered ? 1.4 : 1), 0, 7); ctx.fill();
    ctx.shadowBlur = 0;
    const showLabel = hovered ? (n === hovered || (nb && nb.has(n))) : true;
    if (!dim && showLabel) {
      ctx.globalAlpha = n === hovered ? 1 : 0.72;
      ctx.fillStyle = '#E9E3FF';
      ctx.font = `${n === hovered ? '600 12px' : '500 10px'} Inter, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(n.name, n.x, n.y - n.r - 5);
    }
  });
  ctx.globalAlpha = 1;
  requestAnimationFrame(frame);
}

function toView(e) {
  const rect = canvas.getBoundingClientRect();
  return { x: (e.clientX - rect.left) / rect.width * GW, y: (e.clientY - rect.top) / rect.height * GH };
}
function toWorld(e) {
  const v = toView(e);
  return { x: (v.x - view.ox) / view.scale, y: (v.y - view.oy) / view.scale };
}
function pick(m) {
  let best = null, bd = 1e9;
  nodes.forEach(n => { const dx = n.x - m.x, dy = n.y - m.y, d = dx * dx + dy * dy; if (d < bd) { bd = d; best = n; } });
  return best && Math.sqrt(bd) <= best.r + 7 / view.scale ? best : null;
}
function updateTip(e, n) {
  const tip = document.getElementById('tip');
  if (!tip) return;
  if (!n) { tip.hidden = true; return; }
  tip.innerHTML = `<div class="tip-name">${esc(n.name)}</div>
    <div class="tip-row"><span style="color:${tierColor(n.tier)}">●</span> ${TIER_LABEL[n.tier] || '—'} · фаза ${PHASE_RU[n.phase] || '—'}</div>
    <div class="tip-grid"><span>связей</span><b>${n.deg}</b></div>`;
  tip.hidden = false;
  const pad = 14; let x = e.clientX + pad, y = e.clientY + pad;
  if (x + tip.offsetWidth > innerWidth) x = e.clientX - tip.offsetWidth - pad;
  if (y + tip.offsetHeight > innerHeight) y = e.clientY - tip.offsetHeight - pad;
  tip.style.left = x + 'px'; tip.style.top = y + 'px';
}

function bindPointer() {
  canvas.addEventListener('mousemove', (e) => {
    if (dragging) {
      const w = toWorld(e);
      dragging.x = w.x; dragging.y = w.y; dragging.vx = 0; dragging.vy = 0;
      alpha = Math.max(alpha, 0.5); moved = true; updateTip(e, dragging); return;
    }
    if (panning) {
      const v = toView(e);
      view.ox += v.x - lastV.x; view.oy += v.y - lastV.y; lastV = v;
      const tip = document.getElementById('tip'); if (tip) tip.hidden = true; return;
    }
    const n = pick(toWorld(e));
    hovered = n;
    canvas.style.cursor = n ? 'pointer' : 'grab';
    updateTip(e, n);
  });
  canvas.addEventListener('mousedown', (e) => {
    const n = pick(toWorld(e)); downNode = n; moved = false;
    if (n) { dragging = n; }
    else { panning = true; lastV = toView(e); canvas.style.cursor = 'grabbing'; }
  });
  canvas.addEventListener('mouseup', () => {
    if (dragging && !moved && downNode && downNode.slug) window.location.href = `/concept.html?slug=${encodeURIComponent(downNode.slug)}`;
    dragging = null; downNode = null; panning = false;
    canvas.style.cursor = 'grab';
  });
  canvas.addEventListener('mouseleave', () => {
    hovered = null; dragging = null; panning = false;
    const tip = document.getElementById('tip'); if (tip) tip.hidden = true;
  });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const v = toView(e);
    const wx = (v.x - view.ox) / view.scale, wy = (v.y - view.oy) / view.scale;
    const ns = clamp(view.scale * (e.deltaY < 0 ? 1.1 : 1 / 1.1), 0.4, 4);
    view.ox = v.x - wx * ns; view.oy = v.y - wy * ns; view.scale = ns;
  }, { passive: false });
  canvas.addEventListener('dblclick', () => { view = { scale: 1, ox: 0, oy: 0 }; alpha = Math.max(alpha, 0.3); });
}

export async function initGraph() {
  if (inited) { showGraph(); return; }
  inited = true;
  canvas = document.getElementById('graph');
  ctx = canvas.getContext('2d');
  bindPointer();
  window.addEventListener('resize', () => { if (visible) resize(); });
  resize();
  visible = true;
  if (!started) { started = true; requestAnimationFrame(frame); }
  try {
    const [nr, er] = await Promise.all([rpc('julia_public_nodes'), rpc('julia_public_edges')]);
    build(nr, er);
  } catch (_) { /* graph stays empty on failure; map view unaffected */ }
}

export function showGraph() { visible = true; resize(); alpha = Math.max(alpha, 0.3); }
export function hideGraph() { visible = false; const tip = document.getElementById('tip'); if (tip) tip.hidden = true; }
