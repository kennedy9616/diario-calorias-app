/* ==========================================================
   Estado do app e cálculos de gasto calórico
   ========================================================== */

const APP_VERSION = "1.1.1";
const TODAY = keyOf(new Date());

// valores iniciais para quem abre o app pela primeira vez
const DEFAULT_PROFILE = { peso: 70, altura: 170, idade: 30, sexo: "M", fator: 1.2, meta: null, customFoods: [] };

let profile = clone(DEFAULT_PROFILE);
let days = {};            // "AAAA-MM-DD" -> { foods: [], ex: [], tdee }
let savedAt = null;       // quando os dados foram alterados pela última vez
let cur = TODAY;          // dia mostrado na tela
let selFood = null;       // alimento escolhido na lista de sugestões
let ready = false;        // true depois de carregar os dados salvos

// Taxa metabólica basal — equação de Mifflin-St Jeor
function tmb(p = profile) {
  return 10 * p.peso + 6.25 * p.altura - 5 * p.idade + (p.sexo === "F" ? -161 : 5);
}
// Gasto diário sem exercícios (TMB × fator de atividade da rotina)
function tdee(p = profile) {
  return tmb(p) * Number(p.fator || 1.2);
}

function day(k = cur) {
  return days[k] || { foods: [], ex: [] };
}

// Hoje usa sempre o perfil atual; dias passados guardam o gasto da época.
function dayTdee(k) {
  const d = days[k];
  return (k === TODAY || !d || d.tdee == null) ? tdee() : d.tdee;
}

// Soma do dia. Nutriente sem dado (null, ou registro antigo sem o campo) não entra na
// soma e é contado em falta[nutriente]: a tela mostra "≥" (soma parcial) ou "—" (nenhum dado).
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
    ex, base, gasto: base + ex, has: d.foods.length > 0, n: d.foods.length, falta
  };
}
