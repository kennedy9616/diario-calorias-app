/* ==========================================================
   Formulários: alimentos, exercícios e dados pessoais
   ========================================================== */

/* ---------- Alimentos ---------- */

// quantidade informada, sempre em gramas (ml conta como g)
function grams() {
  const q = parseFloat(String($("qty").value).replace(",", "."));
  if (!(q > 0)) return 0;
  return $("unit").value === "kg" ? q * 1000 : q;
}

// busca por palavras, sem acento: "frango grel" acha "Peito de frango grelhado"
function matches(n) {
  const words = n.split(/\s+/);
  return allFoods().filter(f => { const fn = norm(f.n); return words.every(w => fn.includes(w)); });
}

function currentFood() {
  if (selFood) return selFood;
  const n = norm($("foodName").value);
  if (!n) return null;
  const exact = allFoods().find(f => norm(f.n) === n);
  if (exact) return exact;
  const hits = matches(n);
  return hits.length === 1 ? hits[0] : null;
}

function showSugg() {
  const sugg = $("sugg");
  const n = norm($("foodName").value);
  if (!n) { sugg.classList.remove("open"); return; }
  const hits = matches(n).slice(0, 8);
  sugg.innerHTML = "";
  hits.forEach(f => {
    const b = document.createElement("button");
    b.type = "button";
    b.innerHTML = "<span></span><small></small>";
    b.children[0].textContent = f.n + (f.custom ? " ★" : "");
    b.children[1].textContent = fmt(f.k) + " kcal/100g";
    b.onmousedown = e => e.preventDefault(); // não tira o foco do campo antes do clique
    b.onclick = () => {
      selFood = f;
      $("foodName").value = f.n;
      sugg.classList.remove("open");
      updateFoodPreview();
      $("qty").focus();
    };
    sugg.appendChild(b);
  });
  sugg.classList.toggle("open", hits.length > 0);
}

function updateFoodPreview() {
  const f = currentFood(), g = grams(), hasName = norm($("foodName").value).length > 0;
  $("customBox").classList.toggle("open", hasName && !f);

  let kcal = null, c = 0, p = 0;
  if (f) {
    kcal = f.k * g / 100; c = (f.c || 0) * g / 100; p = (f.p || 0) * g / 100;
  } else if (hasName) {
    const k = parseFloat($("cKcal").value);
    if (k >= 0 && $("cKcal").value !== "") {
      kcal = k * g / 100;
      c = (parseFloat($("cCarb").value) || 0) * g / 100;
      p = (parseFloat($("cProt").value) || 0) * g / 100;
    }
  }

  if (kcal != null && g > 0) {
    $("foodPrev").innerHTML = `≈ <b>${fmt(kcal)} kcal</b> · ${fmt(c)} g carb · ${fmt(p)} g prot`;
    $("addFood").disabled = !ready;
  } else {
    let msg = f ? `${fmt(f.k)} kcal a cada 100 g` : "";
    if (!f && hasName && matches(norm($("foodName").value)).length && $("cKcal").value === "") {
      msg = "Escolha um alimento da lista (ou informe as kcal abaixo para cadastrar um novo).";
    } else if (f && !(g > 0)) {
      msg += " · informe a quantidade";
    }
    $("foodPrev").textContent = msg;
    $("addFood").disabled = true;
  }
}

function addFood() {
  let f = currentFood();
  const g = grams();
  if (!g) return;
  if (!f) {
    // alimento novo: fica salvo para as próximas vezes
    const k = parseFloat($("cKcal").value);
    if (!(k >= 0)) return;
    f = { n: $("foodName").value.trim(), k, c: parseFloat($("cCarb").value) || 0, p: parseFloat($("cProt").value) || 0 };
    profile.customFoods = (profile.customFoods || []).filter(x => x && norm(x.n) !== norm(f.n)).concat([f]);
  }
  if (!days[cur]) days[cur] = { foods: [], ex: [] };
  days[cur].foods.push({
    id: uid(),
    name: f.n,
    g,
    unit: $("unit").value,
    kcal: Math.round(f.k * g / 100),
    carb: Math.round((f.c || 0) * g / 10) / 10,
    prot: Math.round((f.p || 0) * g / 10) / 10,
    meal: $("meal").value,
    t: Date.now()
  });
  saveDay();

  $("foodName").value = ""; $("qty").value = ""; $("unit").value = "g";
  $("cKcal").value = ""; $("cCarb").value = ""; $("cProt").value = "";
  selFood = null;
  toast(`${f.n} adicionado`);
  try { renderAll(); } catch (e) { console.error(e); }
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
  ["qty", "unit", "cKcal", "cCarb", "cProt"].forEach(id => $(id).addEventListener("input", updateFoodPreview));
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
