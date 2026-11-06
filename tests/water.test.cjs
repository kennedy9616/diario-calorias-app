// Hidratação: registro em ml, soma diária por tipo e comparação com meta do mesmo escopo.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { html, loadApp } = require("./helpers.cjs");

function app() {
  const a = loadApp();
  a.run(`profile = Object.assign(clone(DEFAULT_PROFILE), { peso: 70, altura: 170, idade: 30, sexo: "M", fator: 1.2 });
    medidas = []; metas = []; days = {}; persist = () => {}; cur = TODAY;`);
  return a;
}

test("validarAgua: ml finito entre 10 e 3000 por registro; tipo água ou outra bebida", () => {
  const { run } = app();
  assert.equal(run('validarAgua({ ml: 250, tipo: "agua" }).ok'), true);
  assert.equal(run('validarAgua({ ml: 250.4, tipo: "agua" }).registro.ml'), 250);
  assert.equal(run('validarAgua({ ml: 5, tipo: "agua" }).ok'), false);
  assert.equal(run('validarAgua({ ml: 5000, tipo: "agua" }).ok'), false);
  assert.equal(run('validarAgua({ ml: NaN, tipo: "agua" }).ok'), false);
  assert.equal(run('validarAgua({ ml: 200, tipo: "suco" }).ok'), false);
});

test("soma cumulativa do dia por tipo; dia sem registro não é zero", () => {
  const { run } = app();
  let a = run("aguaDia(TODAY)");
  assert.equal(a.n, 0);
  assert.equal(a.agua_pura_ml, null);
  assert.equal(a.total_ml, null);
  run('addAgua(250, "agua"); addAgua(500, "agua"); addAgua(200, "outra");');
  a = run("aguaDia(TODAY)");
  assert.equal(a.n, 3);
  assert.equal(a.agua_pura_ml, 750);
  assert.equal(a.outras_bebidas_ml, 200);
  assert.equal(a.total_ml, 950);
  assert.equal(a.agua_alimentos_estimada_ml, null);   // base sem umidade: não estimada
  const id = run("days[TODAY].agua[0].id");
  run(`removeAgua("${id}")`);
  assert.equal(run("aguaDia(TODAY).agua_pura_ml"), 500);
});

test("meta de água: hábito ajustável (500–6000 ml); limite só de profissional; fora do escopo só profissional", () => {
  const { run } = app();
  const ok = run('metaAguaInformada(2000, { origem: "manual", escopo: "agua_pura", sentido: "meta" })');
  assert.equal(ok.ok, true);
  assert.equal(ok.meta.tipo, "agua");
  assert.equal(ok.meta.unidade, "ml/dia");
  assert.equal(ok.meta.escopo, "agua_pura");
  assert.match(ok.meta.metodo, /hábito/);
  assert.equal(run('metaAguaInformada(300, { origem: "manual", escopo: "agua_pura", sentido: "meta" }).ok'), false);
  assert.equal(run('metaAguaInformada(9000, { origem: "manual", escopo: "agua_pura", sentido: "meta" }).ok'), false);
  assert.equal(run('metaAguaInformada(1500, { origem: "manual", escopo: "bebidas_total", sentido: "limite" }).ok'), false);
  assert.equal(run('metaAguaInformada(1500, { origem: "profissional", escopo: "bebidas_total", sentido: "limite" }).ok'), true);
  run('profile.condicoes = ["liquidos"]');
  assert.equal(run('metaAguaInformada(2000, { origem: "manual", escopo: "agua_pura", sentido: "meta" }).ok'), false);
  assert.equal(run("sugestaoMetaAgua()"), null);
  run("profile.condicoes = []");
  assert.equal(run("sugestaoMetaAgua()"), 2000);
});

test("comparação usa só o volume do mesmo escopo da meta", () => {
  const a = app();
  a.run('addAgua(1000, "agua"); addAgua(600, "outra");');
  a.run('definirMeta(metaAguaInformada(2000, { origem: "manual", escopo: "agua_pura", sentido: "meta" }).meta)');
  let c = a.run("comparaAgua(TODAY)");
  assert.equal(c.consumo, 1000);
  assert.equal(c.pct, 50);
  assert.equal(c.status, "abaixo");
  a.run('definirMeta(metaAguaInformada(2000, { origem: "manual", escopo: "bebidas_total", sentido: "meta" }).meta)');
  c = a.run("comparaAgua(TODAY)");
  assert.equal(c.consumo, 1600);
  assert.equal(c.pct, 80);
});

test("sem prêmio por excesso: meta alcançada é neutra; volume muito alto gera aviso", () => {
  const a = app();
  a.run('definirMeta(metaAguaInformada(2000, { origem: "manual", escopo: "agua_pura", sentido: "meta" }).meta)');
  a.run('addAgua(2500, "agua")');
  let c = a.run("comparaAgua(TODAY)");
  assert.equal(c.status, "alcancada");
  assert.equal(c.alto, false);
  a.run('addAgua(2000, "agua")');
  c = a.run("comparaAgua(TODAY)");
  assert.equal(c.alto, true);
  assert.equal(a.run("aguaNivel(225)"), 100);
  assert.equal(a.run("aguaNivel(null)"), 0);
  a.run("renderAgua()");
  const txt = a.el("aguaMetaTxt").textContent + a.el("aguaAviso").textContent;
  assert.doesNotMatch(txt, /parab|excelente|incr[ií]vel|hidratad/i);
  assert.ok(!a.el("aguaAviso").classList.contains("hide"));
});

test("limite de líquidos (profissional): acima do limite é sinalizado", () => {
  const a = app();
  a.run('definirMeta(metaAguaInformada(1500, { origem: "profissional", escopo: "bebidas_total", sentido: "limite" }).meta)');
  a.run('addAgua(1000, "agua"); addAgua(700, "outra");');
  const c = a.run("comparaAgua(TODAY)");
  assert.equal(c.status, "acima_limite");
  a.run("renderAgua()");
  assert.match(a.el("aguaMetaTxt").textContent, /limite/i);
});

test("cada dia usa a meta de água vigente naquele dia", () => {
  const a = app();
  a.run('definirMeta(metaAguaInformada(1500, { origem: "manual", escopo: "agua_pura", sentido: "meta" }).meta, addDays(TODAY, -5))');
  a.run('definirMeta(metaAguaInformada(2000, { origem: "manual", escopo: "agua_pura", sentido: "meta" }).meta)');
  a.run('cur = addDays(TODAY, -2); addAgua(750, "agua"); cur = TODAY;');
  assert.equal(a.run("comparaAgua(addDays(TODAY, -2)).meta"), 1500);
  assert.equal(a.run("comparaAgua(addDays(TODAY, -2)).pct"), 50);
  assert.equal(a.run("comparaAgua(TODAY).meta"), 2000);
  assert.equal(a.run("comparaAgua(TODAY).status"), "sem_registro");
});

test("água entra no backup, volta do navegador e se junta sem duplicar; registros inválidos caem", () => {
  const a = app();
  a.run('addAgua(300, "agua")');
  a.run('definirMeta(metaAguaInformada(2000, { origem: "manual", escopo: "agua_pura", sentido: "meta" }).meta)');
  a.run("localStorage.setItem(LSKEY, JSON.stringify(snapshot())); days = {}; metas = [];");
  assert.equal(a.run("loadSaved()"), true);
  assert.equal(a.run("aguaDia(TODAY).agua_pura_ml"), 300);
  assert.equal(a.run('metaVigente("agua", TODAY).escopo'), "agua_pura");
  assert.equal(a.run('metaVigente("agua", TODAY).sentido'), "meta");
  a.run("mergeIn(JSON.parse(JSON.stringify(snapshot())))");
  assert.equal(a.run("days[TODAY].agua.length"), 1);
  a.run('mergeIn({ days: { [TODAY]: { foods: [], ex: [], agua: [{ id: "n", ml: 200, tipo: "outra", t: 1 }, { id: "x", ml: -1, tipo: "agua" }] } } })');
  assert.equal(a.run("days[TODAY].agua.length"), 2);
  assert.equal(a.run("aguaDia(TODAY).total_ml"), 500);
});

test("aba Água tem registro rápido, copo, lista, semana e meta com referência EFSA", () => {
  const s = html.indexOf('<main id="view-agua"');
  const sec = html.slice(s, html.indexOf("</main>", s));
  for (const id of ["aguaGlass", "aguaTotal", "aguaMetaTxt", "aguaOutras", "aguaAviso", "aguaQuick", "aguaMl", "aguaTipo",
    "aguaErro", "aguaAdd", "aguaList", "aguaSemana", "aguaMetaBox", "aguaMetaSum", "aguaMetaAtual", "aguaMetaValor",
    "aguaMetaEscopo", "aguaMetaSentido", "aguaMetaOrigem", "aguaMetaSalvar", "aguaMetaErro", "aguaSugestao", "aguaRef"]) {
    assert.ok(sec.includes(`id="${id}"`), `ausente na aba Água: ${id}`);
  }
  assert.ok((sec.match(/data-ml="\d+"/g) || []).length >= 4, "botões de volume rápido");
  assert.match(sec, /efsa\.europa\.eu/);
  assert.doesNotMatch(sec, /em breve/i);
});

test("renderAgua desenha o copo e a semana sem erro, com e sem dados", () => {
  const a = app();
  a.run("renderAgua()");
  assert.match(a.el("aguaGlass").innerHTML, /<svg/);
  assert.match(a.el("aguaList").innerHTML, /Nenhum/);
  a.run('addAgua(500, "agua"); renderAgua();');
  assert.match(a.el("aguaTotal").textContent, /500/);
  assert.match(a.el("aguaSemana").innerHTML, /<svg/);
});
