/* ==========================================================
   Renderização: desenha na tela o estado atual
   ========================================================== */

function renderDate() {
  const d = fromKey(cur);
  const wd = d.toLocaleDateString("pt-BR", { weekday: "long" });
  const dm = d.toLocaleDateString("pt-BR", { day: "numeric", month: "long" });
  const rel = cur === TODAY ? "Hoje"
    : cur === addDays(TODAY, -1) ? "Ontem"
    : wd.charAt(0).toUpperCase() + wd.slice(1);
  $("dateLbl").innerHTML = `${rel}<small>${dm}</small>`;
  $("next").disabled = cur >= TODAY;
}

// total de um nutriente: "12 g"; "≥ 12 g" se algum alimento não tem o dado; "—" se nenhum tem
function fmtTotal(t, key, unit) {
  const f = t.falta[key] || 0;
  if (t.n && f === t.n) return "—";
  return (f ? "≥ " : "") + fmt(t[key]) + " " + unit;
}

function renderSummary() {
  const t = totals();
  $("sCons").textContent = fmt(t.cons);
  $("sGasto").textContent = fmt(t.gasto);
  $("sTmb").textContent = fmt(tmb());
  $("sEx").textContent = fmt(t.ex);
  $("sCarb").textContent = fmtTotal(t, "carb", "g");
  $("sProt").textContent = fmtTotal(t, "prot", "g");
  $("sGord").textContent = fmtTotal(t, "gord", "g");
  $("sMicro").textContent = `Fibras ${fmtTotal(t, "fibra", "g")} · Sódio ${fmtTotal(t, "sodio", "mg")}`;
  const parcial = ["carb", "prot", "gord", "fibra", "sodio"].some(k => t.falta[k]);
  $("sHint").classList.toggle("hide", !parcial);

  const b = $("balance");
  if (!t.has && !t.ex) {
    b.className = "balance none";
    $("balLbl").textContent = "Sem registros neste dia";
    $("balVal").textContent = "—";
  } else {
    const s = t.cons - t.gasto;
    b.className = "balance " + (s <= 0 ? "def" : "sur");
    $("balLbl").textContent = s <= 0 ? "Déficit calórico do dia" : "Superávit calórico do dia";
    $("balVal").textContent = (s <= 0 ? "−" : "+") + fmt(Math.abs(s)) + " kcal";
  }

  const meta = Number(profile.meta);
  if (meta > 0) {
    $("metaBox").classList.remove("hide");
    const pct = Math.min(100, t.cons / meta * 100);
    $("metaFill").style.width = pct + "%";
    $("metaBar").classList.toggle("over", t.cons > meta);
    $("metaTxt").textContent = `${fmt(t.cons)} de ${fmt(meta)} kcal da meta`;
    $("metaRest").textContent = t.cons > meta ? `${fmt(t.cons - meta)} acima` : `restam ${fmt(meta - t.cons)}`;
  } else {
    $("metaBox").classList.add("hide");
  }
}

// uma linha da lista (alimento ou exercício) com botão de remover
function itemEl(main, sub, kcal, onDel) {
  const el = document.createElement("div");
  el.className = "item";
  el.innerHTML = `<div class="n"><div></div><small></small></div><div class="kc num"></div><button class="x" aria-label="Remover">×</button>`;
  el.querySelector(".n div").textContent = main;
  el.querySelector(".n small").textContent = sub;
  el.querySelector(".kc").textContent = kcal;
  el.querySelector(".x").onclick = onDel;
  return el;
}

// "150 g", "1,5 kg", "2 × 1 cup (480 g)"
function qtyLabel(f) {
  if (f.unit === "porcao") return `${fmt1(f.qtd || 1)} × ${f.porcao} (${fmt(f.g || 0)} g)`;
  if (f.unit === "kg") return fmt1(f.g / 1000) + " kg";
  return fmt(f.g || 0) + " " + (f.unit === "ml" ? "ml" : "g");
}

function renderFoods() {
  const box = $("foodList");
  box.innerHTML = "";
  const d = day();
  if (!d.foods.length) {
    box.innerHTML = '<div class="empty">Nenhum alimento registrado neste dia.</div>';
    return;
  }
  MEALS.forEach(m => {
    const items = d.foods.filter(f => f.meal === m);
    if (!items.length) return;
    const g = document.createElement("div");
    g.className = "group";
    const h = document.createElement("h3");
    h.innerHTML = `<span></span><span class="num"></span>`;
    h.children[0].textContent = m;
    h.children[1].textContent = fmt(items.reduce((s, f) => s + (f.kcal || 0), 0)) + " kcal";
    g.appendChild(h);
    items.forEach(f => {
      const macros = [[f.carb, "carb"], [f.prot, "prot"], [f.gord, "gord"]]
        .filter(([v]) => v != null).map(([v, k]) => `${fmt(v)} g ${k}`);
      g.appendChild(itemEl(
        f.name,
        [qtyLabel(f)].concat(macros).join(" · "),
        fmt(f.kcal || 0) + " kcal",
        () => { days[cur].foods = days[cur].foods.filter(x => x.id !== f.id); saveDay(); renderAll(); }
      ));
    });
    box.appendChild(g);
  });
}

function renderEx() {
  const box = $("exList");
  box.innerHTML = "";
  const d = day();
  if (!d.ex.length) {
    box.innerHTML = '<div class="empty">Nenhum exercício registrado neste dia.</div>';
    return;
  }
  const lv = ["leve", "moderada", "intensa"];
  d.ex.forEach(e => {
    box.appendChild(itemEl(
      e.name,
      `${e.min} min · intensidade ${lv[e.int] || ""}`,
      "−" + fmt(e.kcal || 0) + " kcal",
      () => { days[cur].ex = days[cur].ex.filter(x => x.id !== e.id); saveDay(); renderAll(); }
    ));
  });
}

// gráfico de barras do saldo dos últimos 7 dias (SVG)
function renderChart() {
  const keys = [];
  for (let i = 6; i >= 0; i--) keys.push(addDays(cur, -i));
  const vals = keys.map(k => { const t = totals(k); return t.has ? t.cons - t.gasto : null; });
  const maxAbs = Math.max(300, ...vals.filter(v => v != null).map(v => Math.abs(v)));

  const W = 330, H = 170, top = 22, bot = 30;
  const mid = top + (H - top - bot) / 2, half = (H - top - bot) / 2;
  const bw = 30, gap = (W - 7 * bw) / 8;

  const css = getComputedStyle(document.documentElement);
  const cA = css.getPropertyValue("--accent").trim();
  const cW = css.getPropertyValue("--warn").trim();
  const cL = css.getPropertyValue("--line").trim();
  const cM = css.getPropertyValue("--muted").trim();
  const cI = css.getPropertyValue("--ink").trim();
  const font = `font-family="Manrope, system-ui, sans-serif"`;

  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Saldo calórico dos últimos 7 dias">`;
  s += `<line x1="0" x2="${W}" y1="${mid}" y2="${mid}" stroke="${cL}" stroke-width="1"/>`;
  keys.forEach((k, i) => {
    const x = gap + i * (bw + gap), v = vals[i], d = fromKey(k);
    const lbl = d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "").slice(0, 3);
    if (v == null) {
      s += `<rect x="${x}" y="${mid - 1.5}" width="${bw}" height="3" rx="1.5" fill="${cL}"/>`;
    } else {
      const h = Math.max(3, Math.abs(v) / maxAbs * half), y = v <= 0 ? mid : mid - h;
      s += `<rect x="${x}" y="${y}" width="${bw}" height="${h}" rx="5" fill="${v <= 0 ? cA : cW}"/>`;
      const ty = v <= 0 ? mid + h + 12 : mid - h - 5;
      s += `<text x="${x + bw / 2}" y="${Math.min(Math.max(ty, 12), H - bot + 10)}" text-anchor="middle" font-size="9.5" font-weight="700" fill="${cI}" ${font}>${(v <= 0 ? "−" : "+") + fmt(Math.abs(v))}</text>`;
    }
    s += `<text x="${x + bw / 2}" y="${H - 6}" text-anchor="middle" font-size="10.5" font-weight="${k === cur ? 800 : 600}" fill="${k === cur ? cI : cM}" ${font}>${lbl}</text>`;
  });
  s += "</svg>";
  $("chart").innerHTML = s;
}

function renderProfile() {
  $("pPeso").value = profile.peso;
  $("pAlt").value = profile.altura;
  $("pIdade").value = profile.idade;
  $("pSexo").value = profile.sexo;
  $("pFator").value = String(profile.fator);
  $("pMeta").value = profile.meta || "";
  renderProfileInfo();
}

function renderProfileInfo() {
  $("profSum").textContent = `${fmt1(profile.peso)} kg · TMB ${fmt(tmb())}`;
  $("tmbInfo").innerHTML = `Taxa metabólica basal: <b>${fmt(tmb())} kcal</b>. Com a rotina escolhida, gasto diário sem exercícios: <b>${fmt(tdee())} kcal</b>.`;
}

function renderAll() {
  renderDate();
  renderSummary();
  renderFoods();
  renderEx();
  renderChart();
  updateFoodPreview();
  updateExPreview();
}
