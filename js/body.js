/* ==========================================================
   Corpo: histórico de peso e medidas, peso atual e TMB
   Regras (iguais em todo o app):
   - Mesma data com várias pesagens: vale a média das pesagens do dia.
   - Peso atual = peso do dia mais recente com pesagem (pela data da
     medição, não pela ordem em que foi digitada). Uma medição antiga
     incluída depois não substitui o peso atual.
   - Peso usado nos cálculos (referência):
       1) média dos dias com pesagem nos últimos 7 dias, quando há
          pesagens em pelo menos 3 desses dias;
       2) senão, o peso atual (última pesagem até aquele dia);
       3) sem pesagens, o peso informado no cadastro antigo (versão ≤ 1.2).
   - Editar ou registrar um peso nunca apaga as medições anteriores.
   ========================================================== */

const TMB_METODO = { nome: "Mifflin-St Jeor", versao: "1.1", fonte_url: "https://pubmed.ncbi.nlm.nih.gov/2305711/" };
const TENDENCIA_DIAS = 7;
const TENDENCIA_MIN_DIAS = 3;
const PESO_METODO_ROTULO = {
  tendencia_7d: "média dos últimos 7 dias",
  ultima_pesagem: "última pesagem",
  manual: "informado no cadastro (sem data)",
  sem_dado: "sem peso registrado"
};

/* ---------- Validação e lista ---------- */
function validarMedida(src) {
  const m = src || {};
  const data = String(m.data || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || keyOf(fromKey(data)) !== data) return { ok: false, erro: "Data inválida." };
  if (data > TODAY) return { ok: false, erro: "A data não pode ser no futuro." };
  const out = {
    id: typeof m.id === "string" && m.id ? m.id.slice(0, 40) : uid(),
    data,
    t: isNum(m.t) ? m.t : Date.now()
  };
  let algum = false;
  for (const c of MEDIDAS_CAMPOS) {
    const v = m[c.k];
    if (v == null || v === "") { out[c.k] = null; continue; }
    if (!isNum(v) || v < c.min || v > c.max) {
      return { ok: false, erro: `${c.n}: informe um valor entre ${fmt(c.min)} e ${fmt(c.max)} ${c.u}.`, campo: c.k };
    }
    out[c.k] = r1(v);
    algum = true;
  }
  if (!algum) return { ok: false, erro: "Informe pelo menos uma medida." };
  return { ok: true, medida: out };
}

const ordemMedida = (a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : a.t - b.t);

// válidas, sem id repetido (fica a primeira), em ordem de data
function cleanMedidas(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  list.forEach(x => {
    const r = validarMedida(x);
    if (!r.ok || seen.has(r.medida.id)) return;
    seen.add(r.medida.id);
    out.push(r.medida);
  });
  return out.sort(ordemMedida);
}

function addMedida(input) {
  const r = validarMedida(input);
  if (!r.ok) return r;
  medidas.push(r.medida);
  medidas.sort(ordemMedida);
  persist();
  return r;
}

// corrige uma medição (mesmo id e horário de criação); as outras ficam como estão
function updateMedida(id, input) {
  const i = medidas.findIndex(m => m.id === id);
  if (i < 0) return { ok: false, erro: "Medição não encontrada." };
  const r = validarMedida(Object.assign({}, input, { id, t: medidas[i].t }));
  if (!r.ok) return r;
  medidas[i] = r.medida;
  medidas.sort(ordemMedida);
  persist();
  return r;
}

function removeMedida(id) {
  medidas = medidas.filter(m => m.id !== id);
  persist();
}

/* ---------- Peso: dia, atual, tendência, variação ---------- */
// [{ data, peso (média do dia), n (pesagens no dia) }] em ordem de data
function pesosDiarios(lista = medidas) {
  const map = new Map();
  lista.forEach(m => {
    if (!isNum(m.peso_kg)) return;
    const d = map.get(m.data) || { data: m.data, soma: 0, n: 0 };
    d.soma += m.peso_kg;
    d.n++;
    map.set(m.data, d);
  });
  return [...map.values()]
    .sort((a, b) => (a.data < b.data ? -1 : 1))
    .map(d => ({ data: d.data, peso: d.soma / d.n, n: d.n }));
}

// peso atual em uma data: dia mais recente com pesagem até "ate"
function pesoAtual(ate = TODAY, lista = medidas) {
  const ult = pesosDiarios(lista).filter(d => d.data <= ate).pop();
  if (ult) return { peso: ult.peso, data: ult.data, n: ult.n, metodo: "ultima_pesagem" };
  if (naFaixa(profile.peso, FAIXA_PESO)) return { peso: profile.peso, data: null, n: 0, metodo: "manual" };
  return { peso: null, data: null, n: 0, metodo: "sem_dado" };
}

function tendenciaDe(diarios, ate) {
  const ini = addDays(ate, -(TENDENCIA_DIAS - 1));
  const vals = diarios.filter(d => d.data >= ini && d.data <= ate);
  if (!vals.length) return { peso: null, dias: 0 };
  return { peso: vals.reduce((s, d) => s + d.peso, 0) / vals.length, dias: vals.length };
}

function pesoTendencia(ate = TODAY, lista = medidas) {
  return tendenciaDe(pesosDiarios(lista), ate);
}

// semana atual × semana anterior (mesmo tamanho de janela); só com cobertura nas duas
function variacaoSemanal(ate = TODAY) {
  const diarios = pesosDiarios();
  const a = tendenciaDe(diarios, ate);
  const b = tendenciaDe(diarios, addDays(ate, -TENDENCIA_DIAS));
  const ok = a.dias >= TENDENCIA_MIN_DIAS && b.dias >= TENDENCIA_MIN_DIAS;
  return { delta: ok ? a.peso - b.peso : null, atual: a.peso, anterior: b.peso, diasAtual: a.dias, diasAnterior: b.dias };
}

// para o gráfico: pesagem de cada dia e a média de 7 dias (quando há 3+ dias)
function serieTendencia(ate = TODAY, n = 30) {
  const diarios = pesosDiarios();
  const porDia = new Map(diarios.map(d => [d.data, d.peso]));
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const k = addDays(ate, -i);
    const t = tendenciaDe(diarios, k);
    out.push({ data: k, peso: porDia.has(k) ? porDia.get(k) : null, media: t.dias >= TENDENCIA_MIN_DIAS ? t.peso : null });
  }
  return out;
}

/* ---------- Dados usados no cálculo ---------- */
function pesoReferencia(ate = TODAY) {
  const t = pesoTendencia(ate);
  if (t.dias >= TENDENCIA_MIN_DIAS) return { peso: t.peso, metodo: "tendencia_7d", dias: t.dias, data: null };
  const a = pesoAtual(ate);
  return { peso: a.peso, metodo: a.metodo, dias: t.dias, data: a.data };
}

// idade completa em anos na data k; null se a data de nascimento for inválida
function idadeEm(nasc, k) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(nasc || ""))) return null;
  const [y1, m1, d1] = nasc.split("-").map(Number);
  const [y2, m2, d2] = k.split("-").map(Number);
  const idade = y2 - y1 - ((m2 < m1 || (m2 === m1 && d2 < d1)) ? 1 : 0);
  return idade >= 0 && idade < 130 ? idade : null;
}

function idadeAtual(k = TODAY) {
  const i = idadeEm(profile.nascimento, k);
  return i == null ? (isNum(profile.idade) ? profile.idade : null) : i;
}

// perfil com o peso de referência e a idade daquele dia
function perfilCalculo(k = TODAY) {
  return Object.assign({}, profile, { peso: pesoReferencia(k).peso, idade: idadeAtual(k) });
}

// metas automáticas só para adultos de 18 a 64 anos sem condição especial
function elegibilidade() {
  const motivos = [];
  const idade = idadeAtual();
  if (idade == null) motivos.push("Idade não informada");
  else if (idade < 18) motivos.push("Menor de 18 anos");
  else if (idade > 64) motivos.push("65 anos ou mais");
  (profile.condicoes || []).forEach(k => {
    const c = CONDICOES.find(x => x.k === k);
    if (c) motivos.push(c.n);
  });
  return { ok: !motivos.length, motivos };
}

/* ---------- Tela ---------- */
const dm = k => { const [, m, d] = k.split("-"); return `${d}/${m}`; };
const fmtKg = v => (v == null ? "—" : fmt1(v) + " kg");

function renderTmbCard() {
  const p = perfilCalculo();
  const ref = pesoReferencia();
  const b = tmb(p);
  if (b == null) {
    $("tmbVal").textContent = "—";
    $("tmbDet").innerHTML = `<li>Para estimar, complete no Perfil: <b>${escapeHtml(dadosFaltando(p).join(", "))}</b>.</li>`
      + `<li>Método: ${TMB_METODO.nome}</li>`;
  } else {
    const coef = p.sexo === "F" ? "feminino (−161)" : "masculino (+5)";
    const pesoTxt = ref.metodo === "tendencia_7d"
      ? `<b>${fmt1(ref.peso)} kg</b> · média de ${ref.dias} dia(s) com pesagem nos últimos 7`
      : ref.metodo === "ultima_pesagem"
        ? `<b>${fmt1(ref.peso)} kg</b> · última pesagem (${dataBr(ref.data)}). Com pesagens em ${TENDENCIA_MIN_DIAS} dos últimos 7 dias, passa a usar a média (agora: ${ref.dias}).`
        : `<b>${fmt1(ref.peso)} kg</b> · informado no cadastro. Registre uma pesagem para atualizar.`;
    $("tmbVal").textContent = fmt(b) + " kcal/dia";
    $("tmbDet").innerHTML = [
      `Gasto sem exercícios: <b>${fmt(tdee(p))} kcal</b> (TMB × ${fmt1(Number(p.fator))}, rotina sem treinos)`,
      `Peso usado: ${pesoTxt}`,
      `Idade ${fmt(p.idade)} · altura ${fmt(p.altura)} cm · coeficiente ${coef}`,
      `Método: ${TMB_METODO.nome} (10 × peso + 6,25 × altura − 5 × idade + coeficiente)`
    ].map(t => `<li>${t}</li>`).join("");
  }
  const el = elegibilidade();
  $("tmbAviso").classList.toggle("hide", el.ok);
  $("tmbAviso").textContent = el.ok ? "" :
    `Fora do escopo das estimativas automáticas (adultos de 18 a 64 anos, sem condições especiais): ${el.motivos.join(", ")}. Use estes números só com acompanhamento individualizado.`;
}

function renderPesoAtual() {
  const a = pesoAtual();
  $("pesoAtual").textContent = fmtKg(a.peso);
  $("pesoAtualSub").textContent = a.metodo === "ultima_pesagem"
    ? `Pesagem de ${dataBr(a.data)}` + (a.n > 1 ? ` (média de ${a.n} pesagens do dia)` : "")
    : a.metodo === "manual" ? "Informado no cadastro, sem data. Registre uma pesagem para atualizar."
    : "Nenhuma pesagem registrada.";
}

function renderPesoStats() {
  const t = pesoTendencia();
  $("pesoTend").textContent = t.peso == null ? "—" : fmt1(t.peso) + " kg";
  $("pesoTendSub").textContent = `${t.dias} de 7 dias com pesagem`;
  const v = variacaoSemanal();
  $("pesoVar").textContent = v.delta == null ? "—" : (v.delta > 0 ? "+" : v.delta < 0 ? "−" : "") + fmt1(Math.abs(v.delta)) + " kg";
  $("pesoVarSub").textContent = v.delta == null
    ? `Precisa de pesagens em ${TENDENCIA_MIN_DIAS}+ dias em cada semana (agora ${v.diasAtual}/7 e ${v.diasAnterior}/7)`
    : `vs. 7 dias anteriores · cobertura ${v.diasAtual}/7 e ${v.diasAnterior}/7`;
}

function renderPesoChart() {
  const ini = addDays(TODAY, -29);
  graficoPeso($("pesoChart"), pesosDiarios().filter(d => d.data >= ini), { ini, fim: TODAY, media: true });
}

function medidaTexto(m) {
  return MEDIDAS_CAMPOS.filter(c => m[c.k] != null)
    .map(c => (c.k === "peso_kg" ? "" : c.n.toLowerCase() + " ") + fmt1(m[c.k]) + " " + c.u).join(" · ");
}

function renderMedidaList() {
  const box = $("medidaList");
  if (!medidas.length) { box.innerHTML = '<div class="empty">Nenhuma medida registrada ainda.</div>'; return; }
  box.innerHTML = '<ul class="rlist">' + medidas.slice().reverse().map(m => {
    const txt = escapeHtml(medidaTexto(m)), data = fromKey(m.data).toLocaleDateString("pt-BR");
    return `<li class="item"><div class="n"><div>${txt}</div><small>${data}</small></div>`
      + `<button type="button" class="ib" data-edit="${escapeHtml(m.id)}" aria-label="Editar medição de ${data}">${ICON_EDIT}</button>`
      + `<button type="button" class="ib del" data-del="${escapeHtml(m.id)}" aria-label="Excluir medição de ${data}">${ICON_DEL}</button></li>`;
  }).join("") + "</ul>";
}

function renderCorpo() {
  renderTmbCard();
  renderPesoAtual();
  renderPesoStats();
  renderPesoChart();
  renderMedidaList();
}

// lê os campos de medida (aceita vírgula). Devolve { input } ou { erro, id } do campo inválido.
function lerCamposMedida(prefixo = "") {
  const input = {};
  for (const c of MEDIDAS_CAMPOS) {
    const v = parseNumBR($(prefixo + c.id).value);
    if (Number.isNaN(v)) return { erro: `${c.n}: use só números, por exemplo 72,5.`, id: prefixo + c.id };
    input[c.k] = v;
  }
  return { input };
}

function aposMudarPeso() {
  if (days[TODAY]) saveDay(TODAY);   // o dia de hoje guarda a TMB recalculada
  renderAll();
}

function editarMedida(id) {
  const m = medidas.find(x => x.id === id);
  if (!m) return;
  abrirEdicao({
    titulo: "Editar medição", retorno: "medidaList",
    campos: [{ id: "data", rotulo: "Data", tipo: "date", valor: m.data, max: TODAY }]
      .concat(MEDIDAS_CAMPOS.map(c => ({ id: c.k, rotulo: `${c.n} (${c.u})`, tipo: "decimal", valor: m[c.k] == null ? "" : String(m[c.k]).replace(".", ",") }))),
    salvar: v => {
      const input = { data: v.data };
      for (const c of MEDIDAS_CAMPOS) {
        const n = parseNumBR(v[c.k]);
        if (Number.isNaN(n)) return { erro: `${c.n}: use só números, por exemplo 72,5.`, campo: c.k };
        input[c.k] = n;
      }
      const r = updateMedida(id, input);
      if (!r.ok) return { erro: r.erro, campo: r.campo };
      aposMudarPeso();
      toast("Medição atualizada");
      return { ok: true };
    }
  });
}

function initBodyForm() {
  $("mData").value = TODAY;
  $("mData").max = TODAY;
  $("addMedida").onclick = () => {
    const lido = lerCamposMedida();
    limparErroCampo("medidaErro");
    if (lido.erro) { mostrarErroCampo("medidaErro", lido.erro, lido.id); return; }
    const r = addMedida(Object.assign({ data: $("mData").value || TODAY }, lido.input));
    if (!r.ok) {
      const c = MEDIDAS_CAMPOS.find(x => x.k === r.campo);
      mostrarErroCampo("medidaErro", r.erro, c ? c.id : null);
      return;
    }
    MEDIDAS_CAMPOS.forEach(c => { $(c.id).value = ""; });
    const a = pesoAtual();
    toast(r.medida.peso_kg != null && a.data && r.medida.data < a.data
      ? `Medição de ${dataBr(r.medida.data)} registrada no histórico (o peso atual continua o de ${dataBr(a.data)})`
      : "Medição registrada");
    aposMudarPeso();
  };
  $("medidaList").onclick = e => {
    const b = e.target && e.target.closest ? e.target.closest("[data-del],[data-edit]") : null;
    if (!b) return;
    if (b.dataset.edit) { editarMedida(b.dataset.edit); return; }
    const m = medidas.find(x => x.id === b.dataset.del);
    if (!m || !confirmar(`Excluir a medição de ${dataBr(m.data)} (${medidaTexto(m)})?`)) return;
    removeMedida(m.id);
    toast("Medição excluída");
    aposMudarPeso();
    $("medidaList").focus();
  };
}
