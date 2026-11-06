/* ==========================================================
   Corpo: histórico de peso e medidas, tendência e TMB
   - Várias pesagens no mesmo dia viram a média do dia (regra fixa).
   - Tendência = média dos dias com pesagem nos últimos 7 dias.
   - A TMB passa a usar a tendência quando há pesagens em pelo menos
     3 desses 7 dias; antes disso, usa o peso de "Meus dados".
     Uma pesagem isolada nunca muda o cálculo.
   ========================================================== */

const TMB_METODO = { nome: "Mifflin-St Jeor", versao: "1.0", fonte_url: "https://pubmed.ncbi.nlm.nih.gov/2305711/" };
const TENDENCIA_DIAS = 7;
const TENDENCIA_MIN_DIAS = 3;

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
      return { ok: false, erro: `${c.n}: informe um valor entre ${fmt(c.min)} e ${fmt(c.max)} ${c.u}.` };
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

function removeMedida(id) {
  medidas = medidas.filter(m => m.id !== id);
  persist();
}

/* ---------- Peso: dia, tendência, variação ---------- */
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
  if (t.dias >= TENDENCIA_MIN_DIAS) return { peso: t.peso, metodo: "tendencia_7d", dias: t.dias };
  return { peso: Number(profile.peso), metodo: "manual", dias: t.dias };
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
  return i == null ? Number(profile.idade) : i;
}

// perfil com o peso de referência e a idade daquele dia
function perfilCalculo(k = TODAY) {
  return Object.assign({}, profile, { peso: pesoReferencia(k).peso, idade: idadeAtual(k) });
}

// metas automáticas só para adultos de 18 a 64 anos sem condição especial
function elegibilidade() {
  const motivos = [];
  const idade = idadeAtual();
  if (!(idade >= 18)) motivos.push("Menor de 18 anos");
  else if (idade > 64) motivos.push("65 anos ou mais");
  (profile.condicoes || []).forEach(k => {
    const c = CONDICOES.find(x => x.k === k);
    if (c) motivos.push(c.n);
  });
  return { ok: !motivos.length, motivos };
}

/* ---------- Tela ---------- */
const dm = k => { const [, m, d] = k.split("-"); return `${d}/${m}`; };

function renderTmbCard() {
  const p = perfilCalculo();
  const ref = pesoReferencia();
  const coef = p.sexo === "F" ? "feminino (−161)" : "masculino (+5)";
  const pesoTxt = ref.metodo === "tendencia_7d"
    ? `<b>${fmt1(ref.peso)} kg</b> · média de ${ref.dias} dia(s) com pesagem nos últimos 7, recalculada automaticamente`
    : `<b>${fmt1(ref.peso)} kg</b> · informado em Meus dados. O recálculo automático começa com pesagens em ${TENDENCIA_MIN_DIAS} dos últimos 7 dias (agora: ${ref.dias}).`;
  $("tmbVal").textContent = fmt(tmb(p)) + " kcal/dia";
  $("tmbDet").innerHTML = [
    `Gasto sem exercícios: <b>${fmt(tdee(p))} kcal</b> (TMB × ${fmt1(Number(p.fator))}, rotina sem treinos)`,
    `Peso de referência: ${pesoTxt}`,
    `Idade ${fmt(p.idade)} · altura ${fmt(p.altura)} cm · coeficiente ${coef}`,
    `Método: ${TMB_METODO.nome}, versão ${TMB_METODO.versao} do cálculo`
  ].map(t => `<li>${t}</li>`).join("");
  const el = elegibilidade();
  $("tmbAviso").classList.toggle("hide", el.ok);
  $("tmbAviso").textContent = el.ok ? "" :
    `Fora do escopo das estimativas automáticas (adultos de 18 a 64 anos, sem condições especiais): ${el.motivos.join(", ")}. Use estes números só com acompanhamento individualizado.`;
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

// pontos = pesagem do dia; linha = média de 7 dias. Um só matiz: a forma diferencia as séries.
function renderPesoChart() {
  const s = serieTendencia(TODAY, 30);
  const vals = s.flatMap(x => [x.peso, x.media]).filter(isNum);
  if (!vals.length) {
    $("pesoChart").innerHTML = '<div class="empty">Registre seu peso para ver a evolução.</div>';
    return;
  }
  let lo = Math.min(...vals), hi = Math.max(...vals);
  if (hi - lo < 2) { const c = (hi + lo) / 2; lo = c - 1; hi = c + 1; }
  lo -= (hi - lo) * 0.1; hi += (hi - lo) * 0.1;

  const W = 330, H = 160, L = 34, R = 10, T = 10, B = 24;
  const x = i => L + i * (W - L - R) / (s.length - 1);
  const y = v => T + (hi - v) / (hi - lo) * (H - T - B);
  const css = getComputedStyle(document.documentElement);
  const c = n => css.getPropertyValue(n).trim();
  const font = 'font-family="Manrope, system-ui, sans-serif"';

  let g = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Peso dos últimos 30 dias: pesagens e média de 7 dias">`;
  [lo + (hi - lo) * 0.1, (lo + hi) / 2, hi - (hi - lo) * 0.1].forEach(v => {
    g += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="${c("--line")}" stroke-width="1"/>`;
    g += `<text x="${L - 6}" y="${y(v) + 3.5}" text-anchor="end" font-size="10" fill="${c("--muted")}" ${font}>${fmt1(v)}</text>`;
  });
  [0, Math.floor((s.length - 1) / 2), s.length - 1].forEach((i, j) => {
    g += `<text x="${x(i)}" y="${H - 6}" text-anchor="${["start", "middle", "end"][j]}" font-size="10" fill="${c("--muted")}" ${font}>${dm(s[i].data)}</text>`;
  });
  // linha da média, com quebra onde não há dados suficientes
  let d = "", aberto = false;
  s.forEach((p, i) => {
    if (p.media == null) { aberto = false; return; }
    d += (aberto ? "L" : "M") + x(i).toFixed(1) + " " + y(p.media).toFixed(1);
    aberto = true;
  });
  if (d) g += `<path d="${d}" fill="none" stroke="${c("--accent")}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
  s.forEach((p, i) => {
    if (p.peso == null) return;
    const tip = `${dm(p.data)}: ${fmt1(p.peso)} kg` + (p.media != null ? ` · média 7 dias ${fmt1(p.media)} kg` : "");
    g += `<g><title>${tip}</title><circle cx="${x(i)}" cy="${y(p.peso)}" r="10" fill="transparent"/>`
      + `<circle cx="${x(i)}" cy="${y(p.peso)}" r="4" fill="${c("--card")}" stroke="${c("--accent")}" stroke-width="2"/></g>`;
  });
  $("pesoChart").innerHTML = g + "</svg>";
}

function medidaTexto(m) {
  return MEDIDAS_CAMPOS.filter(c => m[c.k] != null)
    .map(c => (c.k === "peso_kg" ? "" : c.n.toLowerCase() + " ") + fmt1(m[c.k]) + " " + c.u).join(" · ");
}

function renderMedidaList() {
  const box = $("medidaList");
  if (!medidas.length) { box.innerHTML = '<div class="empty">Nenhuma medida registrada ainda.</div>'; return; }
  box.innerHTML = medidas.slice().reverse().map(m =>
    `<div class="item"><div class="n"><div>${escapeHtml(medidaTexto(m))}</div><small>${fromKey(m.data).toLocaleDateString("pt-BR")}</small></div>`
    + `<button type="button" class="x" data-del="${escapeHtml(m.id)}" aria-label="Remover">×</button></div>`).join("");
}

function renderHistorico() {
  renderTmbCard();
  renderPesoStats();
  renderPesoChart();
  renderMedidaList();
}

function initBodyForm() {
  $("mData").value = TODAY;
  $("mData").max = TODAY;
  $("addMedida").onclick = () => {
    const input = { data: $("mData").value || TODAY };
    MEDIDAS_CAMPOS.forEach(c => { input[c.k] = numIn(c.id); });
    const r = addMedida(input);
    $("medidaErro").textContent = r.ok ? "" : r.erro;
    if (!r.ok) return;
    MEDIDAS_CAMPOS.forEach(c => { $(c.id).value = ""; });
    if (days[TODAY]) saveDay(TODAY);   // o dia de hoje guarda a TMB recalculada
    toast("Medidas registradas");
    renderProfileInfo();
    renderAll();
  };
  $("medidaList").onclick = e => {
    const b = e.target && e.target.closest ? e.target.closest("[data-del]") : null;
    if (!b) return;
    removeMedida(b.dataset.del);
    if (days[TODAY]) saveDay(TODAY);
    renderProfileInfo();
    renderAll();
  };
}
