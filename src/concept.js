// JULIA — concept detail page. Read-only, creds from env (no literals in source).

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const PHASES = {
  trigger: { color: '#94A3B8', label: 'Технологический триггер' },
  peak:    { color: '#FB923C', label: 'Пик завышенных ожиданий' },
  trough:  { color: '#F87171', label: 'Дно разочарования' },
  slope:   { color: '#60A5FA', label: 'Склон просветления' },
  plateau: { color: '#4ADE80', label: 'Плато продуктивности' },
  unknown: { color: '#6B5E93', label: 'Не классифицировано' },
};

const GREEN = '#4ADE80', AMBER = '#FBBF24', RED = '#F87171', PURPLE = '#C084FC';

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

function getSlug() {
  const q = new URLSearchParams(location.search).get('slug');
  if (q) return q;
  const seg = location.pathname.split('/').filter(Boolean);
  const last = seg[seg.length - 1];
  if (!last || last === 'concepts' || last === 'concept.html') return null;
  return decodeURIComponent(last);
}

async function rpc(fn, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${fn}: HTTP ${res.status}`);
  return res.json();
}

function fmtSince(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('ru-RU', { year: 'numeric', month: 'short' }); }
  catch { return d; }
}

function buildSignals(s) {
  const v = Number(s.velocity) || 0;
  const recent = Number(s.recent_papers) || 0;
  const prior = Number(s.prior_papers) || 0;
  const life = Number(s.total_papers_lifetime) || 0;
  const conf = Math.max(0, Math.min(1, Number(s.classification_confidence) || 0));

  return [
    {
      lbl: 'Скорость (год к году)',
      state: v > 0.3 ? 'ускоряется' : v > 0 ? 'растёт' : v < 0 ? 'спад' : 'ровно',
      val: `${v > 0 ? '+' : ''}${Math.round(v * 100)}%`,
      pct: Math.min(100, Math.abs(v * 100)),
      color: v > 0.3 ? GREEN : v > 0 ? AMBER : RED,
    },
    {
      lbl: 'Свежие публикации',
      state: recent > prior ? 'активность растёт' : recent < prior ? 'остывает' : 'стабильно',
      val: `${recent}`,
      pct: Math.min(100, recent),
      color: recent > prior ? GREEN : recent < prior ? AMBER : PURPLE,
    },
    {
      lbl: 'Объём публикаций (всего)',
      state: life > 200 ? 'зрелый корпус' : 'развивается',
      val: `${life}`,
      pct: Math.min(100, life / 5),
      color: PURPLE,
    },
    {
      lbl: 'Уверенность сигнала',
      state: conf > 0.5 ? 'высокая' : conf > 0.2 ? 'средняя' : 'низкая',
      val: `${Math.round(conf * 100)}%`,
      pct: conf * 100,
      color: conf > 0.5 ? GREEN : conf > 0.2 ? AMBER : RED,
    },
  ];
}

function fmtNum(n) {
  n = Number(n) || 0;
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k';
  return '' + n;
}
function fmtUSD(n) {
  n = Number(n) || 0;
  if (!n) return null;
  if (n >= 1e9) return '$' + (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return '$' + (n / 1e3).toFixed(0) + 'k';
  return '$' + n;
}
function stageColor(stage) {
  const s = (stage || '').toLowerCase();
  if (s.includes('mature')) return GREEN;
  if (s.includes('grow')) return AMBER;
  if (s.includes('emerg')) return '#60A5FA';
  if (s.includes('declin')) return RED;
  return PURPLE;
}
function buildAdoptionHtml(a) {
  if (!a) return '';
  const score = Math.max(0, Math.min(1, Number(a.composite_adoption_score) || 0));
  const sc = score > 0.6 ? GREEN : score > 0.3 ? AMBER : PURPLE;
  const stColor = stageColor(a.adoption_stage);
  const tiles = [];
  const push = (v, l, vel) => {
    if (!v) return;
    const velHtml = (vel != null && isFinite(vel))
      ? `<div class="stat-vel" style="color:${vel >= 0 ? GREEN : RED}">${vel >= 0 ? '+' : ''}${Math.round(vel)}%</div>` : '';
    tiles.push(`<div class="stat"><div class="stat-v">${esc(v)}</div><div class="stat-l">${esc(l)}</div>${velHtml}</div>`);
  };
  const stars = Number(a.github_stars_total) || 0;
  if (stars) push('★ ' + fmtNum(stars), 'GitHub звёзды', a.github_stars_velocity_pct);
  if (Number(a.hn_mentions_30d)) push(a.hn_mentions_30d, 'Hacker News · 30д');
  if (Number(a.habr_mentions_30d)) push(a.habr_mentions_30d, 'Habr · 30д');
  if (Number(a.news_mentions_30d)) push(a.news_mentions_30d, 'Новости · 30д');
  if (Number(a.patent_filings_180d)) push(a.patent_filings_180d, 'Патенты · 180д', a.patent_filings_velocity_pct);
  if (Number(a.hiring_mentions_30d)) push(a.hiring_mentions_30d, 'Вакансии · 30д');
  const fund = fmtUSD(a.total_funding_usd);
  if (fund) push(fund, 'Финансирование');

  return `
    <section class="section">
      <h2 class="section-h">🚀 Сигналы <span class="em">внедрения</span></h2>
      <div class="glass adopt-card">
        <div class="adopt-head">
          <span class="stage-badge" style="background:${stColor}22;color:${stColor};border:1px solid ${stColor}55">${esc(a.adoption_stage || '—')}</span>
          <div class="composite">
            <span class="composite-l">общий балл</span>
            <div class="composite-bar"><div style="width:${(score * 100).toFixed(0)}%;background:${sc};color:${sc}"></div></div>
            <span class="composite-val">${Math.round(score * 100)}%</span>
          </div>
        </div>
        ${tiles.length ? `<div class="adopt-grid">${tiles.join('')}</div>` : '<div class="adopt-empty">Компонентные сигналы пока пустые.</div>'}
        <div class="adopt-meta">снапшот ${esc(a.snapshot_date || '')}</div>
      </div>
    </section>`;
}

const TIERS = { T: '#C084FC', P: '#F0ABFC', I: '#FB923C' };
const PHASE_SHORT = { trigger: 'Триггер', peak: 'Пик', trough: 'Дно', slope: 'Склон', plateau: 'Плато', unknown: '—' };
function phaseShort(p) { return PHASE_SHORT[p] || '—'; }

function lineageNode(e) {
  const ph = PHASES[e.neighbor_phase] || PHASES.unknown;
  const tc = TIERS[e.neighbor_tier] || PURPLE;
  return `<a class="ln-node" href="/concept.html?slug=${encodeURIComponent(e.neighbor_slug)}">
    <span class="ln-tier" style="background:${tc};box-shadow:0 0 8px ${tc}"></span>
    <span class="ln-name">${esc(e.neighbor_name)}</span>
    <span class="ln-phase" style="color:${ph.color}">${phaseShort(e.neighbor_phase)}</span>
  </a>`;
}

function buildLineageHtml(edges, selfName) {
  if (!edges || !edges.length) return '';
  const parents = edges.filter(e => e.direction === 'parent');
  const children = edges.filter(e => e.direction === 'child');
  const seen = new Set();
  const related = [];
  edges.forEach(e => { if (e.neighbor_id && !seen.has(e.neighbor_id)) { seen.add(e.neighbor_id); related.push(e); } });

  const tree = `
    <section class="section">
      <h2 class="section-h">🧬 <span class="em">Родословная</span></h2>
      <div class="glass ft-card">
        ${parents.length ? `<div class="ft-block"><div class="ft-lbl">Произошёл от</div><div class="ft-row">${parents.map(lineageNode).join('')}<span class="ft-arrow">→</span><span class="ft-self">${esc(selfName)}</span></div></div>` : ''}
        ${children.length ? `<div class="ft-block"><div class="ft-lbl">Ведёт к</div><div class="ft-row"><span class="ft-self">${esc(selfName)}</span><span class="ft-arrow">→</span><div class="ft-children">${children.map(lineageNode).join('')}</div></div></div>` : ''}
      </div>
    </section>`;

  const rel = `
    <section class="section">
      <h2 class="section-h"><span class="em">Похожие</span> концепты</h2>
      <div class="related-grid">
        ${related.slice(0, 8).map(e => {
          const ph = PHASES[e.neighbor_phase] || PHASES.unknown;
          return `<a class="rc-card" href="/concept.html?slug=${encodeURIComponent(e.neighbor_slug)}"><div class="rc-name">${esc(e.neighbor_name)}</div><span class="rc-pill" style="background:${ph.color}22;color:${ph.color}"><span class="rc-dot" style="background:${ph.color}"></span>${phaseShort(e.neighbor_phase)}</span></a>`;
        }).join('')}
      </div>
    </section>`;

  return tree + rel;
}

function fmtMonth(d) {
  if (!d) return '';
  try { return new Date(d).toLocaleDateString('ru-RU', { year: 'numeric', month: 'short' }); }
  catch { return d; }
}

function buildJourneyHtml(hist) {
  if (!hist || !hist.length) return '';
  // Сырая история шумная (повторы/осцилляции, откаты в 'unknown').
  // Чистая траектория: выбрасываем 'unknown' (не фаза) + схлопываем подряд идущие дубли.
  const seq = [];
  hist.forEach(t => {
    if (t.to_phase === 'unknown') return;
    const last = seq[seq.length - 1];
    if (last && last.phase === t.to_phase) return;
    seq.push({ phase: t.to_phase, month: t.transition_month });
  });
  if (!seq.length) return '';
  const nodes = seq.map((st, i) => {
    const ph = PHASES[st.phase] || PHASES.unknown;
    const current = i === seq.length - 1;
    return `<div class="tl-step${current ? ' current' : ''}">
      <div class="tl-month">${fmtMonth(st.month)}</div>
      <div class="tl-dot" style="background:${ph.color};box-shadow:0 0 14px ${ph.color}"></div>
      <div class="tl-phase" style="color:${ph.color}">${phaseShort(st.phase)}${current ? ' · сейчас' : ''}</div>
    </div>`;
  }).join('<div class="tl-conn"></div>');
  return `
    <section class="section">
      <h2 class="section-h">📈 Путь <span class="em">по фазам</span></h2>
      <div class="glass tl-card"><div class="tl-row">${nodes}</div></div>
    </section>`;
}

function render(c, s, a, l, h) {
  const ph = PHASES[c.phase] || PHASES.unknown;
  const v = Number(c.velocity) || 0;
  const sigs = s ? buildSignals(s) : null;

  const sigHtml = sigs ? `
    <section class="section">
      <h2 class="section-h">📊 Почему <span class="em">${esc(c.canonical_name)}</span> в фазе «${esc(ph.label)}»</h2>
      <div class="glass signal-card">
        ${sigs.map(sg => `
          <div class="sig-row">
            <span class="bullet" style="color:${sg.color};text-shadow:0 0 12px ${sg.color}">●</span>
            <div class="lbl">${sg.lbl}<span class="state">· ${sg.state}</span></div>
            <div class="bar"><div style="width:${sg.pct.toFixed(0)}%;background:${sg.color};color:${sg.color}"></div></div>
            <div class="val">${sg.val}</div>
          </div>`).join('')}
        ${s.evidence_reason ? `<div class="evidence">Причина классификатора: <b>${esc(s.evidence_reason)}</b></div>` : ''}
      </div>
    </section>` : '';

  document.getElementById('content').innerHTML = `
    <section class="hero">
      <h1>${esc(c.canonical_name)}</h1>
      <div class="phase-row">
        <span class="phase-pill" style="background:${ph.color}22;color:${ph.color};border:1px solid ${ph.color}60;box-shadow:0 0 20px ${ph.color}30">
          <span class="dot" style="background:${ph.color}"></span>${esc(ph.label)}
        </span>
        <span class="velo">
          <span style="color:${v > 0 ? GREEN : RED}">${v > 0 ? '↗' : '↘'}</span>
          <b>${v > 0 ? '+' : ''}${Math.round(v * 100)}%</b> скорость г/г · в фазе с <b>${fmtSince(c.phase_since)}</b>
        </span>
      </div>
      ${c.short_description ? `<p class="desc">${esc(c.short_description)}</p>` : ''}
    </section>
    ${buildJourneyHtml(h)}
    ${sigHtml}
    ${buildAdoptionHtml(a)}
    ${buildLineageHtml(l, c.canonical_name)}`;
}

function showError(msg) {
  document.getElementById('content').innerHTML =
    `<div class="error"><b>${esc(msg)}</b><br><span style="font-size:13.5px">← <a href="/" style="color:inherit">вернуться на карту</a></span></div>`;
}

(async function init() {
  if (!SUPABASE_URL || !ANON_KEY) { showError('Не заданы VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.'); return; }
  const slug = getSlug();
  if (!slug) { showError('Не указан концепт.'); return; }
  try {
    const [cRows, sRows, aRows, lRows, hRows] = await Promise.all([
      rpc('julia_public_concept', { p_slug: slug }),
      rpc('julia_public_signals', { p_slug: slug }),
      rpc('julia_public_adoption', { p_slug: slug }).catch(() => null),
      rpc('julia_public_lineage', { p_slug: slug }).catch(() => null),
      rpc('julia_public_phase_history', { p_slug: slug }).catch(() => null),
    ]);
    const c = Array.isArray(cRows) && cRows[0];
    if (!c) { showError('Концепт не найден.'); return; }
    render(c, Array.isArray(sRows) ? sRows[0] : null, Array.isArray(aRows) ? aRows[0] : null, Array.isArray(lRows) ? lRows : null, Array.isArray(hRows) ? hRows : null);
    document.title = `JULIA — ${c.canonical_name}`;
  } catch (err) {
    showError(err.message || String(err));
  }
})();
