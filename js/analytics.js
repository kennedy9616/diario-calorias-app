/* ==========================================================
   Analytics do diário (regras de produto)
   - Dia sem registro não é ingestão zero (consumo = null).
   - Déficit estimado só em dia marcado como completo; é estimativa.
   - Proteína % = registrada / meta vigente no dia × 100.
   - Atividade: min equivalentes = moderados + 2 × vigorosos (OMS);
     dias de força contados à parte.
   - Regularidade = dias completos / dias do período × 100.
   - Sem celebração de déficit, restrição ou excesso.
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
    deficit: completo ? t.gasto - t.cons : null,
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

/* ---------- Tela ---------- */
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
    : !r.completo ? "Só com o dia marcado como completo (em Calorias)"
    : r.deficit < 0 ? "Consumo acima do gasto estimado. Estimativa, não medição"
    : "Gasto estimado − consumo. Estimativa, não medição";

  $("anProt").textContent = r.prot == null ? "—" : (r.protParcial ? "≥ " : "") + fmt1(r.prot) + " g";
  const pct = r.protPct;
  $("anProtFill").style.width = (pct == null ? 0 : Math.min(100, pct)) + "%";
  $("anProtSub").textContent = r.protMeta == null ? "Sem meta de proteína (defina abaixo)"
    : pct == null ? `Meta ${fmt1(r.protMeta)} g`
    : `${fmt(pct)}% da meta de ${fmt1(r.protMeta)} g` + (pct >= 100 ? " · meta alcançada" : "");

  const t = r.totais;
  $("anNutri").innerHTML = r.consumo == null ? ""
    : NUTRI_DIA.map(([k, n, u]) => `<tr><td>${n}</td><td class="num">${fmtTotal(t, k, u)}</td></tr>`).join("");
}

// barras de consumo por dia (cheia = dia completo, contorno = parcial) e a meta vigente de cada dia
function renderAnChart(s) {
  const W = 330, H = 170, L = 6, R = 6, T = 14, B = 26;
  const n = s.dias.length, slot = (W - L - R) / n, bw = 26;
  const top = Math.max(1000, ...s.dias.flatMap(x => [x.consumo || 0, x.meta || 0])) * 1.12;
  const y = v => T + (1 - v / top) * (H - T - B);
  const css = getComputedStyle(document.documentElement);
  const c = v => css.getPropertyValue(v).trim();
  const font = 'font-family="Manrope, system-ui, sans-serif"';
  let g = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Calorias registradas por dia na semana, com a meta de cada dia">`;
  g += `<line x1="${L}" x2="${W - R}" y1="${y(0)}" y2="${y(0)}" stroke="${c("--line")}" stroke-width="1"/>`;
  s.dias.forEach((d, i) => {
    const cx = L + slot * i + slot / 2, x = cx - bw / 2;
    const tip = `${dataBr(d.k)}: ` + (d.consumo == null ? "sem registro" : `${fmt(d.consumo)} kcal${d.completo ? "" : " (parcial)"}`)
      + (d.meta ? ` · meta ${fmt(d.meta)} kcal` : "");
    g += `<g><title>${tip}</title><rect x="${L + slot * i}" y="${T}" width="${slot}" height="${H - T - B}" fill="transparent"/>`;
    if (d.consumo != null && d.consumo > 0) {
      const h = Math.max(3, y(0) - y(d.consumo));
      g += d.completo
        ? `<rect x="${x}" y="${y(0) - h}" width="${bw}" height="${h}" rx="4" fill="${c("--accent")}"/>`
        : `<rect x="${x + 1}" y="${y(0) - h + 1}" width="${bw - 2}" height="${h - 1}" rx="4" fill="none" stroke="${c("--accent")}" stroke-width="2" stroke-dasharray="4 3"/>`;
    } else if (d.consumo == null) {
      g += `<rect x="${x}" y="${y(0) - 1.5}" width="${bw}" height="3" rx="1.5" fill="${c("--line")}"/>`;
    }
    if (d.meta) g += `<line x1="${x - 4}" x2="${x + bw + 4}" y1="${y(d.meta)}" y2="${y(d.meta)}" stroke="${c("--ink")}" stroke-width="2" stroke-linecap="round"/>`;
    g += `</g><text x="${cx}" y="${H - 8}" text-anchor="middle" font-size="10.5" font-weight="${d.k === cur ? 800 : 600}" fill="${d.k === cur ? c("--ink") : c("--muted")}" ${font}>${diaCurto(d.k)}</text>`;
  });
  $("anChart").innerHTML = g + "</svg>";
}

function renderAnSemana() {
  const s = resumoSemana(cur);
  $("anSemLbl").textContent = `${dataBr(s.dias[0].k)} a ${dataBr(s.dias[6].k)}`;
  renderAnChart(s);
  $("anReg").textContent = `${s.diasCompletos} de 7`;
  $("anRegSub").textContent = `${fmt(s.regularidade)}% de dias completos · ${s.diasComRegistro} com algum registro`;
  $("anMedia").textContent = s.consumoMedio == null ? "—" : fmt(s.consumoMedio) + " kcal";
  $("anMediaSub").textContent = s.diasCompletos ? `média de ${s.diasCompletos} dia(s) completo(s)` : "precisa de dias completos";
  $("anAtiv").textContent = fmt(s.minEq) + " min";
  $("anAtivSub").textContent = "equivalentes (moderado + 2 × vigoroso). OMS: 150–300/semana";
  $("anForca").textContent = `${s.diasForca} dia(s)`;
  $("anForcaSub").textContent = "de fortalecimento. OMS: 2 ou mais por semana";
  $("anTabela").innerHTML = "<tr><th>Dia</th><th>kcal</th><th>Meta</th><th>Proteína</th><th>Diário</th></tr>"
    + s.dias.map(d => `<tr><td>${dataBr(d.k)}</td><td class="num">${d.consumo == null ? "—" : fmt(d.consumo)}</td>`
      + `<td class="num">${d.meta ? fmt(d.meta) : "—"}</td><td class="num">${d.prot == null ? "—" : fmt1(d.prot) + " g"}</td>`
      + `<td>${d.consumo == null ? "sem registro" : d.completo ? "completo" : "parcial"}</td></tr>`).join("");
}

function renderAnalytics() {
  renderAnDia();
  renderAnSemana();
  renderMetasForm();
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
