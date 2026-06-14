// supabase/functions/julia-search/index.ts — JULIA public search v2.
// Flow: query → [Voyage embed → match_kb_chunks_voyage] + [Wikipedia] + [concept list] (parallel)
//       → grounded Gemini synthesis (+labeled enrichment) + related questions (parallel)
//       → { answer, sources, concepts, related }. Secrets server-side.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const VOYAGE_KEY = Deno.env.get('VOYAGE_API_KEY')!;
const ROUTERAI_KEY = Deno.env.get('ROUTERAI_KEY')!;
const HF_TOKEN = Deno.env.get('HF_TOKEN'); // опционально — поднимает rate limit HuggingFace API

const VOYAGE_MODEL = 'voyage-3-large';
const VOYAGE_DIM = 1024;
const ROUTERAI_URL = 'https://routerai.ru/api/v1/chat/completions';
const CASCADE = ['google/gemini-3.1-flash-lite-preview', 'deepseek/deepseek-chat', 'qwen/qwen-plus'];

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

async function embedQuery(query: string): Promise<number[]> {
  const r = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${VOYAGE_KEY}` },
    body: JSON.stringify({ input: [query], model: VOYAGE_MODEL, input_type: 'query', output_dimension: VOYAGE_DIM }),
  });
  if (!r.ok) throw new Error(`Voyage ${r.status}`);
  return (await r.json()).data[0].embedding;
}

async function routerAI(messages: unknown[], maxTokens = 700): Promise<string | null> {
  for (const model of CASCADE) {
    try {
      const r = await fetch(ROUTERAI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ROUTERAI_KEY}` },
        body: JSON.stringify({ model, messages, temperature: 0.4, max_tokens: maxTokens }),
      });
      if (!r.ok) continue;
      const c = (await r.json())?.choices?.[0]?.message?.content;
      if (c && String(c).trim()) return String(c).trim();
    } catch (_) { /* next model */ }
  }
  return null;
}

async function wikipedia(q: string) {
  const lang = /[а-яё]/i.test(q) ? 'ru' : 'en';
  const url = `https://${lang}.wikipedia.org/w/api.php?action=query&format=json&generator=search` +
    `&gsrsearch=${encodeURIComponent(q)}&gsrlimit=2&prop=extracts&exintro&explaintext&exlimit=2`;
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'JULIA-foresight/1.0 (contact: noreply@pmhucks.pro)' } });
    if (!r.ok) return [];
    const pages = (await r.json())?.query?.pages;
    if (!pages) return [];
    return Object.values(pages)
      .filter((p: any) => p.extract && p.extract.length > 80)
      .map((p: any) => ({
        title: p.title,
        extract: String(p.extract).slice(0, 900),
        url: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(p.title.replace(/ /g, '_'))}`,
        source_name: `wikipedia-${lang}`,
      }));
  } catch (_) { return []; }
}

async function huggingface(q: string) {
  try {
    const headers: Record<string, string> = { 'User-Agent': 'JULIA-foresight/1.0' };
    if (HF_TOKEN) headers.Authorization = `Bearer ${HF_TOKEN}`;

    // HF плохо ищет по русской фразе → берём латинское «ядро» (имя+версия), напр. "Kimi 2.6".
    const latinTokens = (q.match(/[A-Za-z0-9.\-]{2,}/g) || []);
    if (!latinTokens.length) return []; // нет латинского ядра — HF тут не поможет
    const hfQ = latinTokens.join(' ');
    const mainToken = latinTokens.slice().sort((a, b) => b.length - a.length)[0]; // самый длинный = вероятно имя

    const fetchModels = async (s: string) => {
      try {
        const r = await fetch(`https://huggingface.co/api/models?search=${encodeURIComponent(s)}&limit=6&full=true`, { headers });
        if (!r.ok) return [];
        const m = await r.json();
        return Array.isArray(m) ? m : [];
      } catch (_) { return []; }
    };

    let models = await fetchModels(hfQ);
    if (!models.length && mainToken && mainToken.toLowerCase() !== hfQ.toLowerCase()) {
      models = await fetchModels(mainToken); // добор по имени без версии
    }
    if (!models.length) return [];

    // релевантный гейт: токен запроса (≥3 симв.) должен встречаться в id модели — иначе шум
    const qTokens = latinTokens.map(t => t.toLowerCase()).filter(t => t.length >= 3);
    const relevant = models
      .filter((m: any) => { const id = (m.id || '').toLowerCase(); return qTokens.some(t => id.includes(t)); })
      .sort((a: any, b: any) => (b.downloads || 0) - (a.downloads || 0))
      .slice(0, 3);
    if (!relevant.length) return [];

    // у топ-модели тянем выдержку из README (реальное описание/инфо о релизе)
    let topReadme = '';
    try {
      const rr = await fetch(`https://huggingface.co/${relevant[0].id}/raw/main/README.md`, { headers });
      if (rr.ok) topReadme = (await rr.text()).replace(/^---[\s\S]*?---/, '').replace(/\s+/g, ' ').trim().slice(0, 700);
    } catch (_) { /* нет README */ }

    return relevant.map((m: any, i: number) => {
      const meta = [
        m.pipeline_tag ? `тип: ${m.pipeline_tag}` : '',
        m.downloads != null ? `загрузок: ${m.downloads}` : '',
        m.likes != null ? `лайков: ${m.likes}` : '',
        Array.isArray(m.tags) && m.tags.length ? `теги: ${m.tags.slice(0, 6).join(', ')}` : '',
      ].filter(Boolean).join(' · ');
      return {
        title: m.id,
        url: `https://huggingface.co/${m.id}`,
        source_name: 'huggingface',
        extract: (i === 0 && topReadme ? topReadme : meta) || m.id,
      };
    });
  } catch (_) { return []; }
}

async function relatedQuestions(q: string): Promise<string[]> {
  const out = await routerAI([
    {
      role: 'system', content:
        'Сгенерируй ровно 3 коротких follow-up вопроса, которые пользователь мог бы задать ДАЛЕЕ, чтобы глубже узнать тему запроса.\n' +
        'Строго:\n' +
        '— Вопросы о самом предмете (факты, сравнения, возможности, история, характеристики, контекст) — на них существует фактический ответ.\n' +
        '— НЕ обращайся к пользователю и НЕ спрашивай про его планы, намерения или потребности. Запрещены формы «вы», «вам», «ваши», «планируете», «требуется ли вам», «нужна ли вам».\n' +
        '— Формулируй безлично, как самостоятельный поисковый запрос.\n' +
        '— Тот же язык, что и запрос.\n' +
        'Верни ТОЛЬКО JSON-массив из 3 строк, без markdown и пояснений.',
    },
    { role: 'user', content: q },
  ], 220);
  if (!out) return [];
  try {
    const arr = JSON.parse(out.replace(/```json|```/g, '').trim());
    if (!Array.isArray(arr)) return [];
    // защитная сетка: выкидываем вопросы, обращённые к пользователю, даже если модель нарушила промпт
    const ru = /(?<![а-яё])(вы|вам|вас|ваш[а-яё]*|планируете|собираетесь|хотите)(?![а-яё])/i;
    const en = /\b(you|your|yours)\b/i;
    return arr.map(String).filter(s => !ru.test(s) && !en.test(s)).slice(0, 3);
  } catch (_) { return []; }
}

function extractConcepts(haystack: string, nodes: any[]) {
  const low = haystack.toLowerCase();
  const found: any[] = [];
  const seen = new Set();
  for (const n of nodes) {
    const name = (n.canonical_name || '').trim();
    if (name.length < 4 || seen.has(n.slug)) continue;
    if (low.includes(name.toLowerCase())) {
      found.push({ name, slug: n.slug, phase: n.phase });
      seen.add(n.slug);
      if (found.length >= 4) break;
    }
  }
  return found;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: 'bad json' }, 400); }
  const query = String(body?.query || '').replace(/\s+/g, ' ').trim();
  if (query.length < 3) return json({ error: 'query too short' }, 400);
  if (query.length > 400) return json({ error: 'query too long' }, 400);

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  // C1.5: fire-and-forget лог запроса для блока «о чём спрашивают».
  // Не блокирует поиск; insert уходит параллельно RAG; ошибки гасятся молча.
  supabase.from('julia_search_log').insert({ query }).then(() => {}, () => {});

  try {
    const [chunks, wiki, hf, nodesRes] = await Promise.all([
      embedQuery(query).then(emb =>
        supabase.rpc('match_kb_chunks_voyage', { query_embedding: emb, match_count: 8, similarity_threshold: 0.3 })
          .then(({ data, error }) => { if (error) throw new Error(`match: ${error.message}`); return data || []; })),
      wikipedia(query),
      huggingface(query),
      supabase.rpc('julia_public_nodes').then(({ data }) => data || []),
    ]);

    // Wikipedia участвует всегда как обогащение; от нерелевантного защищает
    // правило «игнорируй нерелевантное» в промпте (durag и т.п. модель отбросит).
    const wikiUsed = wiki;

    if ((!chunks || !chunks.length) && !wikiUsed.length && !(hf && hf.length)) {
      return json({ answer: 'По этому запросу ничего не нашлось ни в базе знаний, ни в Википедии, ни на HuggingFace.', sources: [], concepts: [], related: [] });
    }

    const sources: any[] = [];
    const docN = new Map<string, number>();
    const ctx: string[] = [];
    for (const c of chunks) {
      if (!docN.has(c.document_id)) {
        const n = sources.length + 1;
        docN.set(c.document_id, n);
        sources.push({ n, source_name: c.source_name, title: c.document_title, url: c.document_url, published_at: c.published_at, snippet: (c.content || '').replace(/\s+/g, ' ').slice(0, 160) });
      }
      ctx.push(`[${docN.get(c.document_id)}] (${c.source_name || 'source'}) ${c.document_title || ''}\n${(c.content || '').slice(0, 600)}`);
    }
    for (const w of wikiUsed) {
      const n = sources.length + 1;
      sources.push({ n, source_name: w.source_name, title: w.title, url: w.url, published_at: null, snippet: w.extract.replace(/\s+/g, ' ').slice(0, 160) });
      ctx.push(`[${n}] (Wikipedia) ${w.title}\n${w.extract}`);
    }
    for (const h of hf) {
      const n = sources.length + 1;
      sources.push({ n, source_name: 'huggingface', title: h.title, url: h.url, published_at: null, snippet: h.extract.replace(/\s+/g, ' ').slice(0, 160) });
      ctx.push(`[${n}] (HuggingFace · реестр моделей) ${h.title}\n${h.extract}`);
    }

    const system = `Ты — ассистент JULIA, отвечаешь на вопросы про AI-технологии и тренды.
Дай ОДИН цельный, связный и оптимизированный ответ:
- Синтезируй КОНТЕКСТ (база знаний, Wikipedia, HuggingFace) и свои знания в единый текст. НЕ разделяй на «из базы / вне базы» и не ставь служебных пометок вроде «Вне базы:».
- После утверждений, опирающихся на источники из контекста, ставь ссылку [n]. Обогащающие факты из своих знаний просто вплетай в повествование без ссылки — естественно, одним целым.
- Обогащай ответ полезным контекстом (что это, зачем, как соотносится с трендами и смежными технологиями), но без воды.
- Игнорируй нерелевантные фрагменты контекста и не упоминай их.
- Источник «HuggingFace» — актуальный реестр моделей; доверяй ему для фактов о свежих релизах моделей, даже если сам ты эту модель не знаешь.
- Отвечай на языке вопроса. Объём — 4–7 предложений, цельным абзацем, без списков.

КОНТЕКСТ:
${ctx.join('\n\n')}`;

    const [answer, related] = await Promise.all([
      routerAI([{ role: 'system', content: system }, { role: 'user', content: query }], 750),
      relatedQuestions(query),
    ]);
    if (!answer) return json({ error: 'LLM unavailable' }, 502);

    const concepts = extractConcepts(`${query}\n${answer}`, nodesRes);

    return json({ answer, sources, concepts, related });
  } catch (e: any) {
    return json({ error: String(e?.message || e) }, 500);
  }
});
