/* ==========================================================
   Estado do app e cálculos de gasto calórico
   ========================================================== */

const APP_VERSION = "1.2.0";
// Dia de hoje pela data local do aparelho. Muda à meia-noite com o app aberto (atualizarHoje).
let TODAY = keyOf(new Date());

// Perfil de quem abre o app pela primeira vez: sem números inventados.
// Peso, altura, idade e sexo ficam vazios até a pessoa preencher o Perfil;
// sem eles o app não estima gasto nem metas (mostra "—" e pede os dados).
const DEFAULT_PROFILE = { nome: "", peso: null, altura: null, idade: null, nascimento: "", sexo: "", fator: 1.2, meta: null, condicoes: [], objetivo: "manter",
  treino: { tipo: "nenhum", dias: 0, min: 0, intensidade: "moderada" }, customFoods: [] };

// Preferências de uso (não são dados corporais)
const COPO_OPCOES = [150, 200, 250, 300, 500];
const COPO_FAIXA = [50, 1000];   // ml por toque no copo
const DEFAULT_PREFS = { copo_ml: 250, copo_tipo: "agua", periodo: "7d", periodo_ini: "", periodo_fim: "" };

let profile = clone(DEFAULT_PROFILE);
let prefs = clone(DEFAULT_PREFS);
let days = {};            // "AAAA-MM-DD" -> { foods: [], ex: [], agua: [], completo, tdee, tmb, pesoRef, pesoMetodo }
let medidas = [];        // histórico de peso e medidas corporais (js/body.js)
let metas = [];          // metas versionadas: kcal, proteína, água (js/metas.js)
let savedAt = null;       // quando os dados foram alterados pela última vez
let cur = TODAY;          // dia mostrado na tela
let selFood = null;       // alimento escolhido na lista de sugestões
let ready = false;        // true depois de carregar os dados salvos

// Faixas aceitas nos dados usados pelas fórmulas
const FAIXA_PESO = [20, 400];      // kg
const FAIXA_ALTURA = [100, 250];   // cm
const FAIXA_IDADE = [1, 129];      // anos

const naFaixa = (v, [a, b]) => isNum(v) && v >= a && v <= b;

// A fórmula só roda com peso, altura, idade e sexo válidos; senão devolve null (nunca NaN).
function dadosCalculoOk(p) {
  return !!p && naFaixa(p.peso, FAIXA_PESO) && naFaixa(p.altura, FAIXA_ALTURA) && naFaixa(p.idade, FAIXA_IDADE) && (p.sexo === "M" || p.sexo === "F");
}
// o que falta no Perfil para os cálculos
function dadosFaltando(p = perfilCalculo()) {
  const f = [];
  if (!naFaixa(p.peso, FAIXA_PESO)) f.push("peso");
  if (!naFaixa(p.altura, FAIXA_ALTURA)) f.push("altura");
  if (!naFaixa(p.idade, FAIXA_IDADE)) f.push("idade ou data de nascimento");
  if (p.sexo !== "M" && p.sexo !== "F") f.push("sexo (coeficiente da equação)");
  return f;
}

// Taxa metabólica basal (repouso) — equação de Mifflin-St Jeor.
// Sem argumento: peso de referência e idade de hoje (js/body.js). Dados incompletos → null.
function tmb(p = perfilCalculo()) {
  if (!dadosCalculoOk(p)) return null;
  return 10 * p.peso + 6.25 * p.altura - 5 * p.idade + (p.sexo === "F" ? -161 : 5);
}
// Gasto diário sem exercícios (TMB × fator de atividade da rotina)
function tdee(p = perfilCalculo()) {
  const b = tmb(p);
  return b == null ? null : b * Number(p.fator || 1.2);
}

function day(k = cur) {
  return days[k] || { foods: [], ex: [] };
}

// Hoje usa sempre o perfil atual; dias passados guardam o gasto da época
// (sem registro guardado, calcula com o peso e a idade daquele dia).
function dayTdee(k) {
  const d = days[k];
  if (k !== TODAY && d && isNum(d.tdee)) return d.tdee;
  return tdee(perfilCalculo(k));
}
function dayTmb(k) {
  const d = days[k];
  if (k !== TODAY && d && isNum(d.tmb)) return d.tmb;
  return tmb(perfilCalculo(k));
}

// Soma do dia. Nutriente sem dado (null, ou registro antigo sem o campo) não entra na
// soma e é contado em falta[nutriente]: a tela mostra "≥" (soma parcial) ou "—" (nenhum dado).
// Convenção: gasto = basal × rotina + exercícios (só o gasto extra); saldo = consumo − gasto.
function totals(k = cur) {
  const d = day(k);
  const falta = {};
  const sum = (list, key) => list.reduce((s, x) => {
    if (isNum(x[key])) return s + x[key];
    falta[key] = (falta[key] || 0) + 1;
    return s;
  }, 0);
  const ex = d.ex.reduce((s, e) => s + (e.kcal || 0), 0);
  const base = dayTdee(k);
  return {
    cons: d.foods.reduce((s, f) => s + (f.kcal || 0), 0),
    carb: sum(d.foods, "carb"),
    prot: sum(d.foods, "prot"),
    gord: sum(d.foods, "gord"),
    fibra: sum(d.foods, "fibra"),
    sodio: sum(d.foods, "sodio"),
    acucar: sum(d.foods, "acucar"),
    gsat: sum(d.foods, "gsat"),
    colest: sum(d.foods, "colest"),
    calcio: sum(d.foods, "calcio"),
    ferro: sum(d.foods, "ferro"),
    potassio: sum(d.foods, "potassio"),
    ex, base, gasto: base == null ? null : base + ex, has: d.foods.length > 0, n: d.foods.length, falta
  };
}

// Virada do dia com o app aberto: hoje passa a ser a nova data; quem estava vendo "hoje"
// passa para o novo dia. O histórico fica onde está. Devolve true se o dia mudou.
function atualizarHoje(agora = new Date()) {
  const k = keyOf(agora);
  if (k === TODAY) return false;
  const viaHoje = cur === TODAY;
  TODAY = k;
  if (viaHoje || cur > TODAY) cur = TODAY;
  return true;
}
