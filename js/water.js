/* ==========================================================
   Hidratação: registro em ml, soma do dia e meta de hábito
   - Registra água pura e outras bebidas separadas (volume de bebida
     não é o mesmo que seu conteúdo de água).
   - Água dos alimentos não é estimada: a base não tem umidade.
   - A meta compara só o volume do mesmo escopo (água pura ou todas
     as bebidas). É meta de hábito ajustável, não estado de hidratação.
   - Limite de líquidos (restrição) só vindo de profissional.
   - Sem prêmio por excesso; volume muito alto gera aviso neutro.
   ========================================================== */

const AGUA_TIPOS = { agua: "Água", outra: "Outra bebida" };
const AGUA_FAIXA = [10, 3000];          // por registro
const AGUA_META_FAIXA = [500, 6000];    // ml/dia
const AGUA_SUGESTAO_ML = 2000;          // ponto de partida ajustável, só para quem está no escopo

/* ---------- Registros ---------- */
function validarAgua(src) {
  const x = src || {};
  const ml = Number(x.ml);
  if (!isNum(ml) || ml < AGUA_FAIXA[0] || ml > AGUA_FAIXA[1]) return { ok: false, erro: `Informe entre ${AGUA_FAIXA[0]} e ${fmt(AGUA_FAIXA[1])} ml.` };
  if (!AGUA_TIPOS[x.tipo]) return { ok: false, erro: "Tipo de bebida inválido." };
  return { ok: true, registro: {
    id: typeof x.id === "string" && x.id ? x.id.slice(0, 40) : uid(),
    ml: Math.round(ml), tipo: x.tipo, t: isNum(x.t) ? x.t : Date.now()
  } };
}

function cleanAgua(list) {
  const seen = new Set();
  return (Array.isArray(list) ? list : []).map(validarAgua)
    .filter(r => r.ok && !seen.has(r.registro.id) && seen.add(r.registro.id))
    .map(r => r.registro);
}

function addAgua(ml, tipo, k = cur) {
  const r = validarAgua({ ml, tipo });
  if (!r.ok) return r;
  if (!days[k]) days[k] = { foods: [], ex: [] };
  if (!Array.isArray(days[k].agua)) days[k].agua = [];
  days[k].agua.push(r.registro);
  persist();
  return r;
}

function removeAgua(id, k = cur) {
  if (!days[k] || !days[k].agua) return;
  days[k].agua = days[k].agua.filter(x => x.id !== id);
  persist();
}

// soma do dia por tipo; sem registro = null (dia ausente não é ingestão zero)
function aguaDia(k = cur) {
  const list = days[k] && Array.isArray(days[k].agua) ? days[k].agua : [];
  const n = list.length;
  const soma = t => list.filter(x => x.tipo === t).reduce((s, x) => s + x.ml, 0);
  return {
    n,
    agua_pura_ml: n ? soma("agua") : null,
    outras_bebidas_ml: n ? soma("outra") : null,
    total_ml: n ? soma("agua") + soma("outra") : null,
    agua_alimentos_estimada_ml: null
  };
}

/* ---------- Meta ---------- */
function metaAguaInformada(valor, { origem = "manual", escopo = "agua_pura", sentido = "meta" } = {}) {
  const v = Number(valor);
  if (!isNum(v) || v < AGUA_META_FAIXA[0] || v > AGUA_META_FAIXA[1]) return erro(`Informe entre ${fmt(AGUA_META_FAIXA[0])} e ${fmt(AGUA_META_FAIXA[1])} ml.`);
  if (!["manual", "profissional"].includes(origem)) return erro("Origem inválida.");
  if (!["agua_pura", "bebidas_total"].includes(escopo)) return erro("Escopo inválido.");
  if (!["meta", "limite"].includes(sentido)) return erro("Tipo de meta inválido.");
  if (sentido === "limite" && origem !== "profissional") return erro("Limite de líquidos é definido pelo seu profissional de saúde (origem “Profissional”).");
  const el = elegibilidade();
  if (!el.ok && origem !== "profissional") return erro(`Sem meta automática ou por conta própria (${el.motivos.join(", ")}): use a definida pela sua equipe de saúde.`);
  return { ok: true, meta: {
    tipo: "agua", valor: Math.round(v), unidade: "ml/dia", origem, versao: METAS_VERSAO, escopo, sentido,
    metodo: sentido === "limite" ? "limite diário definido por profissional" : "meta de hábito ajustável",
    fonte_url: null, dados_utilizados: { escopo, sentido }
  } };
}

// sugestão inicial (ajustável) só para quem está no escopo das metas automáticas
const sugestaoMetaAgua = () => (elegibilidade().ok ? AGUA_SUGESTAO_ML : null);

const aguaNivel = pct => Math.min(100, Math.max(0, Number(pct) || 0));

function comparaAgua(k = cur) {
  const a = aguaDia(k);
  const m = metaVigente("agua", k);
  const escopo = m && m.escopo === "bebidas_total" ? "bebidas_total" : "agua_pura";
  const consumo = a.n ? (escopo === "bebidas_total" ? a.total_ml : a.agua_pura_ml) : null;
  if (!m) return { consumo, meta: null, pct: null, escopo, sentido: null, status: a.n ? "sem_meta" : "sem_registro", alto: false };
  const limite = m.sentido === "limite";
  const pct = consumo == null ? null : consumo / m.valor * 100;
  const status = consumo == null ? "sem_registro"
    : limite ? (consumo > m.valor ? "acima_limite" : "dentro_limite")
    : (consumo >= m.valor ? "alcancada" : "abaixo");
  const alto = !limite && consumo != null && consumo > Math.max(2 * m.valor, 4000);
  return { consumo, meta: m.valor, pct, escopo, sentido: limite ? "limite" : "meta", status, alto };
}

/* ---------- Tela ---------- */
const ESCOPO_ROTULO = { agua_pura: "água pura", bebidas_total: "todas as bebidas" };
const fmtMl = v => (v >= 1000 ? fmt1(v / 1000) + " L" : fmt(v) + " ml");

// copo com o nível do dia (no máximo cheio); vermelho só acima de um limite de profissional
function renderCopo(c) {
  const css = getComputedStyle(document.documentElement);
  const col = v => css.getPropertyValue(v).trim();
  const nivel = aguaNivel(c.pct);
  const top = 12, bot = 150, h = (bot - top) * nivel / 100;
  const cor = c.status === "acima_limite" ? col("--warn") : col("--accent");
  $("aguaGlass").innerHTML = `<svg viewBox="0 0 110 160" role="img" aria-label="${c.pct == null ? "Sem comparação com meta" : fmt(c.pct) + "% da meta do dia"}">`
    + `<defs><clipPath id="copoClip"><path d="M14 10 L96 10 L86 152 L24 152 Z"/></clipPath></defs>`
    + `<rect x="0" y="${bot - h}" width="110" height="${h + 4}" fill="${cor}" opacity=".85" clip-path="url(#copoClip)"/>`
    + `<path d="M14 10 L96 10 L86 152 L24 152 Z" fill="none" stroke="${col("--muted")}" stroke-width="2.5" stroke-linejoin="round"/>`
    + "</svg>";
}

function renderAguaResumo() {
  const a = aguaDia(cur);
  const c = comparaAgua(cur);
  const m = metaVigente("agua", cur);
  $("aguaTotal").textContent = c.consumo == null ? "—" : fmtMl(c.consumo);
  $("aguaOutras").textContent = a.n === 0 ? "Nenhuma bebida registrada neste dia (não é zero de consumo)"
    : `Água pura ${fmtMl(a.agua_pura_ml)} · outras bebidas ${fmtMl(a.outras_bebidas_ml)}`;
  let txt;
  if (!m) txt = `Sem meta de água · ${ESCOPO_ROTULO[c.escopo]}`;
  else if (c.sentido === "limite") {
    txt = `Limite diário de ${fmtMl(m.valor)} (${ESCOPO_ROTULO[c.escopo]}, definido por profissional)`
      + (c.status === "acima_limite" ? ` · acima do limite em ${fmtMl(c.consumo - m.valor)}` : c.consumo != null ? ` · restam ${fmtMl(m.valor - c.consumo)}` : "");
  } else {
    txt = `de ${fmtMl(m.valor)} da meta de hábito (${ESCOPO_ROTULO[c.escopo]})`
      + (c.pct == null ? "" : c.status === "alcancada" ? " · meta alcançada" : ` · ${fmt(c.pct)}%, faltam ${fmtMl(m.valor - c.consumo)}`);
  }
  $("aguaMetaTxt").textContent = txt;
  $("aguaAviso").classList.toggle("hide", !c.alto);
  $("aguaAviso").textContent = c.alto ? "Volume alto registrado. Não é preciso passar da meta; em calor ou treino intenso, a necessidade é individual: converse com um profissional." : "";
  renderCopo(c);
}

function renderAguaList() {
  const list = days[cur] && Array.isArray(days[cur].agua) ? days[cur].agua : [];
  const box = $("aguaList");
  if (!list.length) { box.innerHTML = '<div class="empty">Nenhum registro de bebida neste dia.</div>'; return; }
  box.innerHTML = list.slice().reverse().map(x => {
    const hora = new Date(x.t).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    return `<div class="item"><div class="n"><div>${AGUA_TIPOS[x.tipo]}</div><small>${hora}</small></div>`
      + `<div class="kc num">${fmt(x.ml)} ml</div><button type="button" class="x" data-del="${escapeHtml(x.id)}" aria-label="Remover">×</button></div>`;
  }).join("");
}

// últimos 7 dias: volume do escopo da meta e a meta de cada dia; sem registro = traço
function renderAguaSemana() {
  const ks = [];
  for (let i = 6; i >= 0; i--) ks.push(addDays(cur, -i));
  const cs = ks.map(k => comparaAgua(k));
  const W = 330, H = 130, T = 12, B = 24, slot = W / 7, bw = 24;
  const top = Math.max(1000, ...cs.flatMap(c => [c.consumo || 0, c.meta || 0])) * 1.12;
  const y = v => T + (1 - v / top) * (H - T - B);
  const css = getComputedStyle(document.documentElement);
  const col = v => css.getPropertyValue(v).trim();
  const font = 'font-family="Manrope, system-ui, sans-serif"';
  let g = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Água registrada nos últimos 7 dias, com a meta de cada dia">`;
  g += `<line x1="0" x2="${W}" y1="${y(0)}" y2="${y(0)}" stroke="${col("--line")}" stroke-width="1"/>`;
  cs.forEach((c, i) => {
    const cx = slot * i + slot / 2, x = cx - bw / 2, k = ks[i];
    const tip = `${dataBr(k)}: ` + (c.consumo == null ? "sem registro" : fmtMl(c.consumo)) + (c.meta ? ` · ${c.sentido === "limite" ? "limite" : "meta"} ${fmtMl(c.meta)}` : "");
    g += `<g><title>${tip}</title><rect x="${slot * i}" y="${T}" width="${slot}" height="${H - T - B}" fill="transparent"/>`;
    if (c.consumo == null) g += `<rect x="${x}" y="${y(0) - 1.5}" width="${bw}" height="3" rx="1.5" fill="${col("--line")}"/>`;
    else if (c.consumo > 0) {
      const h = Math.max(3, y(0) - y(c.consumo));
      g += `<rect x="${x}" y="${y(0) - h}" width="${bw}" height="${h}" rx="4" fill="${c.status === "acima_limite" ? col("--warn") : col("--accent")}"/>`;
    }
    if (c.meta) g += `<line x1="${x - 4}" x2="${x + bw + 4}" y1="${y(c.meta)}" y2="${y(c.meta)}" stroke="${col("--ink")}" stroke-width="2" stroke-linecap="round"/>`;
    g += `</g><text x="${cx}" y="${H - 7}" text-anchor="middle" font-size="10.5" font-weight="${k === cur ? 800 : 600}" fill="${k === cur ? col("--ink") : col("--muted")}" ${font}>${diaCurto(k)}</text>`;
  });
  $("aguaSemana").innerHTML = g + "</svg>";
}

function renderAguaMeta() {
  const m = metaVigente("agua", TODAY);
  $("aguaMetaSum").textContent = m ? fmtMl(m.valor) + (m.sentido === "limite" ? " (limite)" : "") : "";
  $("aguaMetaAtual").textContent = m
    ? `${fmtMl(m.valor)} por dia · ${m.metodo} · ${ESCOPO_ROTULO[m.escopo] || "água pura"} · ${m.origem === "profissional" ? "profissional de saúde" : "definida por você"} · desde ${dataBr(m.vigencia_inicio)}.`
    : "Sem meta de água.";
  const sug = sugestaoMetaAgua();
  $("aguaSugestao").classList.toggle("hide", !!m || sug == null);
  if (!$("aguaMetaOrigem").dataset.init) {
    $("aguaMetaOrigem").dataset.init = "1";
    $("aguaMetaOrigem").value = m ? m.origem : (elegibilidade().ok ? "manual" : "profissional");
    if (m) { $("aguaMetaValor").value = m.valor; $("aguaMetaEscopo").value = m.escopo; $("aguaMetaSentido").value = m.sentido; }
  }
}

function renderAgua() {
  renderAguaResumo();
  renderAguaList();
  renderAguaSemana();
  renderAguaMeta();
}

function adicionarAgua(ml) {
  const r = addAgua(ml, $("aguaTipo").value);
  $("aguaErro").textContent = r.ok ? "" : r.erro;
  if (!r.ok) return;
  $("aguaMl").value = "";
  toast(`${fmt(r.registro.ml)} ml de ${AGUA_TIPOS[r.registro.tipo].toLowerCase()} registrados`);
  renderAll();
}

function salvarMetaAgua() {
  const origem = $("aguaMetaOrigem").value;
  if (origem === "nenhuma") { encerrarMeta("agua"); $("aguaMetaErro").textContent = ""; toast("Meta de água removida a partir de hoje."); renderAll(); return; }
  const r = metaAguaInformada(numIn("aguaMetaValor"), { origem, escopo: $("aguaMetaEscopo").value, sentido: $("aguaMetaSentido").value });
  $("aguaMetaErro").textContent = r.ok ? "" : r.erro;
  if (!r.ok) return;
  definirMeta(r.meta);
  toast("Meta de água salva (vale a partir de hoje).");
  renderAll();
}

function initAgua() {
  $("aguaQuick").onclick = e => {
    const b = e.target && e.target.closest ? e.target.closest("[data-ml]") : null;
    if (b) adicionarAgua(Number(b.dataset.ml));
  };
  $("aguaAdd").onclick = () => adicionarAgua(numIn("aguaMl"));
  $("aguaMl").addEventListener("keydown", e => { if (e.key === "Enter") adicionarAgua(numIn("aguaMl")); });
  $("aguaList").onclick = e => {
    const b = e.target && e.target.closest ? e.target.closest("[data-del]") : null;
    if (!b) return;
    removeAgua(b.dataset.del);
    renderAll();
  };
  $("aguaMetaSalvar").onclick = salvarMetaAgua;
  $("aguaSugestao").onclick = () => {
    const r = metaAguaInformada(AGUA_SUGESTAO_ML, { origem: "manual", escopo: "agua_pura", sentido: "meta" });
    if (!r.ok) { $("aguaMetaErro").textContent = r.erro; return; }
    definirMeta(r.meta);
    $("aguaMetaValor").value = AGUA_SUGESTAO_ML;
    toast("Meta de hábito: 2 L de água pura por dia. Ajuste quando quiser.");
    renderAll();
  };
}
