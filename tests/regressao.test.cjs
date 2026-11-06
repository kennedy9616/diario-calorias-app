// Regressões da versão 1.1: busca, nutrientes, migração, persistência e importação.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadApp } = require("./helpers.cjs");

const app = loadApp({ base: true });
const { run } = app;

test("base completa carrega e a busca encontra TACO e USDA", () => {
  assert.equal(run("baseFoods.length"), run("ALIMENTOS_BASE.total"));
  assert.ok(run('searchFoods("arroz com feijão").length') > 0);
  assert.ok(run('searchFoods("frango").some(f => f.src.startsWith("usda"))'));
  // hotfix 1.1.1: nomes USDA em português continuam achados pela busca
  assert.equal(run(`wordMatch(makeFood("test", "Feijões e arroz", "usda_fndds", []), "feijao", translations("feijao"))`), 2);
  assert.equal(run(`wordMatch(makeFood("test", "Pães integrais", "usda_fndds", []), "pao", translations("pao"))`), 2);
});

test("tradução casa palavra inteira e fontes oficiais vêm antes da comunidade", () => {
  assert.equal(run('wordMatch(makeFood("test", "Boiled potato", "taco", []), "oleo", ["oil"])'), 0);
  assert.equal(run('wordMatch(makeFood("test", "Olive oil", "taco", []), "oleo", ["oil"])'), 2);
  assert.ok(run(`rankFood(makeFood("taco:test", "Teste", "taco", []), "teste", true)
    < rankFood(makeFood("usuario:test", "Teste", "comunidade", []), "teste", true)`));
});

test("nutrientes escalam pela quantidade e alimento comum herda dados da TACO", () => {
  run('var rice = findByName("Arroz branco cozido")');
  assert.ok(run("rice.nut[NUT.gord] != null"));
  assert.equal(run("nutFor(rice, 200)[NUT.kcal]"), run("rice.nut[NUT.kcal] * 2"));
});

test("migração de alimento cadastrado preserva null e gera id estável", () => {
  run('var old = { n: "Teste antigo", k: 100, c: 0, p: 10 }; var migrated = normalizeCustomFood(old);');
  assert.equal(run("migrated.id"), run("normalizeCustomFood(old).id"));
  assert.notEqual(run("migrated.id"), run("normalizeCustomFood({ ...old, k: 200 }).id"));
  assert.equal(run("migrated.nutrientes_por_100g.carboidratos_g"), null);
  assert.equal(run("cleanCustomFoods([old, old]).length"), 1);
  run('var zero = buildCustomFood({ nome: "Zero", kcal: 0, carb: 0, prot: 0, gord: 0 })');
  assert.equal(run("normalizeCustomFood(zero).nutrientes_por_100g.carboidratos_g"), 0);
  run('var injected = { ...migrated, fonte_id: "taco", unexpected: true }');
  assert.equal(run("normalizeCustomFood(injected).fonte_id"), "usuario");
  assert.equal(run("normalizeCustomFood(injected).unexpected"), undefined);
});

test("totais do dia: soma parcial (≥), sem dado (—) e zero real", () => {
  run('days[TODAY] = { foods: [{ id: "a", kcal: 100, carb: null }, { id: "b", kcal: 200, carb: 10 }], ex: [{ kcal: 50 }] }');
  assert.equal(run("totals().cons"), 300);
  assert.equal(run("totals().ex"), 50);
  assert.equal(run('fmtTotal(totals(), "carb", "g")'), "≥ 10 g");
  assert.equal(run('fmtTotal(totals(), "gord", "g")'), "—");
  run('days[TODAY].foods = [{ id: "zero", kcal: 0, carb: 0 }]');
  assert.equal(run('fmtTotal(totals(), "carb", "g")'), "0 g");
});

test("backup migra alimentos antigos e o navegador recarrega o que foi salvo", () => {
  run("var backup = snapshot(); backup.profile.customFoods = [old]; replaceWith(backup);");
  assert.equal(run("profile.customFoods[0].id"), run("migrated.id"));
  run('days[TODAY] = { foods: [{ id: "zero", kcal: 0, carb: 0 }], ex: [] }');
  run("localStorage.setItem(LSKEY, JSON.stringify(snapshot())); days = {};");
  assert.equal(run("loadSaved()"), true);
  assert.equal(run("days[TODAY].foods[0].id"), "zero");
});

test("lista exportada de alimentos é aceita e mesclada", () => {
  run("var exported = { alimentos: [zero] }");
  assert.equal(run("validData(exported)"), true);
  run("mergeIn(exported)");
  assert.ok(run("profile.customFoods.some(f => f.id === zero.id)"));
});

test("importar lista de alimentos não pede gravação nem troca o diário conectado", async () => {
  await run(`(async () => {
    window.__perm = false;
    window.__prev = { name: "diario-existente.json" };
    fileHandle = window.__prev;
    window.showOpenFilePicker = async () => [{
      name: "alimentos.json",
      getFile: async () => ({ text: async () => JSON.stringify(exported) }),
      requestPermission: async () => { window.__perm = true; return "granted"; }
    }];
    persist = renderProfile = renderAll = toast = () => {};
    await openFile();
  })()`);
  assert.equal(run("window.__perm"), false);
  assert.equal(run("fileHandle === window.__prev"), true);
});
