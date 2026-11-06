// Metas versionadas (calorias e proteína) e analytics do diário (regras_metas_analytics).
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { html, loadApp } = require("./helpers.cjs");

// 70 kg, 170 cm, 30 anos, coeficiente masculino, sedentário: TMB 1617,5; manutenção 1941
function app() {
  const a = loadApp();
  a.run(`profile = Object.assign(clone(DEFAULT_PROFILE), { peso: 70, altura: 170, idade: 30, sexo: "M", fator: 1.2 });
    medidas = []; metas = []; days = {}; persist = () => {}; cur = TODAY;`);
  a.d = n => a.run(`addDays(TODAY, ${-n})`);
  a.dia = (n, obj) => a.run(`days[addDays(TODAY, ${-n})] = Object.assign({ foods: [], ex: [] }, ${JSON.stringify(obj)})`);
  return a;
}

/* ---------- Calorias ---------- */
test("meta de consumo = manutenção × (1 − déficit%): 2400 × 0,85 = 2040; déficit 360", () => {
  const { run } = app();
  assert.equal(run("metaConsumo(2400, 0.15)"), 2040);
  assert.equal(run("deficitPlanejado(2400, 2040)"), 360);
});

test("estimativa de calorias guarda método, fonte, versão, vigência e dados usados", () => {
  const { run } = app();
  run('profile.objetivo = "perder"');
  const r = run("estimarMetaKcal(0.15)");
  assert.equal(r.ok, true);
  assert.equal(r.meta.valor, 1650);   // 1941 × 0,85
  assert.equal(r.meta.unidade, "kcal/dia");
  assert.equal(r.meta.origem, "estimada");
  assert.match(r.meta.metodo, /Mifflin/);
  assert.match(r.meta.fonte_url, /^https:\/\//);
  assert.ok(r.meta.versao);
  assert.equal(r.meta.dados_utilizados.percentual_deficit, 0.15);
  assert.equal(r.meta.dados_utilizados.manutencao_estimada, 1941);
  assert.equal(r.meta.dados_utilizados.peso_referencia, 70);
  const m = run("definirMeta(estimarMetaKcal(0.15).meta)");
  assert.equal(m.vigencia_inicio, run("TODAY"));
  assert.equal(m.vigencia_fim, null);
  assert.ok(m.data_calculo);
});

test("sem déficit fora de 0/10/15%, sem déficit com objetivo manter, sem estimativa fora do escopo", () => {
  const { run } = app();
  run('profile.objetivo = "perder"');
  assert.equal(run("estimarMetaKcal(0.30).ok"), false);
  assert.equal(run("estimarMetaKcal(500).ok"), false);
  run('profile.objetivo = "manter"');
  assert.equal(run("estimarMetaKcal(0.10).ok"), false);
  assert.equal(run("estimarMetaKcal(0).meta.valor"), 1941);
  run("profile.idade = 17");
  assert.equal(run("estimarMetaKcal(0).ok"), false);
  run('profile.idade = 30; profile.condicoes = ["renal"]');
  assert.equal(run("estimarMetaKcal(0).ok"), false);
});

test("meta manual abaixo da TMB é recusada; de profissional aceita (faixa plausível)", () => {
  const { run } = app();
  assert.equal(run('metaKcalInformada(1200, "manual").ok'), false);
  assert.equal(run('metaKcalInformada(1800, "manual").ok'), true);
  assert.equal(run('metaKcalInformada(1200, "profissional").ok'), true);
  assert.equal(run('metaKcalInformada(1200, "profissional").meta.origem'), "profissional");
  assert.equal(run('metaKcalInformada(100, "profissional").ok'), false);
  assert.equal(run('metaKcalInformada(NaN, "profissional").ok'), false);
});

test("histórico de metas: cada dia usa a meta vigente naquele dia", () => {
  const a = app();
  a.run('definirMeta(metaKcalInformada(2000, "profissional").meta, addDays(TODAY, -10))');
  a.run('definirMeta(metaKcalInformada(1800, "profissional").meta)');
  assert.equal(a.run('metaVigente("kcal", addDays(TODAY, -5)).valor'), 2000);
  assert.equal(a.run('metaVigente("kcal", TODAY).valor'), 1800);
  assert.equal(a.run('metaVigente("kcal", addDays(TODAY, -11))'), null);
  assert.equal(a.run('metas.find(m => m.valor === 2000).vigencia_fim'), a.d(1));
  a.run('definirMeta(metaKcalInformada(1900, "profissional").meta)');   // trocar no mesmo dia substitui
  assert.equal(a.run('metas.filter(m => m.tipo === "kcal").length'), 2);
  a.run('encerrarMeta("kcal")');
  assert.equal(a.run('metaVigente("kcal", TODAY)'), null);
  assert.equal(a.run('metaVigente("kcal", addDays(TODAY, -5)).valor'), 2000);
});

test("meta antiga (profile.meta) vira meta manual versionada desde o primeiro registro", () => {
  const a = app();
  a.run('replaceWith({ profile: { meta: 1800 }, days: { "2026-01-02": { foods: [], ex: [] } } })');
  const m = a.run('metaVigente("kcal", "2026-01-02")');
  assert.equal(m.valor, 1800);
  assert.equal(m.origem, "manual");
  assert.equal(m.vigencia_inicio, "2026-01-02");
  assert.equal(a.run("profile.meta"), null);
  assert.equal(a.run("snapshot().metas.length"), 1);
});

test("metas entram no backup, voltam e se juntam sem duplicar; inválidas são descartadas", () => {
  const a = app();
  a.run('definirMeta(metaKcalInformada(2000, "profissional").meta)');
  a.run("localStorage.setItem(LSKEY, JSON.stringify(snapshot())); metas = [];");
  assert.equal(a.run("loadSaved()"), true);
  assert.equal(a.run("metas.length"), 1);
  a.run("mergeIn(JSON.parse(JSON.stringify(snapshot())))");
  assert.equal(a.run("metas.length"), 1);
  a.run('mergeIn({ metas: [{ id: "x", tipo: "kcal", valor: -5, vigencia_inicio: TODAY }] })');
  assert.equal(a.run("metas.length"), 1);
});

/* ---------- Proteína ---------- */
test("proteína: EFSA 0,83 g/kg = 58,1 g; ISSN 1,4–2,0 g/kg = 98–140 g (70 kg, treino regular)", () => {
  const { run } = app();
  const efsa = run('estimarMetaProteina("efsa")');
  assert.equal(efsa.meta.valor, 58.1);
  assert.equal(efsa.meta.dados_utilizados.peso_referencia, 70);
  assert.equal(efsa.meta.dados_utilizados.coeficiente_g_kg, 0.83);
  assert.equal(run('estimarMetaProteina("issn14").ok'), false);   // sem treino regular
  run('profile.treino = { tipo: "forca", dias: 3, min: 60, intensidade: "moderada" }');
  assert.equal(run('estimarMetaProteina("issn14").meta.valor'), 98);
  assert.equal(run('estimarMetaProteina("issn20").meta.valor'), 140);
  assert.match(run('estimarMetaProteina("issn20").meta.fonte_url'), /springer/);
});

test("proteína: com IMC ≥ 30 não aplica coeficiente elevado ao peso atual", () => {
  const { run } = app();
  run('profile.peso = 100; profile.treino = { tipo: "forca", dias: 4, min: 60, intensidade: "vigorosa" }');
  assert.equal(run('estimarMetaProteina("issn16").ok'), false);
  assert.equal(run('estimarMetaProteina("efsa").ok'), true);
  assert.equal(run('metaProteinaInformada(120).meta.origem'), "profissional");
});

/* ---------- Analytics ---------- */
test("atividade: min equivalentes = moderados + 2 × vigorosos; força contada à parte", () => {
  const { run } = app();
  assert.equal(run('minEquivalentes([{ met: 4.3, min: 30 }, { met: 9, min: 20 }, { met: 2, min: 60 }])'), 70);
  assert.equal(run('ehForca({ name: "Academia (musculação)", met: 5, min: 50 })'), true);
  assert.equal(run('ehForca({ tipo: "academia", met: 5, min: 50 })'), true);
  assert.equal(run('ehForca({ name: "Caminhada", met: 4.3, min: 50 })'), false);
});

test("dia sem registro não é zero; dia parcial não estima déficit; completo estima", () => {
  const a = app();
  let r = a.run("resumoDia(TODAY)");
  assert.equal(r.tem, false);
  assert.equal(r.consumo, null);
  assert.equal(r.deficit, null);
  a.dia(0, { foods: [{ id: "a", kcal: 1500, prot: 60 }] });
  r = a.run("resumoDia(TODAY)");
  assert.equal(r.consumo, 1500);
  assert.equal(r.completo, false);
  assert.equal(r.deficit, null);
  a.run("days[TODAY].completo = true");
  r = a.run("resumoDia(TODAY)");
  assert.equal(Math.round(r.deficit), 1941 - 1500);
});

test("diferença da meta e proteína % comparam com a meta vigente do dia", () => {
  const a = app();
  a.run('definirMeta(metaKcalInformada(2000, "profissional").meta, addDays(TODAY, -3))');
  a.run('definirMeta(estimarMetaProteina("efsa").meta, addDays(TODAY, -3))');
  a.dia(0, { foods: [{ id: "a", kcal: 1500, prot: 29.05 }] });
  const r = a.run("resumoDia(TODAY)");
  assert.equal(r.meta, 2000);
  assert.equal(r.diferenca, -500);
  assert.equal(r.protMeta, 58.1);
  assert.equal(Math.round(r.protPct), 50);
  a.dia(5, { foods: [{ id: "b", kcal: 1000, prot: 10 }] });
  assert.equal(a.run("resumoDia(addDays(TODAY, -5)).meta"), null);
  assert.equal(a.run("resumoDia(addDays(TODAY, -5)).protPct"), null);
});

test("semana: regularidade = dias completos / 7; média só dos completos; força em dias distintos", () => {
  const a = app();
  a.dia(0, { completo: true, foods: [{ id: "a", kcal: 1800 }], ex: [{ name: "Academia (musculação)", met: 5, min: 50 }, { tipo: "academia", met: 5, min: 20 }] });
  a.dia(1, { completo: true, foods: [{ id: "b", kcal: 2000 }], ex: [{ name: "Corrida / trote", met: 9, min: 30 }] });
  a.dia(2, { foods: [{ id: "c", kcal: 500 }], ex: [{ tipo: "academia", met: 5, min: 40 }] });
  const s = a.run("resumoSemana(TODAY)");
  assert.equal(s.diasComRegistro, 3);
  assert.equal(s.diasCompletos, 2);
  assert.equal(s.regularidade, 2 / 7 * 100);
  assert.equal(s.consumoMedio, 1900);
  assert.equal(s.minEq, 70 + 60 + 40);
  assert.equal(s.diasForca, 2);
  assert.equal(s.dias.length, 7);
});

test("totais incluem açúcares, gordura saturada, colesterol e minerais, com null ≠ zero", () => {
  const a = app();
  a.dia(0, { foods: [{ id: "a", kcal: 100, calcio: 120, ferro: null }, { id: "b", kcal: 50 }] });
  const t = a.run("totals(TODAY)");
  assert.equal(t.calcio, 120);
  assert.equal(t.falta.calcio, 1);
  assert.equal(t.falta.ferro, 2);
  assert.equal(a.run('fmtTotal(totals(TODAY), "ferro", "mg")'), "—");
});

test("registro de alimento guarda os 12 nutrientes da quantidade", () => {
  const { run } = app();
  const e = run("nutEntry([200, 30, 10, 5, 2, 300, 4, 1.5, 20, 150, 2.25, 400])");
  assert.deepEqual({ ...e }, { kcal: 200, carb: 30, prot: 10, gord: 5, fibra: 2, sodio: 300, acucar: 4, gsat: 1.5, colest: 20, calcio: 150, ferro: 2.3, potassio: 400 });
  assert.equal(run("nutEntry([1, null, null, null, null, null, null, null, null, null, null, null]).carb"), null);
});

test("marcar o dia como completo grava no dia e o resumo do Calorias não comemora dia parcial", () => {
  const a = app();
  a.dia(0, { foods: [{ id: "a", kcal: 500 }] });
  a.run("renderSummary()");
  assert.ok(a.el("balance").classList.contains("none"));
  assert.match(a.el("balLbl").textContent, /parcial/i);
  a.el("diaCompleto").checked = true;
  a.run("setDiaCompleto(true)");
  assert.equal(a.run("days[TODAY].completo"), true);
  a.run("renderSummary()");
  assert.ok(a.el("balance").classList.contains("def"));
});

test("abas: Analytics tem resumo, semana, tabela e metas; Calorias tem o 'dia completo'", () => {
  const pick = v => { const s = html.indexOf(`<main id="view-${v}"`); return html.slice(s, html.indexOf("</main>", s)); };
  const an = pick("analytics");
  for (const id of ["anCons", "anDif", "anDef", "anProt", "anProtFill", "anNutri", "anVit", "anChart", "anTabela",
    "anReg", "anMedia", "anAtiv", "anForca", "chart", "mtObjetivo", "mtTreinoTipo", "mtTreinoDias", "mtTreinoMin",
    "mtTreinoInt", "mtKOrigem", "mtKDef", "mtKValor", "mtKSalvar", "mtKAtual", "mtKErro", "mtPCrit", "mtPValor",
    "mtPSalvar", "mtPAtual", "mtPErro"]) {
    assert.ok(an.includes(`id="${id}"`), `ausente no Analytics: ${id}`);
  }
  assert.ok(pick("calorias").includes('id="diaCompleto"'));
  assert.ok(!html.includes('id="pMeta"'), "meta saiu de Meus dados (agora versionada em Analytics)");
});

test("renderAnalytics desenha sem erro; barra de proteína não passa de 100%", () => {
  const a = app();
  a.run("renderAnalytics()");
  assert.match(a.el("anCons").textContent, /—/);
  a.run('definirMeta(estimarMetaProteina("efsa").meta)');
  a.dia(0, { completo: true, foods: [{ id: "a", kcal: 2500, prot: 120 }] });
  a.run("renderAnalytics()");
  assert.match(a.el("anChart").innerHTML, /<svg/);
  assert.equal(a.el("anProtFill").style.width, "100%");
  assert.doesNotMatch(a.el("anProtSub").textContent + a.el("anDefSub").textContent, /parab|excelente|incr[ií]vel/i);
  assert.match(a.el("anTabela").innerHTML, /<tr/);
});
