/* ==========================================================
   Base de alimentos
   - Seus: alimentos cadastrados por você, salvos no mesmo formato
     (schema) de data/alimentos_unificados.json
   - Comuns: lista curta do app, com nomes simples (js/data.js); os que
     têm id da TACO recebem os 12 nutrientes quando a base carrega
   - Base completa: data/alimentos-base.js (TACO + USDA + comunidade),
     carregada logo depois que a tela aparece
   ========================================================== */

// ordem nos resultados: oficiais antes da comunidade (que não passa por revisão técnica)
const FONTE_ORDEM = { usuario: 0, app: 1, taco: 2, usda_fndds: 3, usda_sr_legacy: 4, comunidade: 5 };
const FONTE_ROTULO = { usuario: "Seu", comunidade: "Comunidade", app: "Comum", taco: "TACO", usda_fndds: "USDA", usda_sr_legacy: "USDA" };
const FONTE_NOME = {
  usuario: "Cadastrado por você",
  comunidade: "Cadastrado por usuários do Diário de Calorias (sem revisão técnica)",
  app: "Lista do app (Tabela TACO e rótulos médios)"
};
const MIN_BUSCA = 2;          // letras mínimas para buscar
const LIGACAO = new Set(PALAVRAS_LIGACAO);

let baseFoods = [];
let baseState = "idle";       // idle | loading | ok | error

const emptyNut = () => NUTRIENTES.map(() => null);

// texto para busca: sem acento, minúsculo, só letras e números, um espaço entre
// as palavras e um espaço em cada ponta (" arroz tipo 1 cozido ")
const searchText = s => " " + norm(s).replace(/[^a-z0-9]+/g, " ").trim() + " ";

// representação interna, igual para todas as fontes
function makeFood(id, nome, src, nut, porcoes, ref) {
  return { id, n: nome, src, nut, porcoes: porcoes || [], ref: ref || null, w: searchText(nome) };
}

const APP_FOODS = FOODS.map((f, i) => {
  const nut = emptyNut();
  nut[NUT.kcal] = f[1]; nut[NUT.carb] = f[2]; nut[NUT.prot] = f[3];
  return makeFood("app:" + i, f[0], "app", nut, [], f[4]);
});

const SIN_CHAVES = Object.keys(SINONIMOS).map(k => [searchText(k).trim(), SINONIMOS[k].map(t => searchText(t).trim())]);

/* ---------- Alimentos cadastrados (schema da base) ---------- */

function nutFromSchema(obj) {
  return NUTRIENTES.map(x => (obj && isNum(obj[x.k])) ? obj[x.k] : null);
}

const slug = s => norm(s).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "alimento";
const ID_USUARIO = /^usuario:[A-Za-z0-9_-]+$/;

// id estável para itens sem id (ex.: migrados da v1.0): nome + valores.
// Dois usuários com o mesmo nome e valores diferentes nunca recebem o mesmo id.
function stableId(nome, nut) {
  const vals = ["calorias_kcal", "carboidratos_g", "proteinas_g", "gorduras_totais_g"].map(k => nut[k]);
  return "usuario:" + slug(nome) + "-" + hash36(JSON.stringify([norm(nome)].concat(vals)));
}

// cria um alimento no mesmo formato de data/alimentos_unificados.json (mesmas chaves)
function buildCustomFood({ id, nome, kcal, carb = null, prot = null, gord = null }) {
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
    url_fonte: null
  };
}

const strOrNull = v => (typeof v === "string" && v.trim()) ? v.trim() : null;

// Aceita o formato atual e o da versão 1.0 ({n, k, c, p}). Copia só os campos do
// schema (nada de campos estranhos de um arquivo importado). Devolve null se inválido.
function normalizeCustomFood(f) {
  if (!f || typeof f !== "object") return null;
  if (typeof f.nome === "string" && f.nutrientes_por_100g && typeof f.nutrientes_por_100g === "object") {
    const nome = f.nome.trim().replace(/\s+/g, " ");
    if (!nome) return null;
    const nut = {};
    NUTRIENTES.forEach(x => {
      const v = f.nutrientes_por_100g[x.k];
      nut[x.k] = isNum(v) && v >= 0 ? v : null;
    });
    if (nut.calorias_kcal == null) return null;
    const c = buildCustomFood({
      id: (typeof f.id === "string" && ID_USUARIO.test(f.id)) ? f.id : stableId(nome, nut),
      nome, kcal: nut.calorias_kcal
    });
    c.nutrientes_por_100g = nut;
    c.macros_completos = nut.carboidratos_g != null && nut.proteinas_g != null && nut.gorduras_totais_g != null;
    c.idioma = strOrNull(f.idioma) || "pt-BR";
    c.categoria = strOrNull(f.categoria);
    c.preparo = strOrNull(f.preparo);
    c.porcoes = (Array.isArray(f.porcoes) ? f.porcoes : [])
      .filter(p => p && typeof p.descricao === "string" && p.descricao.trim() && isNum(p.peso_g) && p.peso_g > 0)
      .map(p => ({ descricao: p.descricao.trim(), peso_g: p.peso_g, idioma: strOrNull(p.idioma) || c.idioma }));
    return c;
  }
  if (typeof f.n === "string" && f.n.trim() && isNum(f.k) && f.k >= 0) {
    // v1.0 gravava campo em branco como 0: carboidrato/proteína 0 vira "sem dado"
    const nome = f.n.trim().replace(/\s+/g, " ");
    const carb = isNum(f.c) && f.c > 0 ? f.c : null;
    const prot = isNum(f.p) && f.p > 0 ? f.p : null;
    const c = buildCustomFood({ nome, kcal: f.k, carb, prot });
    c.id = stableId(nome, c.nutrientes_por_100g);
    return c;
  }
  return null;
}

// limpa a lista e tira repetidos pelo id e pelo nome (fica o primeiro)
function cleanCustomFoods(list) {
  const out = [], ids = new Set(), nomes = new Set();
  (Array.isArray(list) ? list : []).forEach(f => {
    const c = normalizeCustomFood(f);
    if (!c) return;
    const k = norm(c.nome);
    if (ids.has(c.id) || nomes.has(k)) return;
    ids.add(c.id);
    nomes.add(k);
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
  if (b.itens.length !== b.total) throw new Error("base de alimentos incompleta");
  if ((b.nutrientes || []).join() !== NUTRIENTES.map(x => x.k).join()) throw new Error("ordem dos nutrientes diferente da esperada");
  const fontes = b.fontes.map(f => f.id === "usuario" ? "comunidade" : f.id);
  b.fontes.forEach((f, i) => { if (!FONTE_NOME[fontes[i]]) FONTE_NOME[fontes[i]] = f.nome; });
  const list = b.itens.map(it => makeFood(it[0], it[1], fontes[it[2]], it[3], it[4]));

  // lista "Comum" ligada à TACO: mantém o nome simples e passa a ter os 12 nutrientes
  const byId = new Map();
  list.forEach(f => { if (f.src === "taco") byId.set(f.id, f); });
  APP_FOODS.forEach(a => {
    const t = a.ref && byId.get(a.ref);
    if (t) a.nut = t.nut.map((v, i) => v != null ? v : a.nut[i]);
  });
  baseFoods = list;
}

// carrega data/alimentos-base.js com <script> (funciona também abrindo o index.html direto, file://)
function loadFoodBase(onChange) {
  if (baseState !== "idle") return;
  baseState = "loading";
  const s = document.createElement("script");
  s.src = "data/alimentos-base.js";
  s.async = true;
  const done = ok => {
    if (ok) {
      try { applyBase(self.ALIMENTOS_BASE); } catch (e) { console.error(e); ok = false; }
    }
    try { delete self.ALIMENTOS_BASE; } catch (_) { self.ALIMENTOS_BASE = undefined; }
    baseState = ok ? "ok" : "error";
    if (onChange) onChange();
  };
  s.onload = () => done(true);
  s.onerror = () => done(false);
  document.head.appendChild(s);
}

/* ---------- Lista completa e busca ---------- */

let _all = { ref: null, base: null, list: [] };
function allFoods() {
  if (_all.ref !== profile.customFoods || _all.base !== baseFoods) {
    const mine = (profile.customFoods || []).map(customToFood);
    const myIds = new Set(mine.map(f => f.id));
    // o seu alimento sempre aparece; o da comunidade com o mesmo id (que veio dele) sai
    const base = myIds.size ? baseFoods.filter(f => f.src !== "comunidade" || !myIds.has(f.id)) : baseFoods;
    _all = { ref: profile.customFoods, base: baseFoods, list: mine.concat(APP_FOODS, base) };
  }
  return _all.list;
}

// palavras da busca, sem palavras de ligação ("arroz com feijão" → arroz, feijao)
function queryWords(q) {
  const words = searchText(q).trim().split(" ").filter(Boolean);
  const main = words.filter(w => !LIGACAO.has(w));
  return main.length ? main : words;
}

// traduções pt → en da palavra: pela chave exata, ou por prefixo a partir de 4 letras ("fran" → chicken)
function translations(w) {
  const out = [];
  SIN_CHAVES.forEach(([k, tr]) => { if (k === w || (w.length >= 4 && k.startsWith(w))) out.push(...tr); });
  return out;
}

// 2 = palavra inteira (digitada ou traduzida), 1 = início de palavra, 0 = não casa
function wordMatch(f, w, trs) {
  if (f.w.includes(" " + w + " ")) return 2;
  for (const t of trs) {
    if (f.w.includes(" " + t + " ") || f.w.includes(" " + t + "s ") || f.w.includes(" " + t + "es ")) return 2;
  }
  return f.w.includes(" " + w) ? 1 : 0;
}

// menor = melhor: 1º todas as palavras inteiras; depois a fonte; depois nome igual/começando igual; depois o mais curto
function rankFood(f, key, whole) {
  let r = (whole ? 0 : 1e6) + (FONTE_ORDEM[f.src] ?? 9) * 1e5;
  if (f.w === " " + key + " ") r -= 5e4;
  else if (f.w.startsWith(" " + key)) r -= 3e4;
  return r + Math.min(f.w.length, 999);
}

let _search = { key: null, list: null, hits: [] };
// alimentos que têm todas as palavras da busca (ou traduções), do mais relevante ao menos
function searchFoods(q) {
  const words = queryWords(q);
  const key = words.join(" ");
  if (key.replace(/ /g, "").length < MIN_BUSCA) return [];
  const all = allFoods();
  if (_search.key === key && _search.list === all) return _search.hits;
  const trs = words.map(translations);
  const scored = [];
  for (const f of all) {
    let whole = true, ok = true;
    for (let i = 0; i < words.length; i++) {
      const m = wordMatch(f, words[i], trs[i]);
      if (!m) { ok = false; break; }
      if (m === 1) whole = false;
    }
    if (ok) scored.push([rankFood(f, key, whole), f]);
  }
  scored.sort((a, b) => a[0] - b[0]);
  _search = { key, list: all, hits: scored.map(x => x[1]) };
  return _search.hits;
}

// nome digitado igual ao de um alimento (sem acento, maiúsculas e pontuação)
function findByName(nome) {
  const t = searchText(nome);
  return t.trim() ? allFoods().find(f => f.w === t) || null : null;
}

/* ---------- Cálculos ---------- */

// nutrientes para uma quantidade em gramas (null continua null: "sem dado")
function nutFor(food, g) {
  return food.nut.map(v => v == null ? null : v * g / 100);
}

// nome da fonte para mostrar ao usuário
function fonteDe(f) {
  return (f.ref && baseState === "ok" && FONTE_NOME.taco) ? FONTE_NOME.taco + " (lista do app)" : (FONTE_NOME[f.src] || f.src);
}
