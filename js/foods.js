/* ==========================================================
   Base de alimentos
   - Seus: alimentos cadastrados por você, salvos no mesmo formato
     (schema) de data/alimentos_unificados.json
   - Comuns: lista curta do app, com nomes simples (js/data.js)
   - Base completa: data/alimentos-base.js (TACO + USDA + comunidade),
     carregada logo depois que a tela aparece
   ========================================================== */

const FONTE_ORDEM = { usuario: 0, comunidade: 1, app: 2, taco: 3, usda_fndds: 4, usda_sr_legacy: 5 };
const FONTE_ROTULO = { usuario: "Seu", comunidade: "Comunidade", app: "Comum", taco: "TACO", usda_fndds: "USDA", usda_sr_legacy: "USDA" };
const FONTE_NOME = {
  usuario: "Cadastrado por você",
  comunidade: "Cadastrado por usuários do Diário de Calorias",
  app: "Lista do app (Tabela TACO e rótulos médios)"
};
const MIN_BUSCA = 2;          // letras mínimas para buscar
const SIN_CHAVES = Object.keys(SINONIMOS).map(k => [norm(k), SINONIMOS[k]]);

let baseFoods = [];
let baseState = "idle";       // idle | loading | ok | error

const emptyNut = () => NUTRIENTES.map(() => null);
const isNum = v => typeof v === "number" && isFinite(v);

// representação interna, igual para todas as fontes
function makeFood(id, nome, src, nut, porcoes) {
  return { id, n: nome, src, nut, porcoes: porcoes || [], s: norm(nome).replace(/\s+/g, " ") };
}

const APP_FOODS = FOODS.map((f, i) => {
  const nut = emptyNut();
  nut[N.kcal] = f[1]; nut[N.carb] = f[2]; nut[N.prot] = f[3];
  return makeFood("app:" + i, f[0], "app", nut);
});

/* ---------- Alimentos cadastrados (schema da base) ---------- */

function nutFromSchema(obj) {
  return NUTRIENTES.map(x => (obj && isNum(obj[x.k])) ? obj[x.k] : null);
}

function legacyId(nome) {
  return "usuario:" + (norm(nome).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "alimento");
}

// cria um alimento no mesmo formato de data/alimentos_unificados.json
function buildCustomFood({ id, nome, kcal, carb = null, prot = null, gord = null, criado_em }) {
  const nut = {};
  NUTRIENTES.forEach(x => { nut[x.k] = null; });
  nut.calorias_kcal = kcal;
  nut.carboidratos_g = carb;
  nut.proteinas_g = prot;
  nut.gorduras_totais_g = gord;
  return {
    id: id || "usuario:" + uid(),
    fonte_id: "usuario",
    codigo_fonte: null,
    nome,
    idioma: "pt-BR",
    categoria: null,
    preparo: null,
    base_g: 100,
    nutrientes_por_100g: nut,
    porcoes: [],
    observacoes: [],
    macros_completos: carb != null && prot != null && gord != null,
    url_fonte: null,
    criado_em: criado_em || new Date().toISOString()
  };
}

// aceita o formato atual e o da versão 1.0 ({n, k, c, p}); devolve null se inválido
function normalizeCustomFood(f) {
  if (!f || typeof f !== "object") return null;
  if (typeof f.nome === "string" && f.nutrientes_por_100g && typeof f.nutrientes_por_100g === "object") {
    const nome = f.nome.trim();
    if (!nome) return null;
    const nut = {};
    NUTRIENTES.forEach(x => { const v = f.nutrientes_por_100g[x.k]; nut[x.k] = isNum(v) ? v : null; });
    if (nut.calorias_kcal == null) return null;
    return Object.assign(buildCustomFood({ nome, kcal: nut.calorias_kcal }), f, {
      id: (typeof f.id === "string" && /^usuario:[\w-]+$/.test(f.id)) ? f.id : legacyId(nome),
      fonte_id: "usuario",
      nome,
      nutrientes_por_100g: nut,
      porcoes: Array.isArray(f.porcoes) ? f.porcoes.filter(p => p && typeof p.descricao === "string" && isNum(p.peso_g) && p.peso_g > 0) : [],
      observacoes: Array.isArray(f.observacoes) ? f.observacoes : []
    });
  }
  if (typeof f.n === "string" && f.n.trim() && isNum(f.k)) {
    return buildCustomFood({
      id: legacyId(f.n), nome: f.n.trim(), kcal: f.k,
      carb: isNum(f.c) ? f.c : null, prot: isNum(f.p) ? f.p : null, criado_em: null
    });
  }
  return null;
}

// limpa a lista e tira repetidos pelo nome (fica o primeiro)
function cleanCustomFoods(list) {
  const out = [], seen = new Set();
  (Array.isArray(list) ? list : []).forEach(f => {
    const c = normalizeCustomFood(f);
    if (!c) return;
    const k = norm(c.nome);
    if (seen.has(k)) return;
    seen.add(k);
    out.push(c);
  });
  return out;
}

function customToFood(c) {
  return makeFood(c.id, c.nome, "usuario", nutFromSchema(c.nutrientes_por_100g),
    (c.porcoes || []).map(p => [p.descricao, p.peso_g]));
}

/* ---------- Base completa (carregada depois) ---------- */

function applyBase(b) {
  if (!b || !Array.isArray(b.itens) || !Array.isArray(b.fontes)) throw new Error("base de alimentos inválida");
  if ((b.nutrientes || []).join() !== NUTRIENTES.map(x => x.k).join()) throw new Error("ordem dos nutrientes diferente da esperada");
  const fontes = b.fontes.map(f => f.id === "usuario" ? "comunidade" : f.id);
  b.fontes.forEach((f, i) => { if (!FONTE_NOME[fontes[i]]) FONTE_NOME[fontes[i]] = f.nome; });
  baseFoods = b.itens.map(it => makeFood(it[0], it[1], fontes[it[2]], it[3], it[4]));
}

function loadFoodBase() {
  if (baseState !== "idle") return;
  baseState = "loading";
  const s = document.createElement("script");
  s.src = "data/alimentos-base.js";
  s.async = true;
  s.onload = () => {
    try { applyBase(self.ALIMENTOS_BASE); baseState = "ok"; }
    catch (e) { console.error(e); baseState = "error"; }
    try { delete self.ALIMENTOS_BASE; } catch (_) { self.ALIMENTOS_BASE = undefined; }
    onFoodBaseChange();
  };
  s.onerror = () => { baseState = "error"; onFoodBaseChange(); };
  document.head.appendChild(s);
}

/* ---------- Lista completa e busca ---------- */

let _all = { ref: null, base: null, list: [] };
function allFoods() {
  if (_all.ref !== profile.customFoods || _all.base !== baseFoods) {
    const inBase = new Set();
    baseFoods.forEach(f => { if (f.src === "comunidade") inBase.add(f.id); });
    const mine = (profile.customFoods || []).filter(c => !inBase.has(c.id)).map(customToFood);
    _all = { ref: profile.customFoods, base: baseFoods, list: mine.concat(APP_FOODS, baseFoods) };
  }
  return _all.list;
}

// palavra digitada + traduções (só a partir de 3 letras): "fran" → frango → chicken
function expandWord(w) {
  const alts = [w];
  if (w.length >= 3) SIN_CHAVES.forEach(([k, tr]) => { if (k.startsWith(w)) alts.push(...tr); });
  return alts;
}

function rankFood(f, qn, firstAlts) {
  let r = (FONTE_ORDEM[f.src] ?? 9) * 10000;
  if (f.s === qn) r -= 5000;
  else if (f.s.startsWith(qn)) r -= 3000;
  else if (firstAlts.some(a => f.s.startsWith(a))) r -= 2000;
  return r + Math.min(f.s.length, 999);
}

let _search = { key: null, list: null, hits: [] };
// todos os alimentos que têm cada palavra digitada (ou uma tradução), do mais relevante ao menos
function searchFoods(q) {
  const qn = norm(q).replace(/\s+/g, " ");
  if (qn.length < MIN_BUSCA) return [];
  const all = allFoods();
  if (_search.key === qn && _search.list === all) return _search.hits;
  const alts = qn.split(" ").map(expandWord);
  const hits = all.filter(f => alts.every(a => a.some(x => f.s.includes(x))));
  const scored = hits.map(f => [rankFood(f, qn, alts[0]), f]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
  _search = { key: qn, list: all, hits: scored };
  return scored;
}

/* ---------- Cálculos ---------- */

// nutrientes para uma quantidade em gramas (null continua null: "sem dado")
function nutFor(food, g) {
  return food.nut.map(v => v == null ? null : v * g / 100);
}

/* ---------- Exportar ---------- */

function exportCustomFoods() {
  const list = profile.customFoods || [];
  if (!list.length) { toast("Você ainda não cadastrou nenhum alimento."); return; }
  saveJsonFile(`alimentos-usuario-${TODAY}.json`, {
    versao_schema: "1.0.0",
    descricao: "Alimentos cadastrados no Diário de Calorias, no formato de data/alimentos_unificados.json. Para incluir na base do app: perl tools/mesclar-alimentos.pl <este-arquivo>",
    exportado_em: new Date().toISOString(),
    total_alimentos: list.length,
    alimentos: list
  }, `${list.length} alimento(s) exportado(s).`);
}
