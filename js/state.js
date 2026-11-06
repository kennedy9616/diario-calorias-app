/* ==========================================================
   Estado do app e cálculos de gasto calórico
   ========================================================== */

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

// alimentos da tabela + os cadastrados pelo usuário
function allFoods() {
  return FOODS.map(f => ({ n: f[0], k: f[1], c: f[2], p: f[3] }))
    .concat((profile.customFoods || []).filter(f => f && f.n).map(f => ({ ...f, custom: true })));
}

// Hoje usa sempre o perfil atual; dias passados guardam o gasto da época.
function dayTdee(k) {
  const d = days[k];
  return (k === TODAY || !d || d.tdee == null) ? tdee() : d.tdee;
}

function totals(k = cur) {
  const d = day(k);
  const cons = d.foods.reduce((s, f) => s + (f.kcal || 0), 0);
  const ex = d.ex.reduce((s, e) => s + (e.kcal || 0), 0);
  const carb = d.foods.reduce((s, f) => s + (f.carb || 0), 0);
  const prot = d.foods.reduce((s, f) => s + (f.prot || 0), 0);
  const base = dayTdee(k);
  return { cons, ex, carb, prot, base, gasto: base + ex, has: d.foods.length > 0 };
}
