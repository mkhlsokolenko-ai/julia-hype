import"./modulepreload-polyfill-B5Qt9EMX.js";const k="https://zzwwobiypfkwaawxlyud.supabase.co",g="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp6d3dvYml5cGZrd2Fhd3hseXVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5NzAxMzEsImV4cCI6MjA4NTU0NjEzMX0.kH6ijSxefLN063iiiBOE9Zs5_YvQTSC8VodoBdzieBk",p={trigger:{color:"#94A3B8",label:"Технологический триггер"},peak:{color:"#FB923C",label:"Пик завышенных ожиданий"},trough:{color:"#F87171",label:"Дно разочарования"},slope:{color:"#60A5FA",label:"Склон просветления"},plateau:{color:"#4ADE80",label:"Плато продуктивности"},unknown:{color:"#6B5E93",label:"Не классифицировано"}},u="#4ADE80",v="#FBBF24",b="#F87171",$="#C084FC";function r(s){return String(s??"").replace(/[&<>"']/g,n=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[n])}function A(){const s=new URLSearchParams(location.search).get("slug");if(s)return s;const n=location.pathname.split("/").filter(Boolean),t=n[n.length-1];return!t||t==="concepts"||t==="concept.html"?null:decodeURIComponent(t)}async function m(s,n){const t=await fetch(`${k}/rest/v1/rpc/${s}`,{method:"POST",headers:{apikey:g,Authorization:`Bearer ${g}`,"Content-Type":"application/json"},body:JSON.stringify(n)});if(!t.ok)throw new Error(`${s}: HTTP ${t.status}`);return t.json()}function N(s){if(!s)return"—";try{return new Date(s).toLocaleDateString("ru-RU",{year:"numeric",month:"short"})}catch{return s}}function S(s){const n=Number(s.velocity)||0,t=Number(s.recent_papers)||0,e=Number(s.prior_papers)||0,i=Number(s.total_papers_lifetime)||0,o=Math.max(0,Math.min(1,Number(s.classification_confidence)||0));return[{lbl:"Скорость (год к году)",state:n>.3?"ускоряется":n>0?"растёт":n<0?"спад":"ровно",val:`${n>0?"+":""}${Math.round(n*100)}%`,pct:Math.min(100,Math.abs(n*100)),color:n>.3?u:n>0?v:b},{lbl:"Свежие публикации",state:t>e?"активность растёт":t<e?"остывает":"стабильно",val:`${t}`,pct:Math.min(100,t),color:t>e?u:t<e?v:$},{lbl:"Объём публикаций (всего)",state:i>200?"зрелый корпус":"развивается",val:`${i}`,pct:Math.min(100,i/5),color:$},{lbl:"Уверенность сигнала",state:o>.5?"высокая":o>.2?"средняя":"низкая",val:`${Math.round(o*100)}%`,pct:o*100,color:o>.5?u:o>.2?v:b}]}function x(s){return s=Number(s)||0,s>=1e6?(s/1e6).toFixed(1)+"M":s>=1e3?(s/1e3).toFixed(1)+"k":""+s}function E(s){return s=Number(s)||0,s?s>=1e9?"$"+(s/1e9).toFixed(1)+"B":s>=1e6?"$"+(s/1e6).toFixed(1)+"M":s>=1e3?"$"+(s/1e3).toFixed(0)+"k":"$"+s:null}function F(s){const n=(s||"").toLowerCase();return n.includes("mature")?u:n.includes("grow")?v:n.includes("emerg")?"#60A5FA":n.includes("declin")?b:$}function I(s){if(!s)return"";const n=Math.max(0,Math.min(1,Number(s.composite_adoption_score)||0)),t=n>.6?u:n>.3?v:$,e=F(s.adoption_stage),i=[],o=(a,l,h)=>{if(!a)return;const w=h!=null&&isFinite(h)?`<div class="stat-vel" style="color:${h>=0?u:b}">${h>=0?"+":""}${Math.round(h)}%</div>`:"";i.push(`<div class="stat"><div class="stat-v">${r(a)}</div><div class="stat-l">${r(l)}</div>${w}</div>`)},c=Number(s.github_stars_total)||0;c&&o("★ "+x(c),"GitHub звёзды",s.github_stars_velocity_pct),Number(s.hn_mentions_30d)&&o(s.hn_mentions_30d,"Hacker News · 30д"),Number(s.habr_mentions_30d)&&o(s.habr_mentions_30d,"Habr · 30д"),Number(s.news_mentions_30d)&&o(s.news_mentions_30d,"Новости · 30д"),Number(s.patent_filings_180d)&&o(s.patent_filings_180d,"Патенты · 180д",s.patent_filings_velocity_pct),Number(s.hiring_mentions_30d)&&o(s.hiring_mentions_30d,"Вакансии · 30д");const d=E(s.total_funding_usd);return d&&o(d,"Финансирование"),`
    <section class="section">
      <h2 class="section-h">🚀 Сигналы <span class="em">внедрения</span></h2>
      <div class="glass adopt-card">
        <div class="adopt-head">
          <span class="stage-badge" style="background:${e}22;color:${e};border:1px solid ${e}55">${r(s.adoption_stage||"—")}</span>
          <div class="composite">
            <span class="composite-l">общий балл</span>
            <div class="composite-bar"><div style="width:${(n*100).toFixed(0)}%;background:${t};color:${t}"></div></div>
            <span class="composite-val">${Math.round(n*100)}%</span>
          </div>
        </div>
        ${i.length?`<div class="adopt-grid">${i.join("")}</div>`:'<div class="adopt-empty">Компонентные сигналы пока пустые.</div>'}
        <div class="adopt-meta">снапшот ${r(s.snapshot_date||"")}</div>
      </div>
    </section>`}const M={T:"#C084FC",P:"#F0ABFC",I:"#FB923C"},C={trigger:"Триггер",peak:"Пик",trough:"Дно",slope:"Склон",plateau:"Плато",unknown:"—"};function _(s){return C[s]||"—"}function y(s){const n=p[s.neighbor_phase]||p.unknown,t=M[s.neighbor_tier]||$;return`<a class="ln-node" href="/concept.html?slug=${encodeURIComponent(s.neighbor_slug)}">
    <span class="ln-tier" style="background:${t};box-shadow:0 0 8px ${t}"></span>
    <span class="ln-name">${r(s.neighbor_name)}</span>
    <span class="ln-phase" style="color:${n.color}">${_(s.neighbor_phase)}</span>
  </a>`}function R(s,n){if(!s||!s.length)return"";const t=s.filter(a=>a.direction==="parent"),e=s.filter(a=>a.direction==="child"),i=new Set,o=[];s.forEach(a=>{a.neighbor_id&&!i.has(a.neighbor_id)&&(i.add(a.neighbor_id),o.push(a))});const c=`
    <section class="section">
      <h2 class="section-h">🧬 <span class="em">Родословная</span></h2>
      <div class="glass ft-card">
        ${t.length?`<div class="ft-block"><div class="ft-lbl">Произошёл от</div><div class="ft-row">${t.map(y).join("")}<span class="ft-arrow">→</span><span class="ft-self">${r(n)}</span></div></div>`:""}
        ${e.length?`<div class="ft-block"><div class="ft-lbl">Ведёт к</div><div class="ft-row"><span class="ft-self">${r(n)}</span><span class="ft-arrow">→</span><div class="ft-children">${e.map(y).join("")}</div></div></div>`:""}
      </div>
    </section>`,d=`
    <section class="section">
      <h2 class="section-h"><span class="em">Похожие</span> концепты</h2>
      <div class="related-grid">
        ${o.slice(0,8).map(a=>{const l=p[a.neighbor_phase]||p.unknown;return`<a class="rc-card" href="/concept.html?slug=${encodeURIComponent(a.neighbor_slug)}"><div class="rc-name">${r(a.neighbor_name)}</div><span class="rc-pill" style="background:${l.color}22;color:${l.color}"><span class="rc-dot" style="background:${l.color}"></span>${_(a.neighbor_phase)}</span></a>`}).join("")}
      </div>
    </section>`;return c+d}function j(s){if(!s)return"";try{return new Date(s).toLocaleDateString("ru-RU",{year:"numeric",month:"short"})}catch{return s}}function B(s){if(!s||!s.length)return"";const n=[];return s.forEach(e=>{if(e.to_phase==="unknown")return;const i=n[n.length-1];i&&i.phase===e.to_phase||n.push({phase:e.to_phase,month:e.transition_month})}),n.length?`
    <section class="section">
      <h2 class="section-h">📈 Путь <span class="em">по фазам</span></h2>
      <div class="glass tl-card"><div class="tl-row">${n.map((e,i)=>{const o=p[e.phase]||p.unknown,c=i===n.length-1;return`<div class="tl-step${c?" current":""}">
      <div class="tl-month">${j(e.month)}</div>
      <div class="tl-dot" style="background:${o.color};box-shadow:0 0 14px ${o.color}"></div>
      <div class="tl-phase" style="color:${o.color}">${_(e.phase)}${c?" · сейчас":""}</div>
    </div>`}).join('<div class="tl-conn"></div>')}</div></div>
    </section>`:""}function H(s,n,t,e,i){const o=p[s.phase]||p.unknown,c=Number(s.velocity)||0,d=n?S(n):null,a=d?`
    <section class="section">
      <h2 class="section-h">📊 Почему <span class="em">${r(s.canonical_name)}</span> в фазе «${r(o.label)}»</h2>
      <div class="glass signal-card">
        ${d.map(l=>`
          <div class="sig-row">
            <span class="bullet" style="color:${l.color};text-shadow:0 0 12px ${l.color}">●</span>
            <div class="lbl">${l.lbl}<span class="state">· ${l.state}</span></div>
            <div class="bar"><div style="width:${l.pct.toFixed(0)}%;background:${l.color};color:${l.color}"></div></div>
            <div class="val">${l.val}</div>
          </div>`).join("")}
        ${n.evidence_reason?`<div class="evidence">Причина классификатора: <b>${r(n.evidence_reason)}</b></div>`:""}
      </div>
    </section>`:"";document.getElementById("content").innerHTML=`
    <section class="hero">
      <h1>${r(s.canonical_name)}</h1>
      <div class="phase-row">
        <span class="phase-pill" style="background:${o.color}22;color:${o.color};border:1px solid ${o.color}60;box-shadow:0 0 20px ${o.color}30">
          <span class="dot" style="background:${o.color}"></span>${r(o.label)}
        </span>
        <span class="velo">
          <span style="color:${c>0?u:b}">${c>0?"↗":"↘"}</span>
          <b>${c>0?"+":""}${Math.round(c*100)}%</b> скорость г/г · в фазе с <b>${N(s.phase_since)}</b>
        </span>
      </div>
      ${s.short_description?`<p class="desc">${r(s.short_description)}</p>`:""}
    </section>
    ${B(i)}
    ${a}
    ${I(t)}
    ${R(e,s.canonical_name)}`}function f(s){document.getElementById("content").innerHTML=`<div class="error"><b>${r(s)}</b><br><span style="font-size:13.5px">← <a href="/" style="color:inherit">вернуться на карту</a></span></div>`}(async function(){const n=A();if(!n){f("Не указан концепт.");return}try{const[t,e,i,o,c]=await Promise.all([m("julia_public_concept",{p_slug:n}),m("julia_public_signals",{p_slug:n}),m("julia_public_adoption",{p_slug:n}).catch(()=>null),m("julia_public_lineage",{p_slug:n}).catch(()=>null),m("julia_public_phase_history",{p_slug:n}).catch(()=>null)]),d=Array.isArray(t)&&t[0];if(!d){f("Концепт не найден.");return}H(d,Array.isArray(e)?e[0]:null,Array.isArray(i)?i[0]:null,Array.isArray(o)?o:null,Array.isArray(c)?c:null),document.title=`JULIA — ${d.canonical_name}`}catch(t){f(t.message||String(t))}})();
