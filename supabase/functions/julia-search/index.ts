// supabase/functions/julia-search/index.ts — JULIA public search v2.
// Flow: query → [Voyage embed → match_kb_chunks_voyage] + [Wikipedia] + [concept list] (parallel)
//       → grounded Gemini synthesis (+labeled enrichment) + related questions (parallel)
//       → { answer, sources, concepts, related }. Secrets server-side.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const VOYAGE_KEY = Deno.env.get('VOYAGE_API_KEY')!;
const ROUTERAI_KEY = Deno.env.get('ROUTERAI_KEY')!;

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

async function relatedQuestions(q: string): Promise<string[]> {
  const out = await routerAI([
    { role: 'system', content: 'Сгенерируй ровно 3 коротких уточняющих вопроса по теме запроса. Тот же язык, что и запрос. Верни ТОЛЬКО JSON-массив строк, без markdown и пояснений.' },
    { role: 'user', content: q },
  ], 200);
  if (!out) return [];
  try {
    const arr = JSON.parse(out.replace(/```json|```/g, '').trim());
    return Array.isArray(arr) ? arr.slice(0, 3).map(String) : [];
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

  try {
    const [chunks, wiki, nodesRes] = await Promise.all([
      embedQuery(query).then(emb =>
        supabase.rpc('match_kb_chunks_voyage', { query_embedding: emb, match_count: 8, similarity_threshold: 0.3 })
          .then(({ data, error }) => { if (error) throw new Error(`match: ${error.message}`); return data || []; })),
      wikipedia(query),
      supabase.rpc('julia_public_nodes').then(({ data }) => data || []),
    ]);

    // Wikipedia — только добор, когда база знаний бедна по запросу
    // (иначе короткие/омонимичные запросы шумят, напр. "Durag" на "RAG").
    const wikiUsed = (chunks?.length || 0) < 4 ? wiki : [];

    if ((!chunks || !chunks.length) && !wikiUsed.length) {
      return json({ answer: 'По этому запросу ничего не нашлось ни в базе знаний, ни в Википедии.', sources: [], concepts: [], related: [] });
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

    const system = `Ты — ассистент JULIA, отвечаешь на вопросы про AI-технологии и тренды.
Правила:
- Отвечай на языке вопроса (вопрос на русском → ответ на русском).
- Опирайся на КОНТЕКСТ ниже и ставь ссылки [n] после утверждений, которые из него следуют.
- Игнорируй фрагменты контекста, которые не относятся к вопросу, и не упоминай их.
- Если важного нет в контексте — можешь добавить общеизвестный факт, но пометь такой фрагмент в начале словом «Вне базы:» и без ссылок. Никогда не смешивай источниковые и несырьевые утверждения в одном предложении.
- Кратко и по делу, 3–6 предложений.

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
