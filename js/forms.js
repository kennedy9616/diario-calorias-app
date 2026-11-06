/* ==========================================================
   Formulários: alimentos, exercícios e dados pessoais
   ========================================================== */

/* ---------- Alimentos ---------- */

const UNIDADES = '<option value="g">g</option><option value="kg">kg</option><option value="ml">ml</option>';
const MAX_SUGG = 20;          // sugestões mostradas de cada vez

// número digitado (aceita vírgula); vazio ou inválido → null
function numIn(id) {
  const t = String($(id).value).trim().replace(",", ".");
  if (t === "") return null;
  const v = parseFloat(t);
  return isFinite(v) ? v : null;
}

// nutriente formatado; null = sem dado na fonte
function fmtNut(v, unit) {
  if (v == null) return "—";
  return (unit === "g" && v < 10 ? fmt1(v) : fmt(v)) + " " + unit;
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
  const n = norm($("foodName").value).replace(/\s+/g, " ");
  if (!n) return null;
  const exact = allFoods().find(f => f.s === n);
  if (exact) return exact;
  const hits = searchFoods(n);
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
    b.querySelector("small").textContent = fmt(f.nut[N.kcal]) + " kcal/100 g";
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
  $("nutriSrc").textContent = "Fonte: " + (FONTE_NOME[f.src] || f.src) + "."
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
      v[N.kcal] = c.kcal * g / 100;
      v[N.carb] = c.carb == null ? null : c.carb * g / 100;
      v[N.prot] = c.prot == null ? null : c.prot * g / 100;
      v[N.gord] = c.gord == null ? null : c.gord * g / 100;
    }
  }

  if (v && g > 0) {
    $("foodPrev").innerHTML = `≈ <b>${fmt(v[N.kcal])} kcal</b> · ${fmtNut(v[N.carb], "g")} carb · ${fmtNut(v[N.prot], "g")} prot · ${fmtNut(v[N.gord], "g")} gord`;
    $("addFood").disabled = !ready;
    return;
  }
  let msg = "";
  if (erro) msg = erro;
  else if (f) msg = `${fmt(f.nut[N.kcal])} kcal a cada 100 g · informe a quantidade`;
  else if (hasName && $("cKcal").value === "" && searchFoods($("foodName").value).length) {
    msg = "Escolha um alimento da lista (ou informe as kcal abaixo para cadastrar um novo).";
  }
  $("foodPrev").textContent = msg;
  $("addFood").disabled = true;
}

const r1 = x => x == null ? null : Math.round(x * 10) / 10;

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
    kcal: Math.round(v[N.kcal]),
    carb: r1(v[N.carb]),
    prot: r1(v[N.prot]),
    gord: r1(v[N.gord]),
    fibra: r1(v[N.fibra]),
    sodio: v[N.sodio] == null ? null : Math.round(v[N.sodio]),
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

/* ---------- Exercícios ---------- */

function exKcal() {
  const e = EXS.find(x => x.id === $("exType").value);
  const i = Number($("exInt").value);
  const min = parseFloat($("exMin").value) || 0;
  // gasto extra além do basal: (MET − 1) × kg × horas
  return { e, i, min, kcal: Math.max(0, (e.m[i] - 1)) * profile.peso * min / 60 };
}

function updateExPreview() {
  const { e, i, min, kcal } = exKcal();
  $("exDesc").textContent = `${["Leve", "Moderada", "Intensa"][i]}: ${e.d[i]} (MET ${fmt1(e.m[i])})`;
  if (min > 0) {
    $("exPrev").innerHTML = `≈ <b>${fmt(kcal)} kcal</b> gastas a mais`;
    $("addEx").disabled = !ready;
  } else {
    $("exPrev").textContent = "";
    $("addEx").disabled = true;
  }
}

function addExercise() {
  const { e, i, min, kcal } = exKcal();
  if (!(min > 0)) return;
  if (!days[cur]) days[cur] = { foods: [], ex: [] };
  days[cur].ex.push({ id: uid(), name: e.n, int: i, min, met: e.m[i], kcal: Math.round(kcal), t: Date.now() });
  saveDay();
  toast(`${e.n} adicionado`);
  $("exMin").value = "";
  try { renderAll(); } catch (err) { console.error(err); }
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

/* ---------- Dados pessoais ---------- */

function readProfileInputs() {
  const n = (id, def) => { const v = parseFloat(String($(id).value).replace(",", ".")); return v > 0 ? v : def; };
  profile.peso = n("pPeso", profile.peso);
  profile.altura = n("pAlt", profile.altura);
  profile.idade = n("pIdade", profile.idade);
  profile.sexo = $("pSexo").value;
  profile.fator = Number($("pFator").value);
  const m = parseFloat($("pMeta").value);
  profile.meta = m > 0 ? Math.round(m) : null;
  renderProfileInfo(); renderSummary(); renderChart(); updateExPreview();
  if (ready) saveProfile();
}

function initProfileForm() {
  ["pPeso", "pAlt", "pIdade", "pSexo", "pFator", "pMeta"].forEach(id => {
    $(id).addEventListener("input", readProfileInputs);
    $(id).addEventListener("change", readProfileInputs);
  });
}
