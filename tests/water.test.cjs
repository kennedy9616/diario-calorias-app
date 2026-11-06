// Água: copo configurável, registro por toque, desfazer, silhueta, meta estimada/personalizada.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { html, loadApp } = require("./helpers.cjs");

function app(opts) {
  const a = loadApp(opts);
  a.run(`profile = Object.assign(clone(DEFAULT_PROFILE), { peso: 70, altura: 170, idade: 30, sexo: "M", fator: 1.2 });
    medidas = []; metas = []; days = {}; cur = TODAY; renderAll = () => {}; initAgua();`);
  return a;
}
const metaManual = (ml, escopo = "agua_pura") => `definirMeta(metaAguaInformada(${ml}, { origem: "manual", escopo: "${escopo}", sentido: "meta" }).meta)`;

/* ---------- Critérios de aceite do copo ---------- */
test("copo de 250 ml e 3 toques = exatamente 750 ml e 3 registros; desfazer volta para 500 ml", () => {
  const a = app();
  assert.equal(a.run("definirCopo(250).ok"), true);
  for (let i = 0; i < 3; i++) a.el("aguaCopo").dispatch("click");
  assert.equal(a.run("days[TODAY].agua.length"), 3);
  assert.equal(a.run("aguaDia(TODAY).total_ml"), 750);
  assert.equal(new Set(a.run("days[TODAY].agua.map(x => x.id)")).size, 3, "ids distintos");
  a.el("aguaDesfazer").dispatch("click");
  assert.equal(a.run("aguaDia(TODAY).total_ml"), 500);
  assert.equal(a.run("days[TODAY].agua.length"), 2);
});

test("initAgua chamado de novo não duplica listeners: um toque continua sendo um registro", () => {
  const a = app();
  a.run("initAgua(); initAgua();");
  a.el("aguaCopo").dispatch("click");
  assert.equal(a.run("days[TODAY].agua.length"), 1);
});

test("mudar o copo depois não altera os volumes já registrados", () => {
  const a = app();
  a.run("definirCopo(250); registrarCopo(); registrarCopo();");
  a.run("definirCopo(500); registrarCopo();");
  assert.deepEqual([...a.run("days[TODAY].agua.map(x => x.ml)")], [250, 250, 500]);
  assert.equal(a.run("aguaDia(TODAY).total_ml"), 1000);
});

test("copo: opções rápidas e volume próprio; vazio, texto, nulo, negativo e fora da faixa dão erro explicado", () => {
  const a = app();
  for (const v of [150, 200, 250, 300, 500]) assert.equal(a.run(`definirCopo(${v}).ml`), v);
  assert.equal(a.run('definirCopo("350").ml'), 350);
  assert.equal(a.run('definirCopo("1.000").ok'), false, "milhar com ponto não é aceito (ambíguo)");
  for (const v of ['""', "null", '"abc"', "-200", "0", "20", "5000", '"2,5,1"']) {
    const r = a.run(`definirCopo(${v})`);
    assert.equal(r.ok, false, v);
    assert.ok(r.erro.length > 10, "mensagem explica o erro");
  }
  assert.equal(a.run("prefs.copo_ml"), 350, "erro não muda o copo atual");
  a.run("renderCopo()");
  assert.match(a.el("aguaCopoAtual").textContent, /Cada toque adiciona 350 ml/);
});

test("o copo e os registros são salvos e voltam ao reabrir o app", () => {
  const storage = new Map();
  const a = app({ storage });
  a.run("definirCopo(300); registrarCopo();");
  const b = loadApp({ storage });
  assert.equal(b.run("loadSaved()"), true);
  assert.equal(b.run("prefs.copo_ml"), 300);
  assert.equal(b.run("aguaDia(TODAY).total_ml"), 300);
});

test("cada registro guarda id, volume, tipo e horário; editar e excluir mudam só o registro escolhido", () => {
  const a = app();
  a.run('addAgua(250, "agua"); addAgua(300, "outra");');
  const r = a.run("days[TODAY].agua[0]");
  assert.ok(r.id && r.ml === 250 && r.tipo === "agua" && Number.isFinite(r.t));
  assert.equal(a.run("keyOfT(days[TODAY].agua[0].t)"), a.run("TODAY"));
  const id = r.id;
  assert.equal(a.run(`updateAgua("${id}", { ml: 400, hora: "07:15", tipo: "agua" }).ok`), true);
  assert.equal(a.run(`days[TODAY].agua.find(x => x.id === "${id}").ml`), 400);
  assert.equal(a.run(`horaDe(days[TODAY].agua.find(x => x.id === "${id}").t)`), "07:15");
  assert.equal(a.run(`updateAgua("${id}", { ml: 400, hora: "25:00", tipo: "agua" }).ok`), false);
  assert.equal(a.run(`updateAgua("${id}", { ml: -5, hora: "07:00", tipo: "agua" }).ok`), false);
  a.run(`removeAgua("${id}")`);
  assert.equal(a.run("aguaDia(TODAY).total_ml"), 300);
});

test("registro em dia passado fica com horário daquele dia (não no dia de hoje)", () => {
  const a = app();
  a.run('cur = addDays(TODAY, -2); addAgua(200, "agua");');
  assert.equal(a.run("keyOfT(days[addDays(TODAY, -2)].agua[0].t)"), a.run("addDays(TODAY, -2)"));
});

/* ---------- Silhueta ---------- */
test("progresso visual = limitar(consumo / meta, 0 a 1); sem meta ou meta inválida = 0, nunca NaN", () => {
  const { run } = app();
  assert.equal(run("progressoVisual(0, 2000)"), 0);
  assert.equal(run("progressoVisual(1000, 2000)"), 0.5);
  assert.equal(run("progressoVisual(2000, 2000)"), 1);
  assert.equal(run("progressoVisual(3500, 2000)"), 1);
  for (const m of ["null", "0", "-1", "NaN", "Infinity", "undefined"]) assert.equal(run(`progressoVisual(500, ${m})`), 0, m);
  assert.equal(run("progressoVisual(null, 2000)"), 0);
});

test("silhueta: água sobe de baixo para cima e para em 100% (nunca passa do contorno)", () => {
  const a = app();
  const topo = () => Number(/translateY\(([-\d.]+)px\)/.exec(a.run("lastTransform"))[1]);
  a.run(`var lastTransform = "";`);
  a.run(`(() => { const fig = $("aguaFig"); const g = { style: {}, classList: { toggle() {} } };
    fig.querySelector = sel => (sel === ".nivel" ? g : null);
    Object.defineProperty(g.style, "transform", { set(v) { lastTransform = v; }, get() { return lastTransform; } });
    fig.dataset.ok = "1"; })()`);
  a.run(metaManual(2000));
  a.run("renderAguaResumo()");
  const vazio = topo();
  a.run('addAgua(1000, "agua"); renderAguaResumo();');
  const meio = topo();
  a.run('addAgua(1000, "agua"); renderAguaResumo();');
  const cheio = topo();
  a.run('addAgua(1500, "agua"); renderAguaResumo();');
  const acima = topo();
  assert.ok(vazio > a.run("SIL_BASE"), "vazio: água abaixo dos pés");
  assert.ok(meio < vazio && cheio < meio, "sobe com o consumo");
  assert.equal(cheio, a.run("SIL_TOPO"), "100% = topo da cabeça");
  assert.equal(acima, cheio, "acima da meta continua em 100%");
  assert.match(a.el("aguaTotal").textContent, /3,5 L/, "total real preservado");
  assert.match(a.el("aguaRestante").textContent, /Meta atingida.*1,5 L além/);
  assert.match(a.el("aguaPct").textContent, /175%/);
});

test("telas de Água sem meta, com meta e acima: texto informa total, %, restante (mínimo 0) e copo", () => {
  const a = app();
  a.run("renderAgua()");
  assert.equal(a.el("aguaTotal").textContent, "0 ml");
  assert.match(a.el("aguaRestante").textContent, /Defina uma meta/);
  assert.ok(!a.el("aguaMetaLink").classList.contains("hide"));
  a.run(metaManual(2000) + '; addAgua(500, "agua"); renderAgua();');
  assert.match(a.el("aguaPct").textContent, /25% da meta/);
  assert.match(a.el("aguaRestante").textContent, /Faltam 1,5 L/);
  assert.match(a.el("aguaCopoAtual").textContent, /250 ml/);
  assert.match(a.el("aguaList").innerHTML, /500 ml/);
  assert.match(a.el("aguaSemana").innerHTML, /<svg/);
  const txt = [a.el("aguaMetaTxt"), a.el("aguaRestante"), a.el("aguaAviso"), a.el("aguaPct")].map(e => e.textContent).join(" ");
  assert.doesNotMatch(txt, /NaN|Infinity|undefined/);
  assert.doesNotMatch(txt, /parab|excelente|incr[ií]vel|hidratad/i, "sem prêmio por beber mais");
});

/* ---------- Meta ---------- */
test("meta estimada (EFSA): água total 2,5 L (M) / 2,0 L (F) − 20% dos alimentos; peso e altura não entram", () => {
  const a = app();
  let r = a.run("estimarMetaAgua()");
  assert.equal(r.ok, true);
  assert.equal(r.meta.valor, 2000);
  assert.equal(r.meta.origem, "estimada");
  assert.equal(r.meta.escopo, "bebidas_total");
  assert.match(r.meta.fonte_url, /efsa\.europa\.eu/);
  assert.equal(r.meta.dados_utilizados.usa_peso, false);
  assert.equal(r.meta.dados_utilizados.usa_altura, false);
  a.run('profile.sexo = "F"');
  assert.equal(a.run("estimarMetaAgua().meta.valor"), 1600);
  a.run("profile.peso = 120; profile.altura = 200");
  assert.equal(a.run("estimarMetaAgua().meta.valor"), 1600, "não muda com peso ou altura");
});

test("sem dados ou fora do escopo, não estima: oferece a meta personalizada", () => {
  const a = app();
  a.run('profile.sexo = ""');
  assert.equal(a.run("estimarMetaAgua().ok"), false);
  a.run('profile.sexo = "M"; profile.idade = null');
  assert.match(a.run("estimarMetaAgua().erro"), /Idade não informada/);
  a.run('profile.idade = 30; profile.condicoes = ["gestante"]');
  assert.equal(a.run("estimarMetaAgua().ok"), false);
  a.run("profile.condicoes = []");
  assert.equal(a.run(`metaAguaInformada(2200, { origem: "manual" }).ok`), true);
});

test("meta personalizada: 500–6000 ml; limite só de profissional; restrição de líquidos só profissional", () => {
  const { run } = app();
  const ok = run('metaAguaInformada(2000, { origem: "manual", escopo: "agua_pura", sentido: "meta" })');
  assert.equal(ok.ok, true);
  assert.equal(ok.meta.unidade, "ml/dia");
  assert.match(ok.meta.metodo, /personalizada/);
  for (const v of ["300", "9000", "null", '""', "NaN"]) assert.equal(run(`metaAguaInformada(${v}, { origem: "manual" }).ok`), false, v);
  assert.equal(run('metaAguaInformada(1500, { origem: "manual", sentido: "limite" }).ok'), false);
  assert.equal(run('metaAguaInformada(1500, { origem: "profissional", escopo: "bebidas_total", sentido: "limite" }).ok'), true);
  run('profile.condicoes = ["liquidos"]');
  assert.equal(run('metaAguaInformada(2000, { origem: "manual" }).ok'), false);
  assert.equal(run('metaAguaInformada(1200, { origem: "profissional", sentido: "limite" }).ok'), true);
});

test("comparação usa só o volume do mesmo escopo da meta; restante nunca negativo", () => {
  const a = app();
  a.run('addAgua(1000, "agua"); addAgua(600, "outra");');
  a.run(metaManual(2000));
  let c = a.run("comparaAgua(TODAY)");
  assert.equal(c.consumo, 1000);
  assert.equal(c.pct, 50);
  assert.equal(c.restante, 1000);
  a.run(metaManual(1200, "bebidas_total"));
  c = a.run("comparaAgua(TODAY)");
  assert.equal(c.consumo, 1600);
  assert.equal(c.restante, 0);
  assert.equal(c.excedente, 400);
});

test("limite de líquidos (profissional): acima do limite é sinalizado", () => {
  const a = app();
  a.run('definirMeta(metaAguaInformada(1500, { origem: "profissional", escopo: "bebidas_total", sentido: "limite" }).meta)');
  a.run('addAgua(1000, "agua"); addAgua(700, "outra");');
  assert.equal(a.run("comparaAgua(TODAY).status"), "acima_limite");
  a.run("renderAgua()");
  assert.match(a.el("aguaMetaTxt").textContent, /Limite/);
  assert.match(a.el("aguaRestante").textContent, /Acima do limite em 200 ml/);
});

test("mudar a meta não reclassifica o passado: cada dia usa a meta vigente nele", () => {
  const a = app();
  a.run(`definirMeta(metaAguaInformada(1500, { origem: "manual" }).meta, addDays(TODAY, -5))`);
  a.run('cur = addDays(TODAY, -2); addAgua(1500, "agua"); cur = TODAY;');
  assert.equal(a.run("comparaAgua(addDays(TODAY, -2)).status"), "alcancada");
  a.run(metaManual(3000));
  assert.equal(a.run("comparaAgua(addDays(TODAY, -2)).meta"), 1500);
  assert.equal(a.run("comparaAgua(addDays(TODAY, -2)).status"), "alcancada");
  assert.equal(a.run("comparaAgua(TODAY).meta"), 3000);
});

test("virada do dia: novo total começa em zero e o histórico fica", () => {
  const a = app();
  a.run('addAgua(750, "agua")');
  const ontem = a.run("TODAY");
  assert.equal(a.run("atualizarHoje(new Date(fromKey(addDays(TODAY, 1)).getTime() + 3600e3))"), true);
  assert.equal(a.run("cur"), a.run("TODAY"));
  assert.notEqual(a.run("TODAY"), ontem);
  assert.equal(a.run("aguaDia(TODAY).total_ml"), null, "dia novo sem registro (não é zero)");
  assert.equal(a.run(`aguaDia("${ontem}").total_ml`), 750);
  a.run("atualizarHoje = () => false; registrarCopo()");   // relógio simulado: não volta para a data real
  assert.equal(a.run("aguaDia(TODAY).total_ml"), 250);
  assert.equal(a.run(`aguaDia("${ontem}").total_ml`), 750);
});

test("água entra no backup, volta do navegador e se junta sem duplicar; registros inválidos caem", () => {
  const a = app();
  a.run('addAgua(300, "agua")');
  a.run(metaManual(2000));
  a.run("localStorage.setItem(LSKEY, JSON.stringify(snapshot())); days = {}; metas = [];");
  assert.equal(a.run("loadSaved()"), true);
  assert.equal(a.run("aguaDia(TODAY).agua_pura_ml"), 300);
  assert.equal(a.run('metaVigente("agua", TODAY).escopo'), "agua_pura");
  a.run("mergeIn(JSON.parse(JSON.stringify(snapshot())))");
  assert.equal(a.run("days[TODAY].agua.length"), 1);
  a.run('mergeIn({ days: { [TODAY]: { foods: [], ex: [], agua: [{ id: "n", ml: 200, tipo: "outra", t: 1 }, { id: "x", ml: -1, tipo: "agua" }] } } })');
  assert.equal(a.run("days[TODAY].agua.length"), 2);
  assert.equal(a.run("aguaDia(TODAY).total_ml"), 500);
});

test("aba Água tem silhueta, copo, desfazer, configuração do copo e lista; meta e EFSA ficam no Perfil", () => {
  const pick = v => { const s = html.indexOf(`<main id="view-${v}"`); return html.slice(s, html.indexOf("</main>", s)); };
  const sec = pick("agua");
  for (const id of ["aguaFig", "aguaTotal", "aguaMetaTxt", "aguaPct", "aguaRestante", "aguaCopo", "aguaCopoVol", "aguaCopoAtual",
    "aguaDesfazer", "aguaUltimo", "aguaCopoOpcoes", "aguaCopoMl", "aguaCopoSalvar", "aguaCopoErro", "aguaTipo", "aguaList", "aguaSemana"]) {
    assert.ok(sec.includes(`id="${id}"`), `ausente na aba Água: ${id}`);
  }
  assert.deepEqual([...sec.matchAll(/data-copo="(\d+)"/g)].map(m => Number(m[1])), [150, 200, 250, 300, 500]);
  assert.match(sec, /não o nível de hidratação/);
  const perfil = pick("perfil");
  assert.match(perfil, /id="aguaMetaOrigem"[\s\S]*value="estimada"[\s\S]*value="manual"/);
  assert.match(perfil, /efsa\.europa\.eu/);
});
