/* ==========================================================
   Gráficos em SVG, sem biblioteca externa (o app funciona offline
   e não tem etapa de build; uma lib de gráficos dobraria o tamanho
   do app para 3 formatos simples).
   - Barras por dia com a meta vigente de cada dia (traço escuro).
   - Dia sem registro aparece como traço cinza no eixo, nunca como zero.
   - Peso: só as medições reais, posicionadas pela data.
   - Toque/clique, mouse e teclado (← →) mostram o valor do dia;
     a mesma informação fica na tabela "Ver em tabela".
   ========================================================== */

const FONT = 'font-family="Manrope, system-ui, sans-serif"';
const cssVar = n => { try { return getComputedStyle(document.documentElement).getPropertyValue(n).trim() || "#888"; } catch (_) { return "#888"; } };
const larguraDe = box => Math.max(280, Math.min(960, Math.round((box && box.clientWidth) || 330)));

// teto "redondo" do eixo e os 3 a 5 traços
function eixoY(max) {
  const m = max > 0 ? max : 1;
  const mag = Math.pow(10, Math.floor(Math.log10(m)));
  const passo = [1, 2, 2.5, 5, 10].map(s => s * mag).find(s => m / s <= 4) || 10 * mag;
  const topo = Math.ceil(m / passo) * passo;
  const ticks = [];
  for (let v = 0; v <= topo + 1e-9; v += passo) ticks.push(Math.round(v * 100) / 100);
  return { topo, ticks };
}

// coluna com ponta arredondada (4px) e base reta
function coluna(x, y, w, h, r = 4) {
  if (h <= r) return `M${x} ${y + h}V${y}H${x + w}V${y + h}Z`;
  return `M${x} ${y + h}V${y + r}Q${x} ${y} ${x + r} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${y + h}Z`;
}

// rótulos do eixo X: até ~7, sempre o primeiro e o último
function indicesRotulo(n, max = 7) {
  if (n <= max) return [...Array(n).keys()];
  const passo = (n - 1) / (max - 1);
  return [...new Set([...Array(max).keys()].map(i => Math.round(i * passo)))];
}
const rotuloData = (k, n) => (n <= 7 ? diaCurto(k) : dm(k));

/* ---------- Camada de interação (uma por caixa de gráfico) ---------- */
// pts: [{ x (px no viewBox), y (topo da marca), linhas: [texto principal, secundário...] }]
function interativo(box, svgW, pts, descricao) {
  box._chart = { pts, svgW };
  box.setAttribute("tabindex", "0");
  box.setAttribute("role", "group");
  box.setAttribute("aria-label", descricao + ". Use as setas para ver cada dia.");
  if (box.dataset.ix) return;
  box.dataset.ix = "1";
  let atual = -1;
  const tip = () => box.querySelector(".tip");
  const mostrar = i => {
    const c = box._chart;
    if (!c || !c.pts.length) return;
    atual = Math.max(0, Math.min(c.pts.length - 1, i));
    const p = c.pts[atual];
    const t = tip();
    const svg = box.querySelector("svg");
    if (!t || !svg) return;
    t.innerHTML = "";
    p.linhas.forEach((l, j) => {
      const el = document.createElement(j === 0 ? "b" : "span");
      el.textContent = l;
      t.appendChild(el);
    });
    t.hidden = false;
    const esc = svg.getBoundingClientRect().width / c.svgW || 1;
    const left = Math.max(70, Math.min(box.clientWidth - 70, p.x * esc));
    t.style.left = left + "px";
    t.style.top = Math.max(0, p.y * esc - 8) + "px";
    const hl = svg.querySelector(".hl");
    if (hl) { hl.setAttribute("x", p.x - (p.hw || 10)); hl.setAttribute("width", 2 * (p.hw || 10)); hl.style.opacity = 1; }
  };
  const esconder = () => {
    const t = tip(); if (t) t.hidden = true;
    const hl = box.querySelector(".hl"); if (hl) hl.style.opacity = 0;
  };
  const indicePelo = e => {
    const c = box._chart, svg = box.querySelector("svg");
    if (!c || !svg || !c.pts.length) return -1;
    const r = svg.getBoundingClientRect();
    const x = (e.clientX - r.left) * c.svgW / r.width;
    let best = 0;
    c.pts.forEach((p, i) => { if (Math.abs(p.x - x) < Math.abs(c.pts[best].x - x)) best = i; });
    return best;
  };
  box.addEventListener("pointermove", e => { if (e.pointerType === "mouse") mostrar(indicePelo(e)); });
  box.addEventListener("pointerdown", e => { const i = indicePelo(e); if (i >= 0) mostrar(i); });
  box.addEventListener("pointerleave", e => { if (e.pointerType === "mouse") esconder(); });
  box.addEventListener("blur", esconder);
  box.addEventListener("keydown", e => {
    const n = box._chart ? box._chart.pts.length : 0;
    if (!n) return;
    const mapa = { ArrowRight: atual + 1, ArrowLeft: atual < 0 ? n - 1 : atual - 1, Home: 0, End: n - 1 };
    if (e.key in mapa) { e.preventDefault(); mostrar(mapa[e.key]); }
    else if (e.key === "Escape") esconder();
  });
  box.addEventListener("focus", () => { if (atual < 0 && box._chart) mostrar(box._chart.pts.length - 1); });
}

/* ---------- Barras por dia com meta ---------- */
// dias: [{ k, v: número|null, meta: número|null, fraco: bool (ex.: diário parcial), alerta: bool }]
// o: { unidade, fmtV, cor, rotulo, nomeMeta, nomeFraco }
function graficoBarrasDia(box, dias, o) {
  const W = larguraDe(box), H = 180, L = 40, R = 8, T = 14, B = 24;
  const n = dias.length;
  const max = Math.max(0, ...dias.flatMap(d => [d.v || 0, d.meta || 0]));
  if (!dias.some(d => d.v != null)) {
    box.innerHTML = `<div class="empty">${escapeHtml(o.vazio || "Sem registros neste período.")}</div>`;
    box._chart = null;
    box.removeAttribute("tabindex");
    return;
  }
  const { topo, ticks } = eixoY(max * 1.05);
  const y = v => T + (1 - v / topo) * (H - T - B);
  const slot = (W - L - R) / n;
  const bw = Math.max(2, Math.min(24, slot - 2));
  const cor = cssVar(o.cor), ink = cssVar("--ink"), muted = cssVar("--muted"), line = cssVar("--line"), warn = cssVar("--warn");
  let g = `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${escapeHtml(o.rotulo)}">`;
  g += `<rect class="hl" x="0" y="${T}" width="0" height="${H - T - B}" fill="${ink}" opacity="0" style="opacity:0;fill-opacity:.07"/>`;
  ticks.forEach(t => {
    g += `<line x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}" stroke="${line}" stroke-width="1"/>`;
    g += `<text x="${L - 6}" y="${y(t) + 3.5}" text-anchor="end" font-size="10" fill="${muted}" ${FONT}>${o.fmtEixo ? o.fmtEixo(t) : fmt(t)}</text>`;
  });
  const pts = [];
  dias.forEach((d, i) => {
    const cx = L + slot * i + slot / 2, x = cx - bw / 2;
    if (d.v == null) {
      g += `<rect x="${x}" y="${y(0) - 1.5}" width="${bw}" height="3" rx="1.5" fill="${muted}" opacity=".45"/>`;
    } else if (d.v > 0) {
      const h = Math.max(2, y(0) - y(d.v));
      g += `<path d="${coluna(x, y(0) - h, bw, h, Math.min(4, bw / 2))}" fill="${d.alerta ? warn : cor}"${d.fraco ? ' fill-opacity=".38"' : ""}/>`;
    }
    if (d.meta) g += `<line x1="${x - Math.min(4, slot / 4)}" x2="${x + bw + Math.min(4, slot / 4)}" y1="${y(d.meta)}" y2="${y(d.meta)}" stroke="${ink}" stroke-width="2" stroke-linecap="round"/>`;
    const linhas = [d.v == null ? "Sem registro" : o.fmtV(d.v) + (d.fraco && o.nomeFraco ? ` (${o.nomeFraco})` : ""), dataBr(d.k)];
    if (d.meta) linhas.push(`${o.nomeMeta || "Meta"}: ${o.fmtV(d.meta)}`);
    else linhas.push(`Sem ${(o.nomeMeta || "meta").toLowerCase()} neste dia`);
    pts.push({ x: cx, y: d.v ? Math.min(y(d.v), d.meta ? y(d.meta) : H) : y(0), hw: Math.max(slot / 2, 6), linhas });
  });
  indicesRotulo(n).forEach(i => {
    const k = dias[i].k;
    const anchor = n > 7 ? (i === 0 ? "start" : i === n - 1 ? "end" : "middle") : "middle";
    const x = n > 7 ? (i === 0 ? L : i === n - 1 ? W - R : L + slot * i + slot / 2) : L + slot * i + slot / 2;
    g += `<text x="${x}" y="${H - 7}" text-anchor="${anchor}" font-size="10.5" font-weight="${k === TODAY ? 800 : 600}" fill="${k === TODAY ? ink : muted}" ${FONT}>${rotuloData(k, n)}</text>`;
  });
  box.innerHTML = g + '</svg><div class="tip" hidden></div>';
  interativo(box, W, pts, o.rotulo);
}

/* ---------- Peso: medições reais pela data ---------- */
// pontos: [{ data, peso, n }] (média do dia); o: { ini, fim, media: bool (linha da média de 7 dias) }
function graficoPeso(box, pontos, o) {
  if (!pontos.length) {
    box.innerHTML = `<div class="empty">${escapeHtml(o.vazio || "Nenhuma pesagem neste período. Registre seu peso no Perfil.")}</div>`;
    box._chart = null;
    box.removeAttribute("tabindex");
    return;
  }
  const W = larguraDe(box), H = 180, L = 40, R = 14, T = 12, B = 24;
  const serie = o.media ? serieTendencia(o.fim, diasEntre(o.ini, o.fim) + 1).filter(s => s.media != null) : [];
  const vals = pontos.map(p => p.peso).concat(serie.map(s => s.media));
  let lo = Math.min(...vals), hi = Math.max(...vals);
  if (hi - lo < 2) { const c = (hi + lo) / 2; lo = c - 1; hi = c + 1; }
  const pad = (hi - lo) * 0.12; lo -= pad; hi += pad;
  const span = Math.max(1, diasEntre(o.ini, o.fim));
  const x = k => L + diasEntre(o.ini, k) / span * (W - L - R);
  const y = v => T + (hi - v) / (hi - lo) * (H - T - B);
  const acc = cssVar("--accent"), ink = cssVar("--ink"), muted = cssVar("--muted"), line = cssVar("--line"), card = cssVar("--card");
  let g = `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Peso registrado de ${dataBr(o.ini)} a ${dataBr(o.fim)}">`;
  g += `<rect class="hl" x="0" y="${T}" width="0" height="${H - T - B}" fill="${ink}" style="opacity:0;fill-opacity:.07"/>`;
  [lo + (hi - lo) * 0.15, (lo + hi) / 2, hi - (hi - lo) * 0.15].forEach(v => {
    g += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="${line}" stroke-width="1"/>`;
    g += `<text x="${L - 6}" y="${y(v) + 3.5}" text-anchor="end" font-size="10" fill="${muted}" ${FONT}>${fmt1(v)}</text>`;
  });
  [[o.ini, "start"], [o.fim, "end"]].forEach(([k, a]) => {
    g += `<text x="${x(k)}" y="${H - 7}" text-anchor="${a}" font-size="10.5" font-weight="600" fill="${muted}" ${FONT}>${dm(k)}</text>`;
  });
  if (serie.length) {
    let d = "", prev = null;
    serie.forEach(s => {
      d += (prev && diasEntre(prev, s.data) === 1 ? "L" : "M") + x(s.data).toFixed(1) + " " + y(s.media).toFixed(1);
      prev = s.data;
    });
    g += `<path d="${d}" fill="none" stroke="${muted}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
  }
  if (pontos.length > 1) {
    g += `<path d="${pontos.map((p, i) => (i ? "L" : "M") + x(p.data).toFixed(1) + " " + y(p.peso).toFixed(1)).join("")}" fill="none" stroke="${acc}" stroke-width="2" stroke-opacity=".55" stroke-linejoin="round"/>`;
  }
  const pts = pontos.map(p => {
    g += `<circle cx="${x(p.data)}" cy="${y(p.peso)}" r="5" fill="${acc}" stroke="${card}" stroke-width="2"/>`;
    return { x: x(p.data), y: y(p.peso), hw: 12, linhas: [fmt1(p.peso) + " kg", dataBr(p.data) + (p.n > 1 ? ` · média de ${p.n} pesagens` : "")] };
  });
  box.innerHTML = g + '</svg><div class="tip" hidden></div>';
  interativo(box, W, pts, `Peso registrado de ${dataBr(o.ini)} a ${dataBr(o.fim)}`);
}

/* ---------- Distribuição da energia dos macronutrientes ---------- */
// g: { carb, prot, gord } em gramas. Energia pelos fatores gerais de Atwater: 4, 4 e 9 kcal/g.
const ATWATER = { carb: 4, prot: 4, gord: 9 };
const MACRO_NOME = { carb: "Carboidratos", prot: "Proteínas", gord: "Gorduras" };
function distribuicaoMacros(g) {
  const kcal = {}; let total = 0;
  Object.keys(ATWATER).forEach(k => { kcal[k] = isNum(g[k]) ? g[k] * ATWATER[k] : 0; total += kcal[k]; });
  if (!(total > 0)) return null;
  const out = {};
  Object.keys(ATWATER).forEach(k => { out[k] = { g: g[k] || 0, kcal: kcal[k], pct: kcal[k] / total * 100 }; });
  return out;
}

function barraMacros(box, d, rotulo) {
  if (!d) { box.innerHTML = '<div class="empty">Sem alimentos com macronutrientes neste período.</div>'; return; }
  const ordem = ["carb", "prot", "gord"];
  const titulo = ordem.map(k => `${MACRO_NOME[k]} ${fmt(d[k].pct)}%`).join(", ");
  box.innerHTML = `<div class="segbar" role="img" aria-label="${escapeHtml(rotulo + ": " + titulo)}">`
    + ordem.filter(k => d[k].pct > 0).map(k => `<span class="seg m-${k}" style="flex:${d[k].pct.toFixed(2)} 1 0" title="${MACRO_NOME[k]}: ${fmt(d[k].pct)}% da energia, ${fmt(d[k].g)} g">${d[k].pct >= 12 ? fmt(d[k].pct) + "%" : ""}</span>`).join("")
    + "</div>"
    + '<div class="legend">' + ordem.map(k => `<span><i class="sw m-${k}"></i>${MACRO_NOME[k]}</span>`).join("") + "</div>"
    + '<table class="ntab"><tr><th>Macronutriente</th><th class="num">g</th><th class="num">kcal</th><th class="num">% energia</th></tr>'
    + ordem.map(k => `<tr><td>${MACRO_NOME[k]}</td><td class="num">${fmt(d[k].g)}</td><td class="num">${fmt(d[k].kcal)}</td><td class="num">${fmt(d[k].pct)}%</td></tr>`).join("")
    + "</table>";
}
