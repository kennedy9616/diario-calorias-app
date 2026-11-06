/* ==========================================================
   Metas versionadas (calorias, proteína; água no js/water.js)
   Cada meta guarda valor, unidade, método, fonte, versão, data do
   cálculo, vigência, dados usados e origem. Cada dia é comparado
   com a meta vigente naquele dia. Metas são estimativas ajustáveis,
   não prescrição: o app só estima para adultos de 18 a 64 anos sem
   condição especial (elegibilidade(), js/body.js).
   ========================================================== */

const METAS_VERSAO = "1.0";
const META_TIPOS = ["kcal", "proteina", "agua"];
const META_ORIGENS = ["estimada", "profissional", "manual"];
const META_FONTES = {
  mifflin: "https://pubmed.ncbi.nlm.nih.gov/2305711/",
  niddk: "https://www.niddk.nih.gov/health-information/weight-management/body-weight-planner",
  efsa_prot: "https://www.efsa.europa.eu/en/press/news/120209",
  issn_prot: "https://link.springer.com/article/10.1186/s12970-017-0177-8",
  efsa_agua: "https://www.efsa.europa.eu/en/efsajournal/pub/1459",
  oms: "https://www.who.int/europe/publications/i/item/9789240014886",
  forca: "https://www.nhs.uk/live-well/exercise/how-to-improve-strength-flexibility/"
};
// 10–15% é proposta inicial do produto, não recomendação universal (validar com profissional)
const DEFICIT_OPCOES = [0, 0.10, 0.15];
const PROT_CRITERIOS = {
  efsa: { coef: 0.83, n: "EFSA: referência populacional, adulto saudável", fonte: "efsa_prot" },
  issn14: { coef: 1.4, n: "ISSN: treino regular", fonte: "issn_prot" },
  issn16: { coef: 1.6, n: "ISSN: treino regular", fonte: "issn_prot" },
  issn18: { coef: 1.8, n: "ISSN: treino regular", fonte: "issn_prot" },
  issn20: { coef: 2.0, n: "ISSN: treino regular", fonte: "issn_prot" }
};
const KCAL_FAIXA = [500, 10000];   // plausível para meta informada por profissional
const PROT_FAIXA = [10, 400];

/* ---------- Cálculos ---------- */
const metaConsumo = (manutencao, pct) => manutencao * (1 - pct);
const deficitPlanejado = (manutencao, meta) => manutencao - meta;
const imc = (pesoKg, alturaCm) => pesoKg / Math.pow(alturaCm / 100, 2);
const treinoRegular = () => { const t = profile.treino || {}; return t.tipo !== "nenhum" && Number(t.dias) >= 2; };
const erro = msg => ({ ok: false, erro: msg });

function foraDoEscopo() {
  const el = elegibilidade();
  return el.ok ? null : erro(`Sem metas automáticas (${el.motivos.join(", ")}): defina com sua equipe de saúde.`);
}

function estimarMetaKcal(pct) {
  const fora = foraDoEscopo();
  if (fora) return fora;
  if (!DEFICIT_OPCOES.includes(pct)) return erro("Déficit precisa ser 0, 10% ou 15%.");
  if (pct > 0 && profile.objetivo !== "perder") return erro("Déficit só com o objetivo “perder peso”.");
  const p = perfilCalculo();
  const ref = pesoReferencia();
  const manut = tdee(p);
  const valor = Math.round(metaConsumo(manut, pct));
  return { ok: true, meta: {
    tipo: "kcal", valor, unidade: "kcal/dia", origem: "estimada", versao: METAS_VERSAO,
    metodo: `Mifflin-St Jeor (repouso) × rotina ${fmt1(Number(p.fator))}` + (pct ? ` × (1 − ${Math.round(pct * 100)}%)` : ""),
    fonte_url: META_FONTES.mifflin,
    dados_utilizados: {
      tmb: Math.round(tmb(p)), fator_atividade: Number(p.fator), fator_metodo: "rotina sem treinos v1",
      manutencao_estimada: Math.round(manut), percentual_deficit: pct, deficit_planejado: Math.round(deficitPlanejado(manut, valor)),
      peso_referencia: r1(p.peso), peso_metodo: ref.metodo, idade: p.idade, altura_cm: p.altura,
      sexo_coeficiente_equacao: p.sexo, objetivo: profile.objetivo
    }
  } };
}

// meta de calorias digitada: "profissional" (faixa plausível) ou "manual" (não abaixo da TMB)
function metaKcalInformada(valor, origem) {
  const v = Number(valor);
  if (!isNum(v) || v < KCAL_FAIXA[0] || v > KCAL_FAIXA[1]) return erro(`Informe entre ${fmt(KCAL_FAIXA[0])} e ${fmt(KCAL_FAIXA[1])} kcal.`);
  if (origem === "manual") {
    const piso = Math.round(tmb());
    if (v < piso) return erro(`Abaixo da sua TMB estimada (${fmt(piso)} kcal): metas assim só com acompanhamento profissional (origem “Profissional”).`);
  } else if (origem !== "profissional") return erro("Origem inválida.");
  return { ok: true, meta: {
    tipo: "kcal", valor: Math.round(v), unidade: "kcal/dia", origem, versao: METAS_VERSAO,
    metodo: origem === "profissional" ? "definida por profissional de saúde" : "definida pelo usuário",
    fonte_url: null, dados_utilizados: {}
  } };
}

function estimarMetaProteina(criterio) {
  const c = PROT_CRITERIOS[criterio];
  if (!c) return erro("Critério inválido.");
  const fora = foraDoEscopo();
  if (fora) return fora;
  const p = perfilCalculo();
  const ref = pesoReferencia();
  if (criterio !== "efsa") {
    if (!treinoRegular()) return erro("O critério ISSN vale para quem treina regularmente (2 ou mais dias por semana). Preencha seu treino.");
    if (imc(p.peso, p.altura) >= 30) return erro("Com IMC de 30 ou mais, o app não aplica coeficiente elevado ao peso atual: defina com profissional.");
  }
  return { ok: true, meta: {
    tipo: "proteina", valor: r1(ref.peso * c.coef), unidade: "g/dia", origem: "estimada", versao: METAS_VERSAO,
    metodo: `${fmt1(c.coef)} g/kg × peso de referência (${c.n})`,
    fonte_url: META_FONTES[c.fonte],
    dados_utilizados: { peso_referencia: r1(ref.peso), peso_metodo: ref.metodo, coeficiente_g_kg: c.coef, criterio, treino: clone(profile.treino || {}) }
  } };
}

function metaProteinaInformada(valor) {
  const v = Number(valor);
  if (!isNum(v) || v < PROT_FAIXA[0] || v > PROT_FAIXA[1]) return erro(`Informe entre ${PROT_FAIXA[0]} e ${PROT_FAIXA[1]} g.`);
  return { ok: true, meta: {
    tipo: "proteina", valor: r1(v), unidade: "g/dia", origem: "profissional", versao: METAS_VERSAO,
    metodo: "definida por profissional de saúde", fonte_url: null, dados_utilizados: {}
  } };
}

/* ---------- Histórico de metas ---------- */
const isKey = k => typeof k === "string" && /^\d{4}-\d{2}-\d{2}$/.test(k);

// fecha a meta vigente do tipo na véspera de "inicio" e descarta as que começariam depois
function fecharMetas(tipo, inicio) {
  metas = metas.filter(x => !(x.tipo === tipo && x.vigencia_inicio >= inicio));
  metas.forEach(x => {
    if (x.tipo === tipo && (x.vigencia_fim == null || x.vigencia_fim >= inicio)) x.vigencia_fim = addDays(inicio, -1);
  });
}

function definirMeta(meta, inicio = TODAY) {
  const m = Object.assign({ id: uid(), data_calculo: new Date().toISOString() }, meta, { vigencia_inicio: inicio, vigencia_fim: null });
  fecharMetas(m.tipo, inicio);
  metas.push(m);
  persist();
  return m;
}

function encerrarMeta(tipo, desde = TODAY) {
  fecharMetas(tipo, desde);
  persist();
}

function metaVigente(tipo, k = cur) {
  let best = null;
  metas.forEach(x => {
    if (x.tipo !== tipo || x.vigencia_inicio > k || (x.vigencia_fim != null && k > x.vigencia_fim)) return;
    if (!best || x.vigencia_inicio > best.vigencia_inicio) best = x;
  });
  return best;
}

function cleanMetas(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  return list.filter(m => m && typeof m === "object"
    && META_TIPOS.includes(m.tipo) && META_ORIGENS.includes(m.origem)
    && isNum(m.valor) && m.valor > 0
    && isKey(m.vigencia_inicio) && (m.vigencia_fim == null || isKey(m.vigencia_fim))
    && typeof m.id === "string" && !seen.has(m.id) && seen.add(m.id))
    .map(m => ({
      id: m.id, tipo: m.tipo, valor: m.valor, unidade: String(m.unidade || ""), origem: m.origem,
      metodo: String(m.metodo || ""), fonte_url: typeof m.fonte_url === "string" ? m.fonte_url : null,
      versao: String(m.versao || METAS_VERSAO), data_calculo: m.data_calculo || null,
      vigencia_inicio: m.vigencia_inicio, vigencia_fim: m.vigencia_fim || null,
      dados_utilizados: m.dados_utilizados && typeof m.dados_utilizados === "object" ? m.dados_utilizados : {},
      ...(m.tipo === "agua" ? { escopo: m.escopo === "bebidas_total" ? "bebidas_total" : "agua_pura", sentido: m.sentido === "limite" ? "limite" : "meta" } : {})
    }));
}

// versão 1.1 guardava só profile.meta (kcal digitada): vira meta manual desde o primeiro dia registrado
function migrarMetaAntiga() {
  const v = Number(profile.meta);
  profile.meta = null;
  if (!(v > 0) || metas.some(m => m.tipo === "kcal")) return;
  const inicio = Object.keys(days).sort()[0] || TODAY;
  metas.push({
    id: "migrada-kcal", tipo: "kcal", valor: Math.round(v), unidade: "kcal/dia", origem: "manual",
    metodo: "definida pelo usuário (versão 1.1)", fonte_url: null, versao: METAS_VERSAO,
    data_calculo: null, vigencia_inicio: inicio, vigencia_fim: null, dados_utilizados: {}
  });
}

/* ---------- Tela: cartão "Metas e objetivo" ---------- */
const dataBr = k => fromKey(k).toLocaleDateString("pt-BR");

function metaResumo(m, unidade) {
  if (!m) return "Sem meta definida.";
  const orig = { estimada: "estimativa do app", profissional: "profissional de saúde", manual: "definida por você" }[m.origem];
  return `${m.tipo === "kcal" ? fmt(m.valor) : fmt1(m.valor)} ${unidade} · ${orig} · desde ${dataBr(m.vigencia_inicio)}. ${m.metodo}.`;
}

function renderMetasForm() {
  const t = profile.treino || {};
  $("mtObjetivo").value = profile.objetivo || "manter";
  $("mtTreinoTipo").value = t.tipo || "nenhum";
  $("mtTreinoDias").value = t.dias || "";
  $("mtTreinoMin").value = t.min || "";
  $("mtTreinoInt").value = t.intensidade || "moderada";
  $("mtKAtual").textContent = metaResumo(metaVigente("kcal", TODAY), "kcal/dia");
  $("mtPAtual").textContent = metaResumo(metaVigente("proteina", TODAY), "g/dia");
  const k = metaVigente("kcal", TODAY), p = metaVigente("proteina", TODAY);
  // na primeira vez, o formulário mostra a meta atual (salvar sem mexer não apaga nada)
  if (!$("mtKOrigem").dataset.init) {
    $("mtKOrigem").dataset.init = "1";
    $("mtKOrigem").value = k ? k.origem : "nenhuma";
    if (k && k.origem !== "estimada") $("mtKValor").value = k.valor;
    if (k && k.origem === "estimada") $("mtKDef").value = String(k.dados_utilizados.percentual_deficit || 0);
    $("mtPCrit").value = !p ? "nenhuma" : p.origem === "estimada" ? p.dados_utilizados.criterio : "profissional";
    if (p && p.origem !== "estimada") $("mtPValor").value = p.valor;
  }
  $("metasSum").textContent = [k && fmt(k.valor) + " kcal", p && fmt1(p.valor) + " g prot"].filter(Boolean).join(" · ");
  updateMetaFields();
}

function updateMetaFields() {
  const o = $("mtKOrigem").value;
  $("mtKDefBox").classList.toggle("hide", o !== "estimada");
  $("mtKValorBox").classList.toggle("hide", o !== "profissional" && o !== "manual");
  $("mtKDef").disabled = $("mtObjetivo").value !== "perder";
  if ($("mtKDef").disabled) $("mtKDef").value = "0";
  $("mtPValorBox").classList.toggle("hide", $("mtPCrit").value !== "profissional");
}

function readTreino() {
  const dias = parseInt($("mtTreinoDias").value, 10), min = parseInt($("mtTreinoMin").value, 10);
  profile.objetivo = $("mtObjetivo").value === "perder" ? "perder" : "manter";
  profile.treino = {
    tipo: $("mtTreinoTipo").value,
    dias: dias >= 0 && dias <= 7 ? dias : 0,
    min: min > 0 && min <= 600 ? min : 0,
    intensidade: $("mtTreinoInt").value
  };
  updateMetaFields();
  saveProfile();
}

function salvarMetaKcal() {
  const o = $("mtKOrigem").value;
  if (o === "nenhuma") { encerrarMeta("kcal"); $("mtKErro").textContent = ""; toast("Meta de calorias removida a partir de hoje."); renderAll(); return; }
  const r = o === "estimada" ? estimarMetaKcal(Number($("mtKDef").value)) : metaKcalInformada(numIn("mtKValor"), o);
  $("mtKErro").textContent = r.ok ? "" : r.erro;
  if (!r.ok) return;
  definirMeta(r.meta);
  if (days[TODAY]) saveDay(TODAY);
  toast("Meta de calorias salva (vale a partir de hoje).");
  renderAll();
}

function salvarMetaProteina() {
  const c = $("mtPCrit").value;
  if (c === "nenhuma") { encerrarMeta("proteina"); $("mtPErro").textContent = ""; toast("Meta de proteína removida a partir de hoje."); renderAll(); return; }
  const r = c === "profissional" ? metaProteinaInformada(numIn("mtPValor")) : estimarMetaProteina(c);
  $("mtPErro").textContent = r.ok ? "" : r.erro;
  if (!r.ok) return;
  definirMeta(r.meta);
  toast("Meta de proteína salva (vale a partir de hoje).");
  renderAll();
}

function initMetasForm() {
  ["mtObjetivo", "mtTreinoTipo", "mtTreinoDias", "mtTreinoMin", "mtTreinoInt"].forEach(id => $(id).addEventListener("change", readTreino));
  ["mtKOrigem", "mtPCrit"].forEach(id => $(id).addEventListener("change", updateMetaFields));
  $("mtKSalvar").onclick = salvarMetaKcal;
  $("mtPSalvar").onclick = salvarMetaProteina;
}
