// Persistência: migração dos dados salvos, recuperação de leitura e falhas de gravação.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadApp } = require("./helpers.cjs");

const LSKEY = "diario-calorias:v1";
const hoje = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

// dados como a versão 1.2.0 gravava (versao 4): sem preferências, sem nome, objetivo só perder/manter
function dadosV4() {
  return {
    app: "diario-calorias", versao: 4, savedAt: "2026-11-05T10:00:00.000Z",
    profile: { peso: 82, altura: 178, idade: 41, nascimento: "", sexo: "M", fator: 1.3, meta: null, condicoes: [], objetivo: "perder",
      treino: { tipo: "forca", dias: 3, min: 50, intensidade: "moderada" }, customFoods: [] },
    days: { [hoje()]: { foods: [{ id: "f1", name: "Arroz", g: 150, unit: "g", kcal: 192, meal: "Almoço", t: 1 }], ex: [],
      agua: [{ id: "a1", ml: 300, tipo: "agua", t: Date.now() }], tdee: 2400, tmb: 1800 } },
    medidas: [{ id: "m1", data: hoje(), t: 1, peso_kg: 81.5, cintura_cm: null, quadril_cm: null, braco_cm: null, coxa_cm: null, gordura_pct: null }],
    metas: [{ id: "k1", tipo: "kcal", valor: 2100, unidade: "kcal/dia", origem: "manual", metodo: "x", vigencia_inicio: "2026-10-01", vigencia_fim: null }]
  };
}

test("dados da versão 1.2.0 (versao 4) abrem sem perda e ganham as preferências padrão", () => {
  const storage = new Map([[LSKEY, JSON.stringify(dadosV4())]]);
  const a = loadApp({ storage });
  assert.equal(a.run("loadSaved()"), true);
  assert.equal(a.run("profile.peso"), 82, "peso do cadastro antigo vira o peso informado (sem data)");
  assert.equal(a.run("profile.nome"), "");
  assert.equal(a.run("profile.objetivo"), "perder");
  assert.equal(a.run("prefs.copo_ml"), 250);
  assert.equal(a.run("days[TODAY].foods.length"), 1);
  assert.equal(a.run("aguaDia(TODAY).total_ml"), 300);
  assert.equal(a.run("medidas.length"), 1);
  assert.equal(a.run("pesoAtual().peso"), 81.5, "a pesagem com data vale mais que o cadastro");
  assert.equal(a.run('metaVigente("kcal", TODAY).valor'), 2100);
  a.run("persist()");
  const salvo = JSON.parse(storage.get(LSKEY));
  assert.equal(salvo.versao, 5);
  assert.equal(salvo.preferencias.copo_ml, 250);
  assert.equal(salvo.days[hoje()].foods[0].id, "f1");
});

test("valores estranhos do perfil e das preferências viram padrão ou null, nunca NaN", () => {
  const d = dadosV4();
  Object.assign(d.profile, { peso: "abc", altura: null, idade: NaN, sexo: "X", fator: 9, objetivo: "outro", nome: 42 });
  d.preferencias = { copo_ml: -3, copo_tipo: "suco", periodo: "1000d", periodo_ini: "ontem" };
  const a = loadApp({ storage: new Map([[LSKEY, JSON.stringify(d)]]) });
  a.run("loadSaved()");
  assert.deepEqual([...a.run("[profile.peso, profile.altura, profile.idade, profile.sexo, profile.fator, profile.objetivo, profile.nome]")],
    [null, null, null, "", 1.2, "manter", ""]);
  assert.deepEqual({ ...a.run("prefs") }, { copo_ml: 250, copo_tipo: "agua", periodo: "7d", periodo_ini: "", periodo_fim: "" });
  assert.equal(a.run("tmb()"), null);
});

test("dados ilegíveis não são apagados: o app guarda uma cópia antes de gravar qualquer coisa", () => {
  const storage = new Map([[LSKEY, '{"profile": {"peso": 80'], ["outra", "x"]]);
  const a = loadApp({ storage });
  assert.equal(a.run("loadSaved()"), true, "não trata como primeira visita");
  const copias = [...storage.keys()].filter(k => k.startsWith(LSKEY + ":ilegivel:"));
  assert.equal(copias.length, 1);
  assert.equal(storage.get(copias[0]), '{"profile": {"peso": 80');
  a.run('addAgua(200, "agua")');
  assert.equal(storage.get(copias[0]), '{"profile": {"peso": 80', "a cópia continua lá depois de gravar");
});

test("sem espaço para a cópia, o app não grava por cima dos dados ilegíveis e avisa", () => {
  const storage = new Map([[LSKEY, "lixo"]]);
  const a = loadApp({ storage });
  a.quebrar(true);
  a.run("loadSaved()");
  a.quebrar(false);
  assert.equal(a.run("lerBloqueado"), true);
  assert.equal(a.run("persist()"), false);
  assert.equal(storage.get(LSKEY), "lixo", "original intacto");
  a.run("setStatus()");
  assert.match(a.el("status").textContent, /Dados não lidos/);
});

test("falha ao gravar (cota cheia) é avisada no status e na resposta do registro", () => {
  const a = loadApp();
  a.run("days = {}; metas = []; renderAll = () => {}");
  a.quebrar(true);
  const r = a.run('addAgua(250, "agua")');
  assert.equal(r.ok, true);
  assert.equal(r.salvo, false);
  assert.match(a.el("status").textContent, /Erro ao salvar/);
  assert.match(a.el("toast").textContent, /Não consegui salvar/);
  a.quebrar(false);
  a.run("persist()");
  assert.equal(a.run("saveError"), null);
  assert.doesNotMatch(a.el("status").textContent, /Erro/);
});

test("recarregar restaura perfil, preferências, água, alimentos, medidas e metas", () => {
  const storage = new Map();
  const a = loadApp({ storage });
  a.run(`profile = Object.assign(clone(DEFAULT_PROFILE), { nome: "Bia", altura: 160, idade: 28, sexo: "F" });
    days = {}; medidas = []; metas = [];
    definirCopo(200); prefs.periodo = "30d"; registrarCopo();
    days[TODAY].foods.push({ id: "f", name: "Pão", g: 50, unit: "g", kcal: 150, meal: "Ceia", t: 1 });
    addMedida({ data: TODAY, peso_kg: 58.4 });
    definirMeta(estimarMetaAgua().meta); persist();`);
  const b = loadApp({ storage });
  assert.equal(b.run("loadSaved()"), true);
  assert.equal(b.run("profile.nome"), "Bia");
  assert.equal(b.run("prefs.copo_ml"), 200);
  assert.equal(b.run("prefs.periodo"), "30d");
  assert.equal(b.run("aguaDia(TODAY).total_ml"), 200);
  assert.equal(b.run("days[TODAY].foods[0].kcal"), 150);
  assert.equal(b.run("pesoAtual().peso"), 58.4);
  assert.equal(b.run('metaVigente("agua", TODAY).origem'), "estimada");
  assert.equal(b.run('metaVigente("agua", TODAY).valor'), 1600);
});

test("abrir um backup junta os dados sem trocar as preferências que já foram escolhidas", () => {
  const a = loadApp();
  a.run("days = {}; definirCopo(500)");
  a.run(`mergeIn({ preferencias: { copo_ml: 150 }, days: {} })`);
  assert.equal(a.run("prefs.copo_ml"), 500);
  const b = loadApp();
  b.run(`mergeIn({ preferencias: { copo_ml: 150 }, days: {} })`);
  assert.equal(b.run("prefs.copo_ml"), 150, "app no padrão adota as do arquivo");
});
