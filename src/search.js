// JULIA — страница результатов поиска (под макет). Вызывает edge-функцию julia-search.

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const PHASE = {
  trigger: { color: '#94A3B8', short: 'Триггер' },
  peak:    { color: '#FB923C', short: 'Пик' },
  trough:  { color: '#F87171', short: 'Дно' },
  slope:   { color: '#60A5FA', short: 'Склон' },
  plateau: { color: '#4ADE80', short: 'Плато' },
  unknown: { color: '#6B5E93', short: '—' },
};

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}
function getQ() { return (new URLSearchParams(location.search).get('q') || '').trim(); }

function renderAnswer(answer, concepts) {
  // paragraphs → escape → [n] citations → highlight tracked concepts as links
  return answer.split(/\n{2,}/).map(par => {
    let html = esc(par).replace(/\[(\d+)\]/g, '<a href="#src-$1" class="cite">[$1]</a>');
    concepts.forEach(c => {
      if (!c.name || c.name.length < 4) return;
      const re = new RegExp(`(${c.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'i');
      html = html.replace(re, `<a class="c-link" href="/concept.html?slug=${encodeURIComponent(c.slug)}">$1</a>`);
    });
    return `<p>${html}</p>`;
  }).join('');
}

async function run() {
  const q = getQ();
  if (!q) { window.location.href = '/'; return; }
  document.getElementById('q-text').textContent = q;
  document.title = `JULIA — ${q.slice(0, 50)}`;

  const ansEl = document.getElementById('answer');
  const sideEl = document.getElementById('sidebar');
  ansEl.innerHTML = '<div class="thinking">JULIA думает</div>';

  if (!SUPABASE_URL || !ANON_KEY) { ansEl.innerHTML = '<div class="err">Нет конфигурации (env).</div>'; return; }

  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/julia-search`, {
      method: 'POST',
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: q }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) { ansEl.innerHTML = `<div class="err">${esc(data.error || ('HTTP ' + res.status))}</div>`; return; }

    const concepts = Array.isArray(data.concepts) ? data.concepts : [];
    const sources = Array.isArray(data.sources) ? data.sources : [];
    const related = Array.isArray(data.related) ? data.related : [];

    // answer
    ansEl.innerHTML = `<div class="answer-prose">${renderAnswer(data.answer || '', concepts)}</div>`;

    // sources sidebar
    sideEl.innerHTML = sources.length
      ? `<h2>📚 Источники <span class="cnt">(${sources.length})</span></h2>
         ${sources.map(s => `
           <div class="src" id="src-${s.n}">
             <div class="src-top">
               <span class="num">${s.n}</span>
               <span class="src-name">${esc(s.source_name || 'источник')}</span>
               ${s.published_at ? `<span class="src-date">${esc(String(s.published_at).slice(0, 10))}</span>` : ''}
             </div>
             ${s.url
               ? `<a class="src-title" href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title || s.url)}</a>`
               : `<div class="src-title">${esc(s.title || '—')}</div>`}
             ${s.snippet ? `<div class="src-snip">${esc(s.snippet)}…</div>` : ''}
           </div>`).join('')}`
      : '<h2>📚 Источники</h2><div class="src-snip">Источников нет.</div>';

    // concepts in this answer
    if (concepts.length) {
      document.getElementById('concepts-block').hidden = false;
      document.getElementById('concepts').innerHTML = concepts.map(c => {
        const ph = PHASE[c.phase] || PHASE.unknown;
        return `<a class="c-card" href="/concept.html?slug=${encodeURIComponent(c.slug)}">
          <div class="c-name">${esc(c.name)}</div>
          <span class="pill" style="background:${ph.color}22;color:${ph.color}"><i></i>${ph.short}</span>
        </a>`;
      }).join('');
    }

    // related questions
    if (related.length) {
      document.getElementById('related-block').hidden = false;
      document.getElementById('related').innerHTML = related.map(rq =>
        `<a href="/search.html?q=${encodeURIComponent(rq)}">${esc(rq)}<span class="arr">→</span></a>`
      ).join('');
    }
  } catch (e) {
    ansEl.innerHTML = `<div class="err">${esc(e.message || String(e))}</div>`;
  }
}

run();
