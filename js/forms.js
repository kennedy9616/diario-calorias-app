/* ==========================================================
   Formulários: alimentos, exercícios e dados pessoais
   ========================================================== */

/* ---------- Alimentos ---------- */

// ml conta como g (densidade ~1): aproximação, como no rótulo da maioria das bebidas
const UNIDADES = '<option value="g">g</option><option value="kg">kg</option><option value="ml">ml (≈ g)</option>';
const MAX_SUGG = 20;          // sugestões mostradas de cada vez

// número digitado (aceita vírgula); vazio ou inválido → null
function numIn(id) {
  const v = parseNumBR($(id).value);
  return isNum(v) ? v : null;
}

// nutriente formatado; null = sem dado na fonte
function fmtNut(v, unit) {
  if (v == null) return "—";
  return (unit !== "kcal" && v < 10 ? fmt1(v) : fmt(v)) + " " + unit;
}

// quantidade informada, sempre em gramas (ml conta como g; porção usa o peso dela)
function grams(f = currentFood()) {
  const q = numIn("qty");
  if (!(q > 0)) return 0;
  const u = $("unit").value;
  if (u === "kg") return q * 1000;
  if (u.startsWith("p")) {
    const p = f && f.porcoes[Number(u.slice(1))];
    return p ? q * p[1] : 0;
  }
  return q;
}

function currentFood() {
  if (selFood) return selFood;
  const nome = $("foodName").value;
  if (!norm(nome)) return null;
  const exact = findByName(nome);
  if (exact) return exact;
  const hits = searchFoods(nome);
  return hits.length === 1 ? hits[0] : null;
}

// unidades: g, kg, ml e as porções caseiras do alimento escolhido (quando a fonte tem)
function setUnitOptions(f) {
  const sel = $("unit");
  const key = f && f.porcoes.length ? f.id : "";
  if (sel.dataset.food === key) return;
  const prev = sel.value;
  sel.dataset.food = key;
  sel.innerHTML = UNIDADES;
  if (key) {
    const og = document.createElement("optgroup");
    og.label = "Porções";
    f.porcoes.forEach((p, i) => {
      const o = document.createElement("option");
      o.value = "p" + i;
      o.textContent = `${p[0]} (${fmt1(p[1])} g)`;
      og.appendChild(o);
    });
    sel.appendChild(og);
  }
  sel.value = ["g", "kg", "ml"].includes(prev) ? prev : "g";
}

function pickFood(f) {
  selFood = f;
  $("foodName").value = f.n;
  $("sugg").classList.remove("open");
  updateFoodPreview();
  $("qty").focus();
}

function showSugg() {
  const sugg = $("sugg");
  const q = $("foodName").value;
  if (norm(q).length < MIN_BUSCA) { sugg.classList.remove("open"); return; }
  const hits = searchFoods(q);
  sugg.innerHTML = "";
  hits.slice(0, MAX_SUGG).forEach(f => {
    const b = document.createElement("button");
    b.type = "button";
    b.innerHTML = '<span class="sn"></span><span class="sm"><i class="badge"></i><small class="num"></small></span>';
    b.querySelector(".sn").textContent = f.n;
    const badge = b.querySelector(".badge");
    badge.textContent = FONTE_ROTULO[f.src] || f.src;
    badge.classList.add("b-" + f.src);
    b.querySelector("small").textContent = fmt(f.nut[NUT.kcal]) + " kcal/100 g";
    b.onmousedown = e => e.preventDefault(); // não tira o foco do campo antes do clique
    b.onclick = () => pickFood(f);
    sugg.appendChild(b);
  });
  const notes = [];
  if (hits.length > MAX_SUGG) notes.push(`Mostrando ${MAX_SUGG} de ${fmt(hits.length)}. Continue digitando para refinar.`);
  if (baseState === "loading") notes.push("Carregando a base completa de alimentos…");
  if (notes.length) {
    const d = document.createElement("div");
    d.className = "sugg-note";
    d.textContent = notes.join(" ");
    sugg.appendChild(d);
  }
  sugg.classList.toggle("open", hits.length > 0 || baseState === "loading");
}

// valores do cadastro de alimento novo (por 100 g), com validação
function readCustomInputs() {
  const r = { kcal: numIn("cKcal"), carb: numIn("cCarb"), prot: numIn("cProt"), gord: numIn("cGord"), erro: "" };
  const macros = [r.carb, r.prot, r.gord];
  if (r.kcal != null && (r.kcal < 0 || r.kcal > 950)) {
    r.erro = "As kcal por 100 g precisam ficar entre 0 e 950.";
  } else if (macros.some(x => x != null && (x < 0 || x > 100))) {
    r.erro = "Carboidratos, proteínas e gorduras ficam entre 0 e 100 g (em 100 g do alimento).";
  } else if (macros.reduce((s, x) => s + (x || 0), 0) > 100.5) {
    r.erro = "Carboidratos + proteínas + gorduras passam de 100 g em 100 g do alimento. Confira o rótulo.";
  }
  return r;
}

// tabela com todos os nutrientes da quantidade escolhida
function renderNutri(f, g) {
  const box = $("foodNutri");
  if (!f || !(g > 0)) { box.classList.add("hide"); return; }
  box.classList.remove("hide");
  const v = nutFor(f, g);
  $("nutriQty").textContent = `em ${fmt1(g)} g`;
  $("nutriTable").innerHTML = NUTRIENTES.map((x, i) =>
    `<tr><td>${x.n}</td><td class="num">${fmtNut(v[i], x.u)}</td></tr>`).join("");
  $("nutriSrc").textContent = "Fonte: " + fonteDe(f) + "."
    + (v.some(x => x == null) ? " “—” significa sem dado na fonte (não é zero)." : "");
}

function updateFoodPreview() {
  const f = currentFood();
  setUnitOptions(f);
  const g = grams(f);
  const hasName = norm($("foodName").value).length > 0;
  $("customBox").classList.toggle("open", hasName && !f);
  renderNutri(f, g);

  let v = null, erro = "";
  if (f) {
    v = nutFor(f, g);
  } else if (hasName) {
    const c = readCustomInputs();
    erro = c.erro;
    if (!erro && c.kcal != null) {
      v = emptyNut();
      v[NUT.kcal] = c.kcal * g / 100;
      v[NUT.carb] = c.carb == null ? null : c.carb * g / 100;
      v[NUT.prot] = c.prot == null ? null : c.prot * g / 100;
      v[NUT.gord] = c.gord == null ? null : c.gord * g / 100;
    }
  }

  if (v && g > 0) {
    $("foodPrev").innerHTML = `≈ <b>${fmt(v[NUT.kcal])} kcal</b> · ${fmtNut(v[NUT.carb], "g")} carb · ${fmtNut(v[NUT.prot], "g")} prot · ${fmtNut(v[NUT.gord], "g")} gord`;
    $("addFood").disabled = !ready;
    return;
  }
  let msg = "";
  if (erro) msg = erro;
  else if (f) msg = `${fmt(f.nut[NUT.kcal])} kcal a cada 100 g · informe a quantidade`;
  else if (hasName && $("cKcal").value === "" && searchFoods($("foodName").value).length) {
    msg = "Escolha um alimento da lista (ou informe as kcal abaixo para cadastrar um novo).";
  }
  $("foodPrev").textContent = msg;
  $("addFood").disabled = true;
}


// nutrientes da quantidade registrada: kcal e mg inteiros (ferro com 1 casa), g com 1 casa; null = sem dado
const ENTRY_INTEIROS = ["kcal", "sodio", "colest", "calcio", "potassio"];
function nutEntry(v) {
  const o = {};
  Object.keys(NUT).forEach(k => {
    const x = v[NUT[k]];
    o[k] = x == null ? null : ENTRY_INTEIROS.includes(k) ? Math.round(x) : r1(x);
  });
  return o;
}

function addFood() {
  let f = currentFood();
  const g = grams(f);
  if (!(g > 0)) return;
  if (!f) {
    // alimento novo: salvo na hora, no formato de data/alimentos_unificados.json
    const nome = $("foodName").value.trim().replace(/\s+/g, " ");
    const c = readCustomInputs();
    if (!nome || c.erro || c.kcal == null) return;
    const novo = buildCustomFood({ nome, kcal: c.kcal, carb: c.carb, prot: c.prot, gord: c.gord });
    profile.customFoods = (profile.customFoods || []).filter(x => norm(x.nome) !== norm(nome)).concat([novo]);
    f = customToFood(novo);
  }
  const u = $("unit").value;
  const v = nutFor(f, g);
  const entry = {
    id: uid(),
    foodId: f.id,
    name: f.n,
    g: r1(g),
    unit: u.startsWith("p") ? "porcao" : u,
    ...nutEntry(v),
    meal: $("meal").value,
    t: Date.now()
  };
  if (entry.unit === "porcao") {
    entry.porcao = f.porcoes[Number(u.slice(1))][0];
    entry.qtd = numIn("qty");
  }
  if (!days[cur]) days[cur] = { foods: [], ex: [] };
  days[cur].foods.push(entry);
  saveDay();

  $("foodName").value = "";
  $("qty").value = "";
  ["cKcal", "cCarb", "cProt", "cGord"].forEach(id => { $(id).value = ""; });
  selFood = null;
  setUnitOptions(null);
  $("unit").value = "g";
  toast(`${f.n} adicionado`);
  try { renderAll(); } catch (e) { console.error(e); }
}

// chamada quando a base completa termina de carregar (ou falha)
function onFoodBaseChange() {
  if (baseState === "error") toast("Não consegui carregar a base completa de alimentos. A busca usa só a lista básica.", 4000);
  if (document.activeElement === $("foodName")) showSugg();
  updateFoodPreview();
}

// sugere a refeição pelo horário
function guessMeal() {
  const h = new Date().getHours();
  return h < 9 ? 0 : h < 11 ? 1 : h < 14 ? 2 : h < 18 ? 3 : h < 21 ? 4 : 5;
}

function initFoodForm() {
  const nameIn = $("foodName");
  nameIn.addEventListener("input", () => { selFood = null; showSugg(); updateFoodPreview(); });
  nameIn.addEventListener("focus", showSugg);
  nameIn.addEventListener("blur", () => setTimeout(() => $("sugg").classList.remove("open"), 150));
  ["qty", "unit", "cKcal", "cCarb", "cProt", "cGord"].forEach(id => $(id).addEventListener("input", updateFoodPreview));
  $("unit").addEventListener("change", updateFoodPreview);
  $("qty").addEventListener("keydown", e => { if (e.key === "Enter" && !$("addFood").disabled) $("addFood").click(); });
  $("addFood").onclick = () => {
    try { addFood(); }
    catch (e) { console.error(e); toast("Não consegui adicionar (" + errMsg(e) + ")."); }
  };
  $("meal").selectedIndex = guessMeal();
}


// ajusta os nutrientes guardados de um registro para uma nova quantidade (proporcional)
function escalarEntrada(f, novoG) {
  const fator = novoG / f.g;
  const out = {};
  Object.keys(NUT).forEach(k => {
    if (!(k in f)) return;
    out[k] = f[k] == null ? null : ENTRY_INTEIROS.includes(k) ? Math.round(f[k] * fator) : r1(f[k] * fator);
  });
  return out;
}

// corrige quantidade e refeição de um alimento registrado; os nutrientes acompanham a quantidade
function updateFood(id, { qtd, meal }, k = cur) {
  const list = days[k] && days[k].foods;
  const f = list && list.find(x => x.id === id);
  if (!f) return { ok: false, erro: "Registro não encontrado." };
  if (!isNum(qtd) || qtd <= 0) return { ok: false, erro: "Informe uma quantidade maior que zero.", campo: "qtd" };
  if (!MEALS.includes(meal)) return { ok: false, erro: "Refeição inválida.", campo: "meal" };
  if (!(f.g > 0)) return { ok: false, erro: "Este registro não tem o peso em gramas; exclua e registre de novo.", campo: "qtd" };
  const novoG = f.unit === "kg" ? qtd * 1000 : f.unit === "porcao" ? qtd * (f.g / (f.qtd || 1)) : qtd;
  if (novoG > 10000) return { ok: false, erro: "Quantidade muito alta (máximo de 10 kg por registro).", campo: "qtd" };
  Object.assign(f, escalarEntrada(f, novoG), { g: r1(novoG), meal });
  if (f.unit === "porcao") f.qtd = qtd;
  saveDay(k);
  return { ok: true, registro: f };
}

function editarAlimento(id) {
  const f = day().foods.find(x => x.id === id);
  if (!f) return;
  const unidade = f.unit === "porcao" ? `porções de ${f.porcao}` : f.unit === "kg" ? "kg" : f.unit === "ml" ? "ml" : "g";
  const valor = f.unit === "porcao" ? (f.qtd || 1) : f.unit === "kg" ? f.g / 1000 : f.g;
  abrirEdicao({
    titulo: "Editar " + f.name, retorno: "foodList",
    campos: [
      { id: "qtd", rotulo: `Quantidade (${unidade})`, tipo: "decimal", valor: String(r1(valor)).replace(".", ","), ajuda: "Calorias e nutrientes são recalculados na mesma proporção." },
      { id: "meal", rotulo: "Refeição", tipo: "select", valor: f.meal, opcoes: MEALS.map(m => [m, m]) }
    ],
    salvar: v => {
      const q = parseNumBR(v.qtd);
      if (!isNum(q)) return { erro: "Use só números, por exemplo 150 ou 1,5.", campo: "qtd" };
      const r = updateFood(id, { qtd: q, meal: v.meal });
      if (!r.ok) return r;
      toast(`${f.name}: ${fmt(r.registro.kcal || 0)} kcal`);
      renderAll();
      return { ok: true };
    }
  });
}

/* ---------- Exercícios ---------- */

const tipoExercicio = e => EXS.find(x => x.id === e.tipo) || EXS.find(x => x.n === e.name) || null;
// gasto extra além do basal: (MET − 1) × kg × horas. Sem peso no Perfil → null.
const kcalExercicio = (met, min, peso) => (naFaixa(peso, FAIXA_PESO) ? Math.max(0, met - 1) * peso * min / 60 : null);

function exKcal() {
  const e = EXS.find(x => x.id === $("exType").value) || EXS[0];
  const i = [0, 1, 2].includes(Number($("exInt").value)) ? Number($("exInt").value) : 1;
  const min = numIn("exMin") || 0;
  return { e, i, min, kcal: kcalExercicio(e.m[i], min, perfilCalculo(cur).peso) };
}

function updateExPreview() {
  const { e, i, min, kcal } = exKcal();
  $("exDesc").textContent = `${["Leve", "Moderada", "Intensa"][i]}: ${e.d[i]} (MET ${fmt1(e.m[i])})`;
  if (min > 0 && kcal == null) {
    $("exPrev").textContent = "Registre seu peso no Perfil para estimar o gasto do exercício.";
    $("addEx").disabled = true;
  } else if (min > 0 && min <= 600) {
    $("exPrev").innerHTML = `≈ <b>${fmt(kcal)} kcal</b> gastas a mais`;
    $("addEx").disabled = !ready;
  } else {
    $("exPrev").textContent = min > 600 ? "Informe até 600 minutos por registro." : "";
    $("addEx").disabled = true;
  }
}

function addExercise() {
  const { e, i, min, kcal } = exKcal();
  if (!(min > 0) || min > 600 || kcal == null) return;
  if (!days[cur]) days[cur] = { foods: [], ex: [] };
  days[cur].ex.push({ id: uid(), tipo: e.id, name: e.n, int: i, min, met: e.m[i], kcal: Math.round(kcal), t: Date.now() });
  saveDay();
  toast(`${e.n} adicionado`);
  $("exMin").value = "";
  try { renderAll(); } catch (err) { console.error(err); }
}

// corrige tempo e intensidade; o gasto é recalculado com o peso de referência daquele dia
function updateExercicio(id, { min, int }, k = cur) {
  const e = days[k] && days[k].ex.find(x => x.id === id);
  if (!e) return { ok: false, erro: "Registro não encontrado." };
  if (!isNum(min) || min <= 0 || min > 600) return { ok: false, erro: "Informe entre 1 e 600 minutos.", campo: "min" };
  if (![0, 1, 2].includes(int)) return { ok: false, erro: "Intensidade inválida.", campo: "int" };
  const tipo = tipoExercicio(e);
  let kcal, met = e.met;
  if (tipo) {
    met = tipo.m[int];
    kcal = kcalExercicio(met, min, perfilCalculo(k).peso);
    if (kcal == null) return { ok: false, erro: "Registre seu peso no Perfil para recalcular o gasto.", campo: "min" };
  } else {
    if (int !== e.int) return { ok: false, erro: "A intensidade desta atividade antiga não pode mudar.", campo: "int" };
    kcal = e.min > 0 ? e.kcal * min / e.min : e.kcal;
  }
  Object.assign(e, { min, int, met, kcal: Math.round(kcal) });
  saveDay(k);
  return { ok: true, registro: e };
}

function editarExercicio(id) {
  const e = day().ex.find(x => x.id === id);
  if (!e) return;
  abrirEdicao({
    titulo: "Editar " + e.name, retorno: "exList",
    campos: [
      { id: "min", rotulo: "Tempo (min)", tipo: "inteiro", valor: e.min },
      { id: "int", rotulo: "Intensidade", tipo: "select", valor: String(e.int), opcoes: [["0", "Leve"], ["1", "Moderada"], ["2", "Intensa"]] }
    ],
    salvar: v => {
      const min = parseNumBR(v.min);
      if (!isNum(min)) return { erro: "Use só números, por exemplo 40.", campo: "min" };
      const r = updateExercicio(id, { min, int: Number(v.int) });
      if (!r.ok) return r;
      toast(`${e.name}: ${fmt(r.registro.kcal)} kcal`);
      renderAll();
      return { ok: true };
    }
  });
}

function initExForm() {
  EXS.forEach(e => {
    const o = document.createElement("option");
    o.value = e.id;
    o.textContent = e.n;
    $("exType").appendChild(o);
  });
  ["exType", "exInt", "exMin"].forEach(id => {
    $(id).addEventListener("input", updateExPreview);
    $(id).addEventListener("change", updateExPreview);
  });
  $("exMin").addEventListener("keydown", e => { if (e.key === "Enter" && !$("addEx").disabled) $("addEx").click(); });
  $("addEx").onclick = () => {
    try { addExercise(); }
    catch (err) { console.error(err); toast("Não consegui adicionar (" + errMsg(err) + ")."); }
  };
}

/* ---------- Perfil: dados pessoais ---------- */
const PERFIL_CAMPOS = ["pNome", "pNasc", "pIdade", "pSexo", "pAlt", "pObjetivo", "pFator", "pCopo"];

// valida o formulário inteiro; devolve { ok, dados } ou { ok: false, erro, campo }
function lerPerfilForm() {
  const falha = (erro, campo) => ({ ok: false, erro, campo });
  const nome = $("pNome").value.trim().replace(/\s+/g, " ");
  if (nome.length > 60) return falha("Nome: use até 60 caracteres.", "pNome");
  const nasc = $("pNasc").value;
  let idade = null;
  if (nasc) {
    if (nasc > TODAY) return falha("Data de nascimento: não pode ser no futuro.", "pNasc");
    idade = idadeEm(nasc, TODAY);
    if (idade == null || idade < FAIXA_IDADE[0]) return falha("Data de nascimento inválida.", "pNasc");
  } else {
    const v = parseNumBR($("pIdade").value);
    if (Number.isNaN(v) || (v != null && (!Number.isInteger(v) || v < FAIXA_IDADE[0] || v > FAIXA_IDADE[1]))) return falha(`Idade: informe anos completos, de ${FAIXA_IDADE[0]} a ${FAIXA_IDADE[1]}.`, "pIdade");
    idade = v;
  }
  const alt = parseNumBR($("pAlt").value);
  if (Number.isNaN(alt)) return falha("Altura: use só números, em centímetros (ex.: 172).", "pAlt");
  if (alt != null && !naFaixa(alt, FAIXA_ALTURA)) return falha(`Altura: informe em centímetros, entre ${FAIXA_ALTURA[0]} e ${FAIXA_ALTURA[1]} (ex.: 172, não 1,72).`, "pAlt");
  const sexo = ["M", "F"].includes($("pSexo").value) ? $("pSexo").value : "";
  const objetivo = ["perder", "manter", "ganhar"].includes($("pObjetivo").value) ? $("pObjetivo").value : "manter";
  const fator = [1.2, 1.3, 1.4].includes(Number($("pFator").value)) ? Number($("pFator").value) : 1.2;
  const copo = validarCopo($("pCopo").value);
  if (!copo.ok) return falha("Copo: " + copo.erro, "pCopo");
  return { ok: true, dados: {
    nome, nascimento: nasc, idade, altura: alt == null ? null : r1(alt), sexo, objetivo, fator,
    condicoes: CONDICOES.filter(c => $(c.id).checked).map(c => c.k), copo_ml: copo.ml
  } };
}

function salvarPerfil() {
  limparErroCampo("pErro");
  const r = lerPerfilForm();
  if (!r.ok) { mostrarErroCampo("pErro", r.erro, r.campo); $("pMsg").textContent = ""; return false; }
  const d = r.dados;
  Object.assign(profile, { nome: d.nome, nascimento: d.nascimento, idade: d.idade, altura: d.altura, sexo: d.sexo,
    objetivo: d.objetivo, fator: d.fator, condicoes: d.condicoes });
  prefs.copo_ml = d.copo_ml;
  if (days[TODAY]) saveDay(TODAY); else persist();   // o dia de hoje guarda o gasto com os dados novos
  const ok = !saveError && !lerBloqueado;
  $("pMsg").textContent = ok ? `Dados salvos às ${horaDe(Date.now())}.` : "Os dados foram aplicados, mas não consegui gravá-los no navegador.";
  $("pMsg").className = "form-msg " + (ok ? "ok" : "err");
  toast(ok ? "Perfil salvo. Calorias, Água e Analytics já usam os dados novos." : "Não consegui salvar no navegador.");
  renderProfile();
  renderAll();
  return true;
}

function initProfileForm() {
  $("pNasc").addEventListener("input", () => {
    const i = idadeEm($("pNasc").value, TODAY);
    $("pIdade").disabled = !!$("pNasc").value;
    if (i != null) $("pIdade").value = i;
  });
  PERFIL_CAMPOS.concat(CONDICOES.map(c => c.id)).forEach(id => $(id).addEventListener("input", () => {
    $("pMsg").textContent = "Alterações não salvas.";
    $("pMsg").className = "form-msg";
  }));
  $("perfilForm").addEventListener("submit", e => { e.preventDefault(); salvarPerfil(); });
}
