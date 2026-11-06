/* ==========================================================
   Água: copo configurável, registro por toque, desfazer, silhueta
   - Cada registro guarda id, volume (ml), tipo e horário. O volume é
     do registro: mudar o tamanho do copo depois não altera o passado.
   - Água pura e outras bebidas ficam separadas (volume de bebida não é
     igual ao seu conteúdo de água). Água dos alimentos não é estimada.
   - Progresso visual = limitar(consumo do dia / meta do dia, 0 a 1).
     Acima da meta o total real continua somando; a silhueta fica em 100%.
     A silhueta mostra o progresso da META, não o nível de hidratação.
   - Meta estimada (EFSA, 2010): ingestão adequada de água TOTAL para
     adultos = 2,5 L/dia (coeficiente masculino) ou 2,0 L/dia (feminino),
     em clima e atividade moderados. Como 20–30% da água total vem dos
     alimentos (EFSA), a meta de bebidas desconta 20% (o limite inferior):
     2,0 L ou 1,6 L de bebidas por dia. Peso e altura não entram: a
     referência da EFSA para adultos não varia com eles.
   - Limite de líquidos (restrição) só vindo de profissional.
   ========================================================== */

const AGUA_TIPOS = { agua: "Água", outra: "Outra bebida" };
const AGUA_FAIXA = [10, 3000];          // por registro
const AGUA_META_FAIXA = [500, 6000];    // ml/dia
const AGUA_EFSA_TOTAL = { M: 2500, F: 2000 };   // ml/dia de água total, adultos (EFSA 2010)
const AGUA_FRACAO_ALIMENTOS = 0.2;              // EFSA: 20–30% vem dos alimentos; usa o limite inferior

/* ---------- Registros ---------- */
function validarAgua(src) {
  const x = src || {};
  const ml = Number(x.ml);
  if (x.ml == null || x.ml === "" || !isNum(ml)) return { ok: false, erro: "Informe o volume em ml, só com números." };
  if (ml < AGUA_FAIXA[0] || ml > AGUA_FAIXA[1]) return { ok: false, erro: `Informe entre ${AGUA_FAIXA[0]} e ${fmt(AGUA_FAIXA[1])} ml.` };
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
    .map(r => r.registro)
    .sort((a, b) => a.t - b.t);
}

// horário do registro: agora, ou o horário de agora no dia escolhido (registro atrasado)
function instanteNoDia(k) {
  if (k === TODAY) return Date.now();
  const n = new Date();
  return tNoDia(k, n.getHours(), n.getMinutes());
}

function addAgua(ml, tipo, k = cur) {
  const r = validarAgua({ ml, tipo, t: instanteNoDia(k) });
  if (!r.ok) return r;
  if (!days[k]) days[k] = { foods: [], ex: [] };
  if (!Array.isArray(days[k].agua)) days[k].agua = [];
  days[k].agua.push(r.registro);
  r.salvo = persist() !== false;
  return r;
}

// corrige volume, horário (HH:MM, no mesmo dia) e tipo de um registro
function updateAgua(id, { ml, hora, tipo }, k = cur) {
  const list = days[k] && days[k].agua;
  const i = list ? list.findIndex(x => x.id === id) : -1;
  if (i < 0) return { ok: false, erro: "Registro não encontrado." };
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hora || ""));
  if (!m || +m[1] > 23 || +m[2] > 59) return { ok: false, erro: "Horário inválido (use HH:MM).", campo: "hora" };
  const r = validarAgua({ id, ml, tipo, t: tNoDia(k, +m[1], +m[2]) });
  if (!r.ok) return Object.assign(r, { campo: "ml" });
  list[i] = r.registro;
  list.sort((a, b) => a.t - b.t);
  persist();
  return r;
}

function removeAgua(id, k = cur) {
  if (!days[k] || !days[k].agua) return false;
  const n = days[k].agua.length;
  days[k].agua = days[k].agua.filter(x => x.id !== id);
  if (days[k].agua.length === n) return false;
  persist();
  return true;
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

/* ---------- Copo (volume por toque) ---------- */
function validarCopo(v) {
  if (v == null || v === "") return { ok: false, erro: "Informe o volume do copo em ml." };
  const ml = typeof v === "number" ? v : parseNumBR(v);
  if (!isNum(ml)) return { ok: false, erro: "Use só números inteiros, por exemplo 350." };
  if (ml < COPO_FAIXA[0] || ml > COPO_FAIXA[1]) return { ok: false, erro: `O copo precisa ter entre ${COPO_FAIXA[0]} e ${fmt(COPO_FAIXA[1])} ml.` };
  return { ok: true, ml: Math.round(ml) };
}

function definirCopo(v) {
  const r = validarCopo(v);
  if (!r.ok) return r;
  prefs.copo_ml = r.ml;
  persist();
  return r;
}

// pilha de desfazer: só registros criados nesta sessão, do mais novo para o mais antigo
let aguaDesfazer = [];

// um toque no copo = um registro com o volume configurado agora
function registrarCopo() {
  if (atualizarHoje()) renderAll();
  const r = addAgua(prefs.copo_ml, prefs.copo_tipo);
  if (r.ok) aguaDesfazer.push({ id: r.registro.id, k: cur });
  return r;
}

function desfazerAgua() {
  while (aguaDesfazer.length) {
    const u = aguaDesfazer.pop();
    const reg = days[u.k] && (days[u.k].agua || []).find(x => x.id === u.id);
    if (reg && removeAgua(u.id, u.k)) return { ok: true, registro: reg, k: u.k };
  }
  return { ok: false };
}

/* ---------- Meta ---------- */
function metaAguaInformada(valor, { origem = "manual", escopo = "agua_pura", sentido = "meta" } = {}) {
  const v = Number(valor);
  if (valor == null || valor === "" || !isNum(v)) return erro("Informe a meta em ml, só com números.");
  if (v < AGUA_META_FAIXA[0] || v > AGUA_META_FAIXA[1]) return erro(`Informe entre ${fmt(AGUA_META_FAIXA[0])} e ${fmt(AGUA_META_FAIXA[1])} ml.`);
  if (!["manual", "profissional"].includes(origem)) return erro("Origem inválida.");
  if (!["agua_pura", "bebidas_total"].includes(escopo)) return erro("Escopo inválido.");
  if (!["meta", "limite"].includes(sentido)) return erro("Tipo de meta inválido.");
  if (sentido === "limite" && origem !== "profissional") return erro("Limite de líquidos é definido pelo seu profissional de saúde (origem “Profissional”).");
  const el = elegibilidade();
  const restricao = (profile.condicoes || []).some(c => c === "renal" || c === "liquidos");
  if (restricao && origem !== "profissional") return erro("Com doença renal ou restrição de líquidos, use a meta ou o limite definido pela sua equipe de saúde (origem “Profissional”).");
  return { ok: true, meta: {
    tipo: "agua", valor: Math.round(v), unidade: "ml/dia", origem, versao: METAS_VERSAO, escopo, sentido,
    metodo: sentido === "limite" ? "limite diário definido por profissional" : origem === "profissional" ? "meta definida por profissional" : "meta personalizada",
    fonte_url: null, dados_utilizados: { escopo, sentido, elegivel_estimativa: el.ok }
  } };
}

// meta estimada pela referência da EFSA (ver cabeçalho); sem os dados necessários, não estima
function estimarMetaAgua() {
  const el = elegibilidade();
  if (!el.ok) return erro(`Sem estimativa automática (${el.motivos.join(", ")}): personalize a meta com sua equipe de saúde.`);
  if (profile.sexo !== "M" && profile.sexo !== "F") return erro("Para estimar, informe no Perfil o sexo usado nas equações de referência. Ou personalize a meta.");
  const total = AGUA_EFSA_TOTAL[profile.sexo];
  const valor = Math.round(total * (1 - AGUA_FRACAO_ALIMENTOS));
  return { ok: true, meta: {
    tipo: "agua", valor, unidade: "ml/dia", origem: "estimada", versao: METAS_VERSAO, escopo: "bebidas_total", sentido: "meta",
    metodo: `EFSA: água total ${fmtMl(total)}/dia − 20% vindos dos alimentos = ${fmtMl(valor)} de bebidas`,
    fonte_url: META_FONTES.efsa_agua,
    dados_utilizados: { sexo_coeficiente: profile.sexo, idade: idadeAtual(), agua_total_ml: total, fracao_alimentos: AGUA_FRACAO_ALIMENTOS, usa_peso: false, usa_altura: false }
  } };
}

const aguaNivel = pct => Math.min(100, Math.max(0, Number(pct) || 0));
// fração da silhueta preenchida (0 a 1); sem meta válida = 0 (nunca NaN)
const progressoVisual = (consumo, meta) => (isNum(consumo) && isNum(meta) && meta > 0 ? Math.min(1, Math.max(0, consumo / meta)) : 0);

function comparaAgua(k = cur) {
  const a = aguaDia(k);
  const m = metaVigente("agua", k);
  const escopo = m && m.escopo === "bebidas_total" ? "bebidas_total" : "agua_pura";
  const consumo = a.n ? (escopo === "bebidas_total" ? a.total_ml : a.agua_pura_ml) : null;
  if (!m || !(m.valor > 0)) return { consumo, meta: null, pct: null, escopo, sentido: null, status: a.n ? "sem_meta" : "sem_registro", alto: false, restante: null, excedente: null };
  const limite = m.sentido === "limite";
  const pct = consumo == null ? null : consumo / m.valor * 100;
  const status = consumo == null ? "sem_registro"
    : limite ? (consumo > m.valor ? "acima_limite" : "dentro_limite")
    : (consumo >= m.valor ? "alcancada" : "abaixo");
  const alto = !limite && consumo != null && consumo > Math.max(2 * m.valor, 4000);
  return { consumo, meta: m.valor, pct, escopo, sentido: limite ? "limite" : "meta", status, alto,
    restante: Math.max(0, m.valor - (consumo || 0)), excedente: Math.max(0, (consumo || 0) - m.valor) };
}

/* ---------- Tela ---------- */
const ESCOPO_ROTULO = { agua_pura: "água pura", bebidas_total: "todas as bebidas" };
const ORIGEM_AGUA = { estimada: "estimada (EFSA)", manual: "personalizada", profissional: "do profissional" };
const fmtMl = v => (v == null ? "—" : v >= 1000 ? fmt1(v / 1000) + " L" : fmt(v) + " ml");

// silhueta (pictograma): cabeça e corpo; a água é recortada por esse contorno
const SILHUETA_PATH = "M60 8a20 20 0 1 1 0 40a20 20 0 1 1 0-40z"
  + "M60 54C78 54 94 58 99 70L109 136C110 144 106 149 101 149C96 149 93 145 92 139L85 92L84 148L82 244"
  + "C82 250 79 253 74 253H68C64 253 62 250 62 244L61 160H59L58 244C58 250 56 253 52 253H46C41 253 38 250 38 244"
  + "L36 148L35 92L28 139C27 145 24 149 19 149C14 149 10 144 11 136L21 70C26 58 42 54 60 54Z";
const SIL_TOPO = 4, SIL_BASE = 253;

function montarSilhueta() {
  const box = $("aguaFig");
  if (box.dataset.ok) return;
  box.dataset.ok = "1";
  box.innerHTML = `<svg viewBox="0 0 120 260" role="img" aria-labelledby="aguaFigTit">`
    + `<title id="aguaFigTit">Progresso da meta de água do dia</title>`
    + `<defs><clipPath id="silClip"><path d="${SILHUETA_PATH}"/></clipPath></defs>`
    + `<path d="${SILHUETA_PATH}" class="sil-fundo"/>`
    + `<g clip-path="url(#silClip)"><g class="nivel" style="transform:translateY(${SIL_BASE + 8}px)">`
    + `<g class="onda"><path d="M-120 0q15-4 30 0t30 0t30 0t30 0t30 0t30 0t30 0t30 0t30 0t30 0t30 0t30 0V280H-120z"/></g>`
    + `</g></g>`
    + `<path d="${SILHUETA_PATH}" class="sil-borda"/>`
    + `</svg>`;
}

function renderSilhueta(c) {
  montarSilhueta();
  const p = c.sentido === "limite" ? Math.min(1, (c.consumo || 0) / c.meta) : progressoVisual(c.consumo, c.meta);
  const topo = p > 0 ? SIL_BASE - p * (SIL_BASE - SIL_TOPO) : SIL_BASE + 8;
  const fig = $("aguaFig");
  const g = fig.querySelector(".nivel"), tit = fig.querySelector("title");
  if (g) {
    g.style.transform = `translateY(${topo.toFixed(1)}px)`;
    g.classList.toggle("alerta", c.status === "acima_limite");
  }
  if (tit) tit.textContent = c.meta == null ? "Sem meta de água definida: silhueta vazia"
    : `Progresso da meta de água do dia: ${fmt(p * 100)}%`;
}

function renderAguaResumo() {
  const a = aguaDia(cur);
  const c = comparaAgua(cur);
  const m = metaVigente("agua", cur);
  $("aguaTotalLbl").textContent = cur === TODAY ? "Consumido hoje" : `Consumido em ${dataBr(cur)}`;
  $("aguaTotal").textContent = c.consumo == null ? "0 ml" : fmtMl(c.consumo);
  $("aguaOutras").textContent = a.n === 0 ? "Nenhuma bebida registrada neste dia."
    : `Água pura ${fmtMl(a.agua_pura_ml)} · outras bebidas ${fmtMl(a.outras_bebidas_ml)}` + (c.escopo === "agua_pura" && a.outras_bebidas_ml ? " (a meta conta só água pura)" : "");
  $("aguaMetaLink").classList.toggle("hide", !!m);
  if (!m) {
    $("aguaMetaTxt").textContent = "Sem meta de água para este dia.";
    $("aguaPct").textContent = "—";
    $("aguaRestante").textContent = "Defina uma meta no Perfil para acompanhar o progresso.";
  } else if (c.sentido === "limite") {
    $("aguaMetaTxt").textContent = `Limite diário: ${fmtMl(m.valor)} (${ESCOPO_ROTULO[c.escopo]}, definido por profissional)`;
    $("aguaPct").textContent = c.consumo == null ? "0% do limite" : `${fmt(c.pct)}% do limite`;
    $("aguaRestante").textContent = c.status === "acima_limite" ? `Acima do limite em ${fmtMl(c.excedente)}` : `Restam ${fmtMl(c.restante)} até o limite`;
  } else {
    $("aguaMetaTxt").textContent = `Meta: ${fmtMl(m.valor)} · ${ORIGEM_AGUA[m.origem] || "personalizada"} · ${ESCOPO_ROTULO[c.escopo]}`;
    $("aguaPct").textContent = `${fmt(c.pct || 0)}% da meta`;
    $("aguaRestante").textContent = c.status === "alcancada"
      ? (c.excedente > 0 ? `Meta atingida. Total registrado ${fmtMl(c.excedente)} além da meta.` : "Meta atingida.")
      : `Faltam ${fmtMl(c.restante)}`;
  }
  $("aguaAviso").classList.toggle("hide", !c.alto);
  $("aguaAviso").textContent = c.alto ? "Volume alto registrado. Não é preciso passar da meta; em calor ou treino intenso, a necessidade é individual: converse com um profissional." : "";
  renderSilhueta(c);
}

function renderCopo() {
  const ml = prefs.copo_ml, tipo = AGUA_TIPOS[prefs.copo_tipo].toLowerCase();
  $("aguaCopoVol").textContent = "+" + fmt(ml) + " ml";
  $("aguaCopoAtual").textContent = `Cada toque adiciona ${fmt(ml)} ml de ${tipo}` + (cur !== TODAY ? ` em ${dataBr(cur)}` : "") + ".";
  document.querySelectorAll("#aguaCopoOpcoes [data-copo]").forEach(b => b.setAttribute("aria-pressed", String(Number(b.dataset.copo) === ml)));
  if (document.activeElement !== $("aguaCopoMl")) $("aguaCopoMl").value = COPO_OPCOES.includes(ml) ? "" : String(ml);
  $("aguaTipo").value = prefs.copo_tipo;
  const u = aguaDesfazer.length ? aguaDesfazer[aguaDesfazer.length - 1] : null;
  const reg = u && days[u.k] && (days[u.k].agua || []).find(x => x.id === u.id);
  $("aguaDesfazer").disabled = !reg;
  $("aguaUltimo").textContent = reg ? `Último: +${fmt(reg.ml)} ml às ${horaDe(reg.t)}` + (u.k !== TODAY ? ` (${dataBr(u.k)})` : "") : "Nada para desfazer.";
}

function renderAguaList() {
  const list = days[cur] && Array.isArray(days[cur].agua) ? days[cur].agua : [];
  const box = $("aguaList");
  if (!list.length) { box.innerHTML = '<div class="empty">Nenhum registro de bebida neste dia.</div>'; return; }
  box.innerHTML = '<ul class="rlist">' + list.slice().reverse().map(x => {
    const hora = horaDe(x.t), nome = AGUA_TIPOS[x.tipo];
    return `<li class="item"><div class="n"><div>${nome}</div><small>${hora}</small></div>`
      + `<div class="kc num">${fmt(x.ml)} ml</div>`
      + `<button type="button" class="ib" data-edit="${escapeHtml(x.id)}" aria-label="Editar ${fmt(x.ml)} ml às ${hora}">${ICON_EDIT}</button>`
      + `<button type="button" class="ib del" data-del="${escapeHtml(x.id)}" aria-label="Excluir ${fmt(x.ml)} ml às ${hora}">${ICON_DEL}</button></li>`;
  }).join("") + "</ul>";
}

// últimos 7 dias até o dia mostrado: volume no escopo da meta e a meta de cada dia
function renderAguaSemana() {
  const dias = [];
  for (let i = 6; i >= 0; i--) {
    const k = addDays(cur, -i), c = comparaAgua(k);
    dias.push({ k, v: c.consumo, meta: c.meta, alerta: c.status === "acima_limite" });
  }
  graficoBarrasDia($("aguaSemana"), dias, {
    rotulo: "Água registrada nos 7 dias até " + dataBr(cur) + ", com a meta de cada dia",
    cor: "--water", fmtV: fmtMl, nomeMeta: "Meta", fmtEixo: v => (v >= 1000 ? fmt1(v / 1000) + " L" : fmt(v)),
    vazio: "Nenhuma bebida registrada nesses 7 dias."
  });
}

// formulário da meta (no Perfil)
function renderAguaMeta() {
  const m = metaVigente("agua", TODAY);
  $("aguaMetaSum").textContent = m ? fmtMl(m.valor) + (m.sentido === "limite" ? " (limite)" : m.origem === "estimada" ? " · estimada" : " · personalizada") : "sem meta";
  $("aguaMetaAtual").textContent = m
    ? `Vigente: ${fmtMl(m.valor)} por dia · ${m.metodo} · ${ESCOPO_ROTULO[m.escopo] || "água pura"} · desde ${dataBr(m.vigencia_inicio)}.`
    : "Sem meta de água. Escolha uma estimativa ou personalize.";
  const est = estimarMetaAgua();
  $("aguaEstimativa").textContent = est.ok
    ? `Estimativa disponível: ${fmtMl(est.meta.valor)} de bebidas por dia. Usa só o sexo (coeficiente) e a idade para conferir o escopo; peso e altura não mudam a referência da EFSA para adultos.`
    : est.erro;
  if (!$("aguaMetaOrigem").dataset.init) {
    $("aguaMetaOrigem").dataset.init = "1";
    $("aguaMetaOrigem").value = m ? m.origem : est.ok ? "estimada" : "manual";
    if (m && m.origem !== "estimada") { $("aguaMetaValor").value = m.valor; $("aguaMetaEscopo").value = m.escopo; $("aguaMetaSentido").value = m.sentido; }
  }
  atualizarCamposMetaAgua();
}

function atualizarCamposMetaAgua() {
  const o = $("aguaMetaOrigem").value;
  $("aguaMetaManual").classList.toggle("hide", o !== "manual" && o !== "profissional");
  $("aguaMetaSentido").disabled = o !== "profissional";
  if (o !== "profissional") $("aguaMetaSentido").value = "meta";
}

function renderAgua() {
  renderAguaResumo();
  renderCopo();
  renderAguaList();
  renderAguaSemana();
}

function aguaRegistradaMsg(r) {
  return `+${fmt(r.registro.ml)} ml de ${AGUA_TIPOS[r.registro.tipo].toLowerCase()} registrados`
    + (r.salvo === false ? ". Atenção: não consegui salvar no navegador." : ".");
}

function adicionarAguaAvulsa() {
  limparErroCampo("aguaErro");
  const v = parseNumBR($("aguaMl").value);
  const r = Number.isNaN(v) ? { ok: false, erro: "Use só números, por exemplo 350." } : addAgua(v, $("aguaMlTipo").value);
  if (!r.ok) { mostrarErroCampo("aguaErro", r.erro, "aguaMl"); return; }
  aguaDesfazer.push({ id: r.registro.id, k: cur });
  $("aguaMl").value = "";
  toast(aguaRegistradaMsg(r));
  renderAll();
}

function salvarMetaAgua() {
  limparErroCampo("aguaMetaErro");
  const origem = $("aguaMetaOrigem").value;
  if (origem === "nenhuma") { encerrarMeta("agua"); toast("Meta de água removida a partir de hoje. Os dias anteriores mantêm a meta da época."); renderAll(); return; }
  let r;
  if (origem === "estimada") r = estimarMetaAgua();
  else {
    const v = parseNumBR($("aguaMetaValor").value);
    r = Number.isNaN(v) ? erro("Use só números, por exemplo 2000.") : metaAguaInformada(v, { origem, escopo: $("aguaMetaEscopo").value, sentido: $("aguaMetaSentido").value });
  }
  if (!r.ok) { mostrarErroCampo("aguaMetaErro", r.erro, origem === "estimada" ? null : "aguaMetaValor"); return; }
  definirMeta(r.meta);
  toast(`Meta de água salva: ${fmtMl(r.meta.valor)} a partir de hoje. Os dias anteriores mantêm a meta da época.`, 3600);
  renderAll();
}

function editarAgua(id) {
  const k = cur;
  const x = (days[k] && days[k].agua || []).find(a => a.id === id);
  if (!x) return;
  abrirEdicao({
    titulo: "Editar registro de bebida", retorno: "aguaList",
    campos: [
      { id: "ml", rotulo: "Volume (ml)", tipo: "inteiro", valor: x.ml },
      { id: "hora", rotulo: "Horário", tipo: "time", valor: horaDe(x.t) },
      { id: "tipo", rotulo: "Bebida", tipo: "select", valor: x.tipo, opcoes: Object.entries(AGUA_TIPOS) }
    ],
    salvar: v => {
      const ml = parseNumBR(v.ml);
      if (Number.isNaN(ml)) return { erro: "Use só números, por exemplo 250.", campo: "ml" };
      const r = updateAgua(id, { ml, hora: v.hora, tipo: v.tipo }, k);
      if (!r.ok) return r;
      toast("Registro atualizado");
      renderAll();
      return { ok: true };
    }
  });
}

let aguaIniciada = false;
function initAgua() {
  if (aguaIniciada) return;   // listeners uma vez só: um toque = um registro
  aguaIniciada = true;
  $("aguaCopo").addEventListener("click", () => {
    const r = registrarCopo();
    if (!r.ok) { toast(r.erro); return; }
    toast(aguaRegistradaMsg(r) + " Use “Desfazer” se foi sem querer.");
    renderAll();
    const g = $("aguaCopo");
    g.classList.remove("pulso"); void g.offsetWidth; g.classList.add("pulso");
  });
  $("aguaDesfazer").addEventListener("click", () => {
    const r = desfazerAgua();
    toast(r.ok ? `Desfeito: ${fmt(r.registro.ml)} ml das ${horaDe(r.registro.t)} removidos.` : "Nada para desfazer.");
    renderAll();
  });
  $("aguaCopoOpcoes").addEventListener("click", e => {
    const b = e.target && e.target.closest ? e.target.closest("[data-copo]") : null;
    if (!b) return;
    limparErroCampo("aguaCopoErro");
    definirCopo(Number(b.dataset.copo));
    toast(`Copo de ${fmt(prefs.copo_ml)} ml. Os registros anteriores não mudam.`);
    renderAll();
  });
  const salvarCopo = () => {
    limparErroCampo("aguaCopoErro");
    const r = definirCopo($("aguaCopoMl").value);
    if (!r.ok) { mostrarErroCampo("aguaCopoErro", r.erro, "aguaCopoMl"); return; }
    toast(`Copo de ${fmt(r.ml)} ml. Os registros anteriores não mudam.`);
    renderAll();
  };
  $("aguaCopoSalvar").addEventListener("click", salvarCopo);
  $("aguaCopoMl").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); salvarCopo(); } });
  $("aguaTipo").addEventListener("change", () => {
    prefs.copo_tipo = $("aguaTipo").value === "outra" ? "outra" : "agua";
    persist();
    renderCopo();
  });
  $("aguaAdd").addEventListener("click", adicionarAguaAvulsa);
  $("aguaMl").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); adicionarAguaAvulsa(); } });
  $("aguaList").addEventListener("click", e => {
    const b = e.target && e.target.closest ? e.target.closest("[data-del],[data-edit]") : null;
    if (!b) return;
    if (b.dataset.edit) { editarAgua(b.dataset.edit); return; }
    const x = (days[cur] && days[cur].agua || []).find(a => a.id === b.dataset.del);
    if (!x || !confirmar(`Excluir o registro de ${fmt(x.ml)} ml das ${horaDe(x.t)}?`)) return;
    removeAgua(x.id);
    toast("Registro excluído");
    renderAll();
    $("aguaList").focus();
  });
  $("aguaMetaOrigem").addEventListener("change", atualizarCamposMetaAgua);
  $("aguaMetaSalvar").addEventListener("click", salvarMetaAgua);
}
