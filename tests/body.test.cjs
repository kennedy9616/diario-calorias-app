// TMB (Mifflin-St Jeor), histórico de peso e medidas, recálculo pela tendência.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { html, loadApp } = require("./helpers.cjs");

// app com perfil conhecido: 70 kg, 170 cm, 30 anos, coeficiente masculino, sedentário
function app() {
  const a = loadApp();
  a.run('profile = Object.assign(clone(DEFAULT_PROFILE), { peso: 70, altura: 170, idade: 30, sexo: "M", fator: 1.2 }); medidas = [];');
  a.run("persist = () => {}");
  a.d = n => a.run(`addDays(TODAY, ${-n})`);
  a.pesar = (n, kg) => a.run(`addMedida({ data: addDays(TODAY, ${-n}), peso_kg: ${kg} })`);
  return a;
}

test("Mifflin-St Jeor: coeficientes masculino (+5) e feminino (−161)", () => {
  const { run } = app();
  assert.equal(run('tmb({ peso: 70, altura: 170, idade: 30, sexo: "M" })'), 1617.5);
  assert.equal(run('tmb({ peso: 70, altura: 170, idade: 30, sexo: "F" })'), 1451.5);
  assert.equal(run("tdee()"), 1617.5 * 1.2);
});

test("validarMedida aceita medidas parciais e recusa vazio, fora da faixa, não finito e data futura", () => {
  const { run } = app();
  assert.equal(run('validarMedida({ data: TODAY, cintura_cm: 90 }).ok'), true);
  assert.equal(run('validarMedida({ data: TODAY }).ok'), false);
  assert.equal(run('validarMedida({ data: TODAY, peso_kg: 5 }).ok'), false);
  assert.equal(run('validarMedida({ data: TODAY, peso_kg: Infinity }).ok'), false);
  assert.equal(run('validarMedida({ data: TODAY, gordura_pct: 90 }).ok'), false);
  assert.equal(run('validarMedida({ data: addDays(TODAY, 1), peso_kg: 70 }).ok'), false);
  assert.equal(run('validarMedida({ data: "2026-13-40", peso_kg: 70 }).ok'), false);
  const m = run('validarMedida({ data: TODAY, peso_kg: 70.04, cintura_cm: null }).medida');
  assert.equal(m.peso_kg, 70);
  assert.equal(m.cintura_cm, null);
});

test("várias pesagens no mesmo dia viram a média do dia; registro sem peso não conta", () => {
  const a = app();
  a.pesar(0, 80); a.pesar(0, 81);
  a.run("addMedida({ data: TODAY, cintura_cm: 90 })");
  const dias = a.run("pesosDiarios()");
  assert.equal(dias.length, 1);
  assert.equal(dias[0].peso, 80.5);
  assert.equal(dias[0].n, 2);
});

test("tendência = média dos dias com pesagem nos últimos 7 dias, com a contagem de dias", () => {
  const a = app();
  a.pesar(0, 80); a.pesar(3, 82); a.pesar(6, 84); a.pesar(7, 100);
  const t = a.run("pesoTendencia()");
  assert.equal(t.peso, 82);
  assert.equal(t.dias, 3);
  assert.deepEqual({ ...a.run("pesoTendencia(addDays(TODAY, -30))") }, { peso: null, dias: 0 });
});

test("pesagem isolada não recalcula: TMB usa o peso de Meus dados até haver 3 dias na semana", () => {
  const a = app();
  a.pesar(0, 90);
  let ref = a.run("pesoReferencia()");
  assert.equal(ref.metodo, "manual");
  assert.equal(ref.peso, 70);
  assert.equal(ref.dias, 1);
  assert.equal(a.run("tmb()"), 1617.5);

  a.pesar(1, 90); a.pesar(2, 90);
  ref = a.run("pesoReferencia()");
  assert.equal(ref.metodo, "tendencia_7d");
  assert.equal(ref.peso, 90);
  assert.equal(a.run("tmb()"), 1617.5 + 200);   // +20 kg × 10
});

test("idade pela data de nascimento acompanha o aniversário", () => {
  const a = app();
  assert.equal(a.run('idadeEm("1990-06-15", "2026-06-14")'), 35);
  assert.equal(a.run('idadeEm("1990-06-15", "2026-06-15")'), 36);
  assert.equal(a.run('idadeEm("", TODAY)'), null);
  a.run('profile.nascimento = addDays(TODAY, -365 * 40 - 15)');
  assert.equal(a.run("idadeAtual()"), 40);
  assert.equal(a.run("tmb()"), 1617.5 - 50);   // 10 anos a mais × 5
  a.run('profile.nascimento = ""');
  assert.equal(a.run("idadeAtual()"), 30);
});

test("variação semanal só com cobertura nas duas semanas (janelas iguais)", () => {
  const a = app();
  a.pesar(0, 80); a.pesar(2, 80); a.pesar(4, 80);
  let v = a.run("variacaoSemanal()");
  assert.equal(v.delta, null);
  assert.equal(v.diasAtual, 3);
  assert.equal(v.diasAnterior, 0);
  a.pesar(7, 81); a.pesar(9, 81); a.pesar(11, 81);
  v = a.run("variacaoSemanal()");
  assert.equal(v.delta, -1);
  assert.equal(v.diasAnterior, 3);
});

test("série do gráfico: pesagem do dia e média móvel de 7 dias (só com 3+ dias)", () => {
  const a = app();
  a.pesar(2, 80); a.pesar(1, 82); a.pesar(0, 84);
  const s = a.run("serieTendencia(TODAY, 5)");
  assert.equal(s.length, 5);
  assert.equal(s[4].data, a.d(0));
  assert.equal(s[4].peso, 84);
  assert.equal(s[4].media, 82);
  assert.equal(s[3].media, null);   // só 2 dias até ali
  assert.equal(s[0].peso, null);
});

test("o dia salvo guarda TMB, peso de referência e método; dias passados mantêm o valor da época", () => {
  const a = app();
  a.run('days[TODAY] = { foods: [{ id: "x", kcal: 100 }], ex: [] }; saveDay(TODAY);');
  assert.equal(a.run("days[TODAY].tmb"), 1618);
  assert.equal(a.run("days[TODAY].pesoRef"), 70);
  assert.equal(a.run("days[TODAY].pesoMetodo"), "manual");
  const ontem = a.d(1);
  a.run(`days["${ontem}"] = { foods: [], ex: [], tdee: 2000, tmb: 1500, pesoRef: 75 }`);
  assert.equal(a.run(`dayTmb("${ontem}")`), 1500);
  assert.equal(a.run("dayTmb(TODAY)"), 1617.5);
  const limpo = a.run(`cleanDays(days)["${ontem}"]`);
  assert.equal(limpo.tmb, 1500);
  assert.equal(limpo.pesoRef, 75);
});

test("medidas entram no backup, voltam do navegador e se juntam sem duplicar", () => {
  const a = app();
  a.pesar(0, 80);
  a.run("addMedida({ data: TODAY, cintura_cm: 90 })");
  const snap = a.run("snapshot()");
  assert.equal(snap.medidas.length, 2);
  a.run("localStorage.setItem(LSKEY, JSON.stringify(snapshot())); medidas = [];");
  assert.equal(a.run("loadSaved()"), true);
  assert.equal(a.run("medidas.length"), 2);
  a.run("mergeIn(JSON.parse(JSON.stringify(snapshot())))");
  assert.equal(a.run("medidas.length"), 2);
  a.run('mergeIn({ medidas: [{ id: "outro", data: TODAY, t: 1, peso_kg: 81 }, { id: "ruim", data: TODAY, peso_kg: -3 }] })');
  assert.equal(a.run("medidas.length"), 3);
  a.run('replaceWith({ profile: {}, days: {} })');   // backup antigo, sem medidas
  assert.equal(a.run("medidas.length"), 0);
  assert.equal(a.run('validData({ medidas: [] })'), true);
});

test("removeMedida apaga só o registro escolhido", () => {
  const a = app();
  a.pesar(0, 80); a.pesar(1, 81);
  const id = a.run("medidas[0].id");
  a.run(`removeMedida("${id}")`);
  assert.equal(a.run("medidas.length"), 1);
  assert.notEqual(a.run("medidas[0].id"), id);
});

test("metas automáticas só para adultos de 18 a 64 anos sem condição especial", () => {
  const a = app();
  assert.equal(a.run("elegibilidade().ok"), true);
  a.run("profile.idade = 17");
  assert.equal(a.run("elegibilidade().ok"), false);
  a.run("profile.idade = 65");
  assert.equal(a.run("elegibilidade().ok"), false);
  a.run('profile.idade = 30; profile.condicoes = ["gestante"]');
  const e = a.run("elegibilidade()");
  assert.equal(e.ok, false);
  assert.ok(e.motivos.some(m => /gestante/i.test(m)));
});

test("gasto do exercício usa o peso de referência", () => {
  const a = app();
  a.pesar(0, 80); a.pesar(1, 80); a.pesar(2, 80);
  a.el("exType").value = "caminhada"; a.el("exInt").value = "1"; a.el("exMin").value = "60";
  assert.equal(Math.round(a.run("exKcal().kcal")), Math.round((4.3 - 1) * 80));
});

test("aba Histórico tem TMB, registro de medidas, gráfico e os dados detalhados", () => {
  const start = html.indexOf('<main id="view-historico"');
  const sec = html.slice(start, html.indexOf("</main>", start));
  for (const id of ["tmbVal", "tmbDet", "tmbAviso", "mData", "mPeso", "mCintura", "mQuadril", "mBraco", "mCoxa", "mGordura",
    "addMedida", "medidaErro", "pesoChart", "pesoTend", "pesoVar", "medidaList", "pNasc",
    "condGestante", "condLactante", "condTA", "condRenal", "condLiquidos"]) {
    assert.ok(sec.includes(`id="${id}"`), `ausente no Histórico: ${id}`);
  }
});

test("renderHistorico desenha sem erro com e sem dados", () => {
  const a = app();
  a.run("renderHistorico()");
  assert.match(a.el("medidaList").innerHTML, /Nenhuma/);
  a.pesar(0, 80); a.pesar(1, 81); a.pesar(2, 82);
  a.run("renderHistorico()");
  assert.match(a.el("pesoChart").innerHTML, /<svg/);
  assert.match(a.el("tmbVal").textContent, /\d/);
  assert.match(a.el("pesoTend").textContent, /81/);
});
