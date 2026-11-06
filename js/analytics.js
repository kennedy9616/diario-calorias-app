/* ==========================================================
   Analytics: agregações por período (regras de produto)
   - Período: datas inicial e final INCLUÍDAS, pela data local.
     Hoje = 1 dia; 7/30/90 dias terminam hoje; personalizado até 366 dias.
   - Comparação: período anterior de mesma duração, imediatamente antes.
   - Dia sem registro não é consumo zero: médias usam só os dias com registro,
     e a cobertura aparece junto ("5 de 7 dias com registro").
   - Variação percentual só quando o período anterior tem base (> 0);
     senão, "sem base de comparação". Nunca divide por zero.
   - Cada dia é comparado com a meta vigente naquele dia (metas versionadas).
   - Déficit estimado só em dia marcado como completo; é estimativa.
   - Peso: só medições reais (média do dia); variação = última − primeira
     medição do período. Não interpreta perda de peso como melhora.
   - Atividade: min equivalentes = moderados + 2 × vigorosos (OMS);
     dias de força contados à parte.
   ========================================================== */

const intensidadeMet = met => (met >= 6 ? "vigorosa" : met >= 3 ? "moderada" : "leve");

function minEquivalentes(list) {
  return (list || []).reduce((s, e) => {
    const i = intensidadeMet(Number(e.met));
    const min = Number(e.min) || 0;
    return s + (i === "vigorosa" ? 2 * min : i === "moderada" ? min : 0);
  }, 0);
}

function ehForca(e) {
  const tipo = e.tipo || (EXS.find(x => x.n === e.name) || {}).id;
  return !!(EXS.find(x => x.id === tipo) || {}).forca;
}

function resumoDia(k) {
  const d = days[k];
  const temFood = !!d && d.foods.length > 0;
  const t = totals(k);
  const kcal = metaVigente("kcal", k), pm = metaVigente("proteina", k);
  const consumo = temFood ? t.cons : null;
  const completo = temFood && d.completo === true;
  const prot = temFood && (t.falta.prot || 0) < t.n ? t.prot : null;
  return {
    k, tem: !!d && (temFood || d.ex.length > 0), completo, consumo, n: t.n,
    meta: kcal ? kcal.valor : null,
    diferenca: consumo != null && kcal ? consumo - kcal.valor : null,
    gasto: t.gasto,
    deficit: completo && t.gasto != null ? t.gasto - t.cons : null,
    prot, protParcial: temFood && !!t.falta.prot,
    protMeta: pm ? pm.valor : null,
    protPct: pm && prot != null ? prot / pm.valor * 100 : null,
    minEq: d ? minEquivalentes(d.ex) : 0,
    forca: d ? d.ex.some(ehForca) : false,
    totais: t
  };
}

const media = xs => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);

function resumoSemana(ate = cur) {
  const dias = [];
  for (let i = 6; i >= 0; i--) dias.push(resumoDia(addDays(ate, -i)));
  const completos = dias.filter(x => x.completo);
  return {
    dias,
    diasComRegistro: dias.filter(x => x.tem).length,
    diasCompletos: completos.length,
    regularidade: completos.length / dias.length * 100,
    consumoMedio: media(completos.map(x => x.consumo)),
    minEq: dias.reduce((s, x) => s + x.minEq, 0),
    diasForca: dias.filter(x => x.forca).length,
    protPctMedia: media(dias.filter(x => x.protPct != null).map(x => x.protPct))
  };
}

/* ---------- Períodos ---------- */
const PERIODO_DIAS = { hoje: 1, "7d": 7, "30d": 30, "90d": 90 };
const PERIODO_MAX = 366;
const isDia = k => /^\d{4}-\d{2}-\d{2}$/.test(String(k || "")) && keyOf(fromKey(k)) === k;

function validarPeriodo(ini, fim) {
  if (!isDia(ini) || !isDia(fim)) return { ok: false, erro: "Escolha a data inicial e a final." };
  if (ini > fim) return { ok: false, erro: "A data inicial precisa ser igual ou anterior à final." };
  if (fim > TODAY) return { ok: false, erro: "A data final não pode ser depois de hoje." };
  const n = diasEntre(ini, fim) + 1;
  if (n > PERIODO_MAX) return { ok: false, erro: `Escolha no máximo ${PERIODO_MAX} dias.` };
  return { ok: true, ini, fim, n };
}

// { ini, fim, n, tipo } com as duas datas incluídas
function periodoDe(tipo = prefs.periodo, ini = prefs.periodo_ini, fim = prefs.periodo_fim) {
  if (tipo === "custom") {
    const v = validarPeriodo(ini, fim);
    if (v.ok) return { tipo, ini: v.ini, fim: v.fim, n: v.n };
    tipo = "7d";
  }
  const n = PERIODO_DIAS[tipo] || 7;
  return { tipo: PERIODO_DIAS[tipo] ? tipo : "7d", ini: addDays(TODAY, -(n - 1)), fim: TODAY, n };
}

function periodoAnterior(p) {
  return { tipo: "anterior", ini: addDays(p.ini, -p.n), fim: addDays(p.ini, -1), n: p.n };
}

function diasDo(p) {
  const out = [];
  for (let k = p.ini; k <= p.fim; k = addDays(k, 1)) out.push(k);
  return out;
}

/* ---------- Agregação ---------- */
function agregarPeriodo(p) {
  const ks = diasDo(p);
  const pesagens = pesosDiarios().filter(d => d.data >= p.ini && d.data <= p.fim);
  const comPesagem = new Set(pesagens.map(d => d.data));
  const agua = { serie: [], diasRegistro: 0, diasComMeta: 0, diasMetaAtingida: 0, soma: 0 };
  const kcal = { serie: [], diasRegistro: 0, diasCompletos: 0, soma: 0, difs: [], diasAcima: 0, diasCompletosComMeta: 0, deficits: [] };
  const macros = { carb: 0, prot: 0, gord: 0, parcial: false, dias: 0 };
  const ativ = { minEq: 0, diasForca: 0, diasExercicio: 0 };
  let diasComRegistro = 0;

  ks.forEach(k => {
    const d = days[k];
    const c = comparaAgua(k);
    agua.serie.push({ k, v: c.consumo, meta: c.meta, alerta: c.status === "acima_limite" });
    if (c.consumo != null) {
      agua.diasRegistro++;
      agua.soma += c.consumo;
      if (c.meta != null && c.sentido === "meta") {
        agua.diasComMeta++;
        if (c.status === "alcancada") agua.diasMetaAtingida++;
      }
    }
    const r = resumoDia(k);
    kcal.serie.push({ k, v: r.consumo, meta: r.meta, fraco: r.consumo != null && !r.completo });
    if (r.consumo != null) {
      kcal.diasRegistro++;
      kcal.soma += r.consumo;
      if (r.completo) kcal.diasCompletos++;
      if (r.diferenca != null) {
        kcal.difs.push(r.diferenca);
        if (r.diferenca > 0) kcal.diasAcima++;
        if (r.completo) kcal.diasCompletosComMeta++;
      }
      if (r.deficit != null) kcal.deficits.push(r.deficit);
      const t = r.totais;
      ["carb", "prot", "gord"].forEach(m => { macros[m] += t[m]; if (t.falta[m]) macros.parcial = true; });
      macros.dias++;
    }
    if (d && d.ex.length) {
      ativ.diasExercicio++;
      ativ.minEq += r.minEq;
      if (r.forca) ativ.diasForca++;
    }
    const temAlgo = !!d && (d.foods.length > 0 || d.ex.length > 0 || (d.agua && d.agua.length > 0));
    if (temAlgo || comPesagem.has(k)) diasComRegistro++;
  });

  const prim = pesagens[0], ult = pesagens[pesagens.length - 1];
  return {
    p, n: ks.length, diasComRegistro,
    agua: Object.assign(agua, { media: agua.diasRegistro ? agua.soma / agua.diasRegistro : null }),
    kcal: Object.assign(kcal, {
      media: kcal.diasRegistro ? kcal.soma / kcal.diasRegistro : null,
      mediaDiferenca: media(kcal.difs),
      saldoMedioCompletos: kcal.deficits.length ? media(kcal.deficits) : null
    }),
    peso: {
      pontos: pesagens,
      primeiro: prim || null, ultimo: ult || null,
      variacao: pesagens.length >= 2 ? ult.peso - prim.peso : null
    },
    macros: macros.dias ? macros : null,
    ativ
  };
}

// comparação de um número com o período anterior; sem base, não inventa percentual
function comparar(atual, anterior) {
  if (atual == null) return { delta: null, pct: null, motivo: "sem dados neste período" };
  if (anterior == null) return { delta: null, pct: null, motivo: "sem dados no período anterior" };
  const delta = atual - anterior;
  return { delta, pct: anterior > 0 ? delta / anterior * 100 : null, motivo: anterior > 0 ? null : "sem base para percentual" };
}

/* ---------- Tela: detalhes do dia (aba Calorias) ---------- */
const sinal = v => (v > 0 ? "+" : v < 0 ? "−" : "") + fmt(Math.abs(v));
const diaCurto = k => fromKey(k).toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "").slice(0, 3);

const NUTRI_DIA = [
  ["carb", "Carboidratos", "g"], ["gord", "Gorduras totais", "g"], ["gsat", "Gorduras saturadas", "g"],
  ["fibra", "Fibras", "g"], ["acucar", "Açúcares", "g"], ["colest", "Colesterol", "mg"],
  ["sodio", "Sódio", "mg"], ["potassio", "Potássio", "mg"], ["calcio", "Cálcio", "mg"], ["ferro", "Ferro", "mg"]
];

function renderAnDia() {
  const r = resumoDia(cur);
  $("anCons").textContent = r.consumo == null ? "—" : fmt(r.consumo) + " kcal";
  $("anConsSub").textContent = r.consumo == null ? "Sem registro de alimentos (não é zero)"
    : r.completo ? "Diário marcado como completo" : "Diário parcial: pode faltar registro";

  $("anDif").textContent = r.diferenca == null ? "—" : sinal(r.diferenca) + " kcal";
  $("anDifSub").textContent = r.meta == null ? "Sem meta de calorias neste dia"
    : r.diferenca == null ? `Meta ${fmt(r.meta)} kcal` : `${r.diferenca > 0 ? "acima" : r.diferenca < 0 ? "abaixo" : "igual"} da meta de ${fmt(r.meta)} kcal`;

  // positivo = déficit (gasto acima do consumo); negativo = consumo acima do gasto
  $("anDef").textContent = r.deficit == null ? "—" : (r.deficit < 0 ? "−" : "") + fmt(Math.abs(r.deficit)) + " kcal";
  $("anDefSub").textContent = r.consumo == null ? "Precisa do diário do dia"
    : r.gasto == null ? "Complete o Perfil para estimar o gasto"
    : !r.completo ? "Só com o dia marcado como completo"
    : r.deficit < 0 ? "Consumo acima do gasto estimado. Estimativa, não medição"
    : "Gasto estimado − consumo. Estimativa, não medição";

  $("anProt").textContent = r.prot == null ? "—" : (r.protParcial ? "≥ " : "") + fmt1(r.prot) + " g";
  const pct = r.protPct;
  $("anProtFill").style.width = (pct == null ? 0 : Math.min(100, pct)) + "%";
  $("anProtSub").textContent = r.protMeta == null ? "Sem meta de proteína (defina no Perfil)"
    : pct == null ? `Meta ${fmt1(r.protMeta)} g`
    : `${fmt(pct)}% da meta de ${fmt1(r.protMeta)} g` + (pct >= 100 ? " · meta alcançada" : "");

  const t = r.totais;
  $("anNutri").innerHTML = r.consumo == null ? ""
    : NUTRI_DIA.map(([k, n, u]) => `<tr><td>${n}</td><td class="num">${fmtTotal(t, k, u)}</td></tr>`).join("");
}

/* ---------- Tela: Analytics ---------- */
const PERIODO_ROTULO = { hoje: "Hoje", "7d": "Últimos 7 dias", "30d": "Últimos 30 dias", "90d": "Últimos 90 dias", custom: "Personalizado" };
const intervaloTxt = p => (p.ini === p.fim ? dataBr(p.ini) : `${dataBr(p.ini)} a ${dataBr(p.fim)}`);
const fmtKcal = v => fmt(v) + " kcal";

function deltaTxt(c, fmtD, nomeAnt) {
  if (c.delta == null) return c.motivo + ".";
  const d = (c.delta > 0 ? "+" : c.delta < 0 ? "−" : "±") + fmtD(Math.abs(c.delta));
  return `${d} vs. ${nomeAnt}` + (c.pct != null ? ` (${c.pct > 0 ? "+" : c.pct < 0 ? "−" : ""}${fmt(Math.abs(c.pct))}%)` : c.motivo ? ` (${c.motivo})` : "");
}

function kpi(label, valor, sub, delta) {
  return `<div class="stat kpi"><div class="k">${escapeHtml(label)}</div><div class="v">${escapeHtml(valor)}</div>`
    + `<div class="sub">${escapeHtml(sub)}</div>` + (delta ? `<div class="sub delta">${escapeHtml(delta)}</div>` : "") + "</div>";
}

function renderKpis(a, b) {
  const nomeAnt = "período anterior";
  const ag = comparar(a.agua.media, b.agua.media);
  const kc = comparar(a.kcal.media, b.kcal.media);
  const dr = comparar(a.diasComRegistro, b.diasComRegistro);
  const pesoTxt = a.peso.variacao == null ? "—" : (a.peso.variacao > 0 ? "+" : a.peso.variacao < 0 ? "−" : "±") + fmt1(Math.abs(a.peso.variacao)) + " kg";
  const pesoSub = a.peso.pontos.length === 0 ? "Nenhuma pesagem no período"
    : a.peso.pontos.length === 1 ? `1 pesagem (${fmt1(a.peso.ultimo.peso)} kg em ${dataBr(a.peso.ultimo.data)}): precisa de 2 para variar`
    : `${a.peso.pontos.length} dias com pesagem: ${fmt1(a.peso.primeiro.peso)} → ${fmt1(a.peso.ultimo.peso)} kg`;
  const difTxt = a.kcal.mediaDiferenca == null ? "—" : sinal(a.kcal.mediaDiferenca) + " kcal/dia";
  const difSub = a.kcal.difs.length
    ? `média de ${a.kcal.difs.length} dia(s) com registro e meta · ${a.kcal.diasAcima} acima da meta · ${a.kcal.difs.length - a.kcal.diasCompletosComMeta} parcial(is)`
    : "Precisa de dias com alimentação registrada e meta de calorias";
  $("anKpis").innerHTML = [
    kpi("Água por dia (média)", a.agua.media == null ? "—" : fmtMl(a.agua.media), `${a.agua.diasRegistro} de ${a.n} dias com registro`, deltaTxt(ag, fmtMl, nomeAnt)),
    kpi("Meta de água atingida", a.agua.diasComMeta ? `${a.agua.diasMetaAtingida} de ${a.agua.diasComMeta} dia(s)` : "—",
      a.agua.diasComMeta ? "dias com registro e meta de hábito" : "Precisa de dias com registro e meta de água",
      b.agua.diasComMeta ? `Anterior: ${b.agua.diasMetaAtingida} de ${b.agua.diasComMeta} dias` : "Sem dias com meta no período anterior."),
    kpi("Calorias por dia (média)", a.kcal.media == null ? "—" : fmtKcal(a.kcal.media),
      `${a.kcal.diasRegistro} de ${a.n} dias com alimentação · ${a.kcal.diasCompletos} completo(s)`, deltaTxt(kc, fmtKcal, nomeAnt)),
    kpi("Calorias × meta", difTxt, difSub, null),
    kpi("Variação de peso", pesoTxt, pesoSub, null),
    kpi("Dias com registros", `${a.diasComRegistro} de ${a.n}`, "alimentação, exercício, água ou peso", deltaTxt(dr, v => fmt(v) + " dia(s)", nomeAnt))
  ].join("");
}

function tabelaDias(serie, fmtV, nomeV) {
  return `<tr><th>Dia</th><th class="num">${nomeV}</th><th class="num">Meta</th></tr>`
    + serie.slice().reverse().map(d => `<tr><td>${dataBr(d.k)}</td><td class="num">${d.v == null ? "sem registro" : fmtV(d.v) + (d.fraco ? " (parcial)" : "")}</td>`
      + `<td class="num">${d.meta ? fmtV(d.meta) : "—"}</td></tr>`).join("");
}

const OBJETIVO_TXT = { perder: "perder peso", manter: "manter o peso", ganhar: "ganhar peso" };

// evolução descrita só com fatos: cobertura, metas cumpridas e o sentido da variação de peso
function evolucaoItens(a) {
  const it = [];
  it.push(`Registros: ${a.diasComRegistro} de ${a.n} dia(s) com algum registro no período.`);
  if (a.kcal.diasRegistro) it.push(`Alimentação registrada em ${a.kcal.diasRegistro} dia(s); ${a.kcal.diasCompletos} marcado(s) como completo(s).`);
  else it.push("Nenhum dia com alimentação registrada.");
  if (a.agua.diasComMeta) it.push(`Água: meta atingida em ${a.agua.diasMetaAtingida} de ${a.agua.diasComMeta} dia(s) com registro e meta.`);
  else if (a.agua.diasRegistro) it.push(`Água registrada em ${a.agua.diasRegistro} dia(s), sem meta de hábito para comparar.`);
  if (a.kcal.saldoMedioCompletos != null) {
    const s = a.kcal.saldoMedioCompletos;
    it.push(`Saldo estimado nos ${a.kcal.deficits.length} dia(s) completo(s): ${s >= 0 ? "déficit" : "superávit"} médio de ${fmt(Math.abs(s))} kcal/dia (estimativa: gasto calculado − consumo).`);
  }
  if (a.peso.variacao != null) {
    const v = a.peso.variacao, obj = profile.objetivo || "manter";
    const sentido = Math.abs(v) < 0.05 ? "sem variação"
      : obj === "manter" ? "objetivo declarado: manter o peso"
      : (obj === "perder") === (v < 0) ? `no sentido do objetivo declarado (${OBJETIVO_TXT[obj]})` : `no sentido contrário ao objetivo declarado (${OBJETIVO_TXT[obj]})`;
    it.push(`Peso: ${fmt1(a.peso.primeiro.peso)} kg (${dataBr(a.peso.primeiro.data)}) → ${fmt1(a.peso.ultimo.peso)} kg (${dataBr(a.peso.ultimo.data)}), ${v > 0 ? "+" : v < 0 ? "−" : "±"}${fmt1(Math.abs(v))} kg; ${sentido}. Variações de poucos dias refletem também água e conteúdo intestinal.`);
  } else if (a.peso.pontos.length === 1) it.push("Peso: só uma pesagem no período; a variação precisa de duas.");
  if (a.ativ.diasExercicio) it.push(`Atividade: ${fmt(a.ativ.minEq)} min equivalentes (moderado + 2 × vigoroso) em ${a.ativ.diasExercicio} dia(s); ${a.ativ.diasForca} dia(s) de fortalecimento.`);
  return it;
}

function renderPeriodoControles(p) {
  document.querySelectorAll("#anPeriodo [data-p]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.p === p.tipo)));
  $("anCustom").classList.toggle("hide", p.tipo !== "custom" && prefs.periodo !== "custom");
  $("anIni").max = TODAY; $("anFim").max = TODAY;
  if (document.activeElement !== $("anIni")) $("anIni").value = p.ini;
  if (document.activeElement !== $("anFim")) $("anFim").value = p.fim;
  const ant = periodoAnterior(p);
  $("anPerTxt").textContent = `${PERIODO_ROTULO[p.tipo]}: ${intervaloTxt(p)} (${p.n} dia${p.n > 1 ? "s" : ""}, datas inicial e final incluídas). Comparação com ${intervaloTxt(ant)}.`;
}

function renderAnalytics() {
  const p = periodoDe();
  renderPeriodoControles(p);
  const a = agregarPeriodo(p), b = agregarPeriodo(periodoAnterior(p));
  const vazio = a.diasComRegistro === 0;
  $("anVazio").classList.toggle("hide", !vazio);
  $("anConteudo").classList.toggle("hide", vazio);
  if (vazio) return;
  renderKpis(a, b);
  graficoBarrasDia($("anAguaChart"), a.agua.serie, {
    rotulo: `Água por dia, ${intervaloTxt(p)}, com a meta de cada dia`, cor: "--water", fmtV: fmtMl, nomeMeta: "Meta",
    fmtEixo: v => (v >= 1000 ? fmt1(v / 1000) + " L" : fmt(v)), vazio: "Nenhuma bebida registrada no período."
  });
  $("anAguaTab").innerHTML = tabelaDias(a.agua.serie, fmtMl, "Água");
  graficoBarrasDia($("anKcalChart"), a.kcal.serie, {
    rotulo: `Calorias consumidas por dia, ${intervaloTxt(p)}, com a meta de cada dia`, cor: "--accent", fmtV: fmtKcal, nomeMeta: "Meta",
    nomeFraco: "diário parcial", vazio: "Nenhuma alimentação registrada no período."
  });
  $("anKcalTab").innerHTML = tabelaDias(a.kcal.serie, fmtKcal, "Consumo");
  graficoPeso($("anPesoChart"), a.peso.pontos, { ini: p.ini, fim: p.fim, vazio: "Nenhuma pesagem no período. Registre seu peso no Perfil." });
  const dist = a.macros && distribuicaoMacros(a.macros);
  barraMacros($("anMacros"), dist, `Energia dos macronutrientes, ${intervaloTxt(p)}`);
  $("anMacrosNota").textContent = !a.macros ? ""
    : `Soma de ${a.macros.dias} dia(s) com alimentação. Energia estimada pelos fatores de Atwater (4 kcal/g de carboidrato e proteína, 9 kcal/g de gordura); fibras e álcool não entram.`
      + (a.macros.parcial ? " Alguns alimentos não têm todos os macronutrientes na fonte: a distribuição é parcial." : "");
  $("anEvolucao").innerHTML = evolucaoItens(a).map(t => `<li>${escapeHtml(t)}</li>`).join("");
}

function escolherPeriodo(tipo) {
  if (tipo === "custom") {
    prefs.periodo = "custom";
    if (!validarPeriodo(prefs.periodo_ini, prefs.periodo_fim).ok) { const p = periodoDe("7d"); prefs.periodo_ini = p.ini; prefs.periodo_fim = p.fim; }
  } else prefs.periodo = PERIODO_DIAS[tipo] ? tipo : "7d";
  persist();
  renderAnalytics();
  if (tipo === "custom") $("anIni").focus();
}

function aplicarPeriodo() {
  limparErroCampo("anPerErro");
  const v = validarPeriodo($("anIni").value, $("anFim").value);
  if (!v.ok) { mostrarErroCampo("anPerErro", v.erro, "anIni"); return; }
  Object.assign(prefs, { periodo: "custom", periodo_ini: v.ini, periodo_fim: v.fim });
  persist();
  renderAnalytics();
}

function initAnalytics() {
  $("anPeriodo").addEventListener("click", e => {
    const b = e.target && e.target.closest ? e.target.closest("[data-p]") : null;
    if (b) escolherPeriodo(b.dataset.p);
  });
  $("anAplicar").addEventListener("click", aplicarPeriodo);
  ["anIni", "anFim"].forEach(id => $(id).addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); aplicarPeriodo(); } }));
}

/* ---------- Dia completo (aba Calorias) ---------- */
function setDiaCompleto(on) {
  if (!days[cur]) days[cur] = { foods: [], ex: [] };
  days[cur].completo = !!on;
  saveDay(cur);
}

function initDiaCompleto() {
  $("diaCompleto").addEventListener("change", () => { setDiaCompleto($("diaCompleto").checked); renderAll(); });
}
