// Verificações locais sem dependências: node tools/smoke.cjs
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.join(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const html = read("index.html");
const scripts = [...html.matchAll(/<script defer src="([^"]+)"/g)].map(m => m[1]);
const source = scripts.map(read).join("\n");
new vm.Script(source); // Inclui colisões de globais entre scripts clássicos.
const sw = read("sw.js");
new vm.Script(sw);
const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]));
for (const [, id] of source.matchAll(/\$\("([^"]+)"\)/g)) {
  assert.ok(ids.has(id), `Elemento ausente no HTML: ${id}`);
}
for (const file of scripts) assert.ok(sw.includes(`"./${file}"`), `Sem cache: ${file}`);
for (const [, file] of sw.matchAll(/"\.\/([^"]+)"/g)) {
  assert.ok(fs.existsSync(path.join(root, file)), `Arquivo ausente: ${file}`);
}
for (const file of ["manifest.webmanifest", "data/alimentos_usuario.json"]) JSON.parse(read(file));

const saved = new Map();
const context = vm.createContext({
  assert, console, setTimeout, clearTimeout,
  document: { getElementById: () => ({}), addEventListener() {} },
  navigator: { userAgent: "test", platform: "", maxTouchPoints: 0 },
  addEventListener() {},
  showSaveFilePicker() {},
  localStorage: {
    getItem: key => saved.get(key) || null,
    setItem: (key, value) => saved.set(key, value),
    removeItem: key => saved.delete(key)
  }
});
context.window = context;
context.self = context;
vm.runInContext(scripts.filter(f => f !== "js/app.js").map(read).join("\n"), context);
vm.runInContext(read("data/alimentos-base.js"), context);

(async () => {
  await vm.runInContext(`(async () => {
    applyBase(ALIMENTOS_BASE);
    baseState = "ok";
    assert.equal(baseFoods.length, ALIMENTOS_BASE.total);
    assert.ok(searchFoods("arroz com feijão").length > 0);
    assert.ok(searchFoods("frango").some(f => f.src.startsWith("usda")));
    assert.equal(wordMatch(makeFood("test", "Boiled potato", "taco", []), "oleo", ["oil"]), 0);
    assert.equal(wordMatch(makeFood("test", "Olive oil", "taco", []), "oleo", ["oil"]), 2);
    const official = makeFood("taco:test", "Teste", "taco", []);
    const community = makeFood("usuario:test", "Teste", "comunidade", []);
    assert.ok(rankFood(official, "teste", true) < rankFood(community, "teste", true));
    const rice = findByName("Arroz branco cozido");
    assert.ok(rice.nut[NUT.gord] != null);
    assert.equal(nutFor(rice, 200)[NUT.kcal], rice.nut[NUT.kcal] * 2);

    const old = { n: "Teste antigo", k: 100, c: 0, p: 10 };
    const migrated = normalizeCustomFood(old);
    assert.equal(migrated.id, normalizeCustomFood(old).id);
    assert.notEqual(migrated.id, normalizeCustomFood({ ...old, k: 200 }).id);
    assert.equal(migrated.nutrientes_por_100g.carboidratos_g, null);
    assert.equal(cleanCustomFoods([old, old]).length, 1);
    const zero = buildCustomFood({ nome: "Zero", kcal: 0, carb: 0, prot: 0, gord: 0 });
    assert.equal(normalizeCustomFood(zero).nutrientes_por_100g.carboidratos_g, 0);
    const injected = { ...migrated, fonte_id: "taco", unexpected: true };
    assert.equal(normalizeCustomFood(injected).fonte_id, "usuario");
    assert.equal(normalizeCustomFood(injected).unexpected, undefined);

    days[TODAY] = { foods: [{ id: "a", kcal: 100, carb: null }, { id: "b", kcal: 200, carb: 10 }], ex: [{ kcal: 50 }] };
    assert.equal(totals().cons, 300);
    assert.equal(totals().ex, 50);
    assert.equal(fmtTotal(totals(), "carb", "g"), "≥ 10 g");
    assert.equal(fmtTotal(totals(), "gord", "g"), "—");
    days[TODAY].foods = [{ id: "zero", kcal: 0, carb: 0 }];
    assert.equal(fmtTotal(totals(), "carb", "g"), "0 g");
    const backup = snapshot();
    backup.profile.customFoods = [old];
    replaceWith(backup);
    assert.equal(profile.customFoods[0].id, migrated.id);
    localStorage.setItem(LSKEY, JSON.stringify(snapshot()));
    days = {};
    assert.equal(loadSaved(), true);
    assert.equal(days[TODAY].foods[0].id, "zero");
    const exported = { alimentos: [zero] };
    assert.equal(validData(exported), true);
    mergeIn(exported);
    assert.ok(profile.customFoods.some(f => f.id === zero.id));

    // Importar a lista pelo seletor não pode pedir gravação nem trocar o diário conectado.
    let permissionRequested = false;
    const previous = { name: "diario-existente.json" };
    fileHandle = previous;
    window.showOpenFilePicker = async () => [{
      name: "alimentos.json",
      getFile: async () => ({ text: async () => JSON.stringify(exported) }),
      requestPermission: async () => { permissionRequested = true; return "granted"; }
    }];
    persist = renderProfile = renderAll = toast = () => {};
    await openFile();
    assert.equal(permissionRequested, false);
    assert.equal(fileHandle, previous);
  })()`, context);
  console.log("OK: scripts, HTML, cache, busca, nutrientes, migração, persistência e importação.");
})().catch(error => { console.error(error); process.exitCode = 1; });
