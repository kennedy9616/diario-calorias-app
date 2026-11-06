/* ==========================================================
   Renderização: desenha na tela o estado atual.
   Todas as seções leem o mesmo estado (profile, days, medidas,
   metas, prefs); renderAll() atualiza tudo depois de qualquer mudança.
   ========================================================== */

function renderDate() {
  const d = fromKey(cur);
  const wd = d.toLocaleDateString("pt-BR", { weekday: "long" });
  const dmes = d.toLocaleDateString("pt-BR", { day: "numeric", month: "long" });
  const rel = cur === TODAY ? "Hoje"
    : cur === addDays(TODAY, -1) ? "Ontem"
    : wd.charAt(0).toUpperCase() + wd.slice(1);
  $("dateLbl").innerHTML = `${rel}<small>${dmes}</small>`;
  $("next").disabled = cur >= TODAY;
  $("hoje").classList.toggle("hide", cur === TODAY);
}

// total de um nutriente: "12 g"; "≥ 12 g" se algum alimento não tem o dado; "—" se nenhum tem
function fmtTotal(t, key, unit) {
  const f = t.falta[key] || 0;
  if (t.n && f === t.n) return "—";
  return (f ? "≥ " : "") + fmt(t[key]) + " " + unit;
}

function renderSummary() {
  const t = totals();
  const tmbDia = dayTmb(cur);
  $("sCons").textContent = fmt(t.cons);
  $("sGasto").textContent = t.gasto == null ? "—" : fmt(t.gasto);
  $("sTmb").textContent = tmbDia == null ? "—" : fmt(tmbDia);
  $("sEx").textContent = fmt(t.ex);
  $("sCarb").textContent = fmtTotal(t, "carb", "g");
  $("sProt").textContent = fmtTotal(t, "prot", "g");
  $("sGord").textContent = fmtTotal(t, "gord", "g");
  $("sMicro").textContent = `Fibras ${fmtTotal(t, "fibra", "g")} · Sódio ${fmtTotal(t, "sodio", "mg")}`;
  const parcial = ["carb", "prot", "gord", "fibra", "sodio"].some(k => t.falta[k]);
  $("sHint").classList.toggle("hide", !parcial);
  $("sPerfil").classList.toggle("hide", t.gasto != null);

  const b = $("balance");
  if (!t.has && !t.ex) {
    b.className = "balance none";
    $("balLbl").textContent = "Sem registros neste dia";
    $("balVal").textContent = "—";
  } else if (t.gasto == null) {
    b.className = "balance none";
    $("balLbl").textContent = "Saldo indisponível: complete o Perfil para estimar o gasto";
    $("balVal").textContent = "—";
  } else {
    const s = t.cons - t.gasto;
    // diário parcial não vira "déficit": só o dia marcado como completo ganha cor e rótulo
    const completo = !!(days[cur] && days[cur].completo && t.has);
    b.className = "balance " + (!completo ? "none" : s <= 0 ? "def" : "sur");
    $("balLbl").textContent = !completo ? "Saldo parcial: diário incompleto"
      : s <= 0 ? "Déficit estimado do dia" : "Superávit estimado do dia";
    $("balVal").textContent = (s <= 0 ? "−" : "+") + fmt(Math.abs(s)) + " kcal";
  }

  const mv = metaVigente("kcal", cur);
  $("diaCompleto").checked = !!(days[cur] && days[cur].completo);
  $("diaCompleto").disabled = !t.has;

  const meta = mv ? mv.valor : 0;
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

// uma linha da lista (alimento ou exercício) com editar e excluir
function itemEl(main, sub, kcal, onEdit, onDel) {
  const el = document.createElement("li");
  el.className = "item";
  el.innerHTML = `<div class="n"><div></div><small></small></div><div class="kc num"></div>`
    + `<button type="button" class="ib">${ICON_EDIT}</button><button type="button" class="ib del">${ICON_DEL}</button>`;
  el.querySelector(".n div").textContent = main;
  el.querySelector(".n small").textContent = sub;
  el.querySelector(".kc").textContent = kcal;
  const [be, bd] = el.querySelectorAll("button");
  if (be) { be.setAttribute("aria-label", "Editar " + main); be.onclick = onEdit; }
  if (bd) { bd.setAttribute("aria-label", "Excluir " + main); bd.onclick = onDel; }
  return el;
}

// "150 g", "1,5 kg", "2 × 1 cup (480 g)"
function qtyLabel(f) {
  if (f.unit === "porcao") return `${fmt1(f.qtd || 1)} × ${f.porcao} (${fmt(f.g || 0)} g)`;
  if (f.unit === "kg") return fmt1(f.g / 1000) + " kg";
  return fmt(f.g || 0) + " " + (f.unit === "ml" ? "ml" : "g");
}

function excluirRegistro(lista, id, nome) {
  if (!confirmar(`Excluir “${nome}” deste dia?`)) return;
  days[cur][lista] = days[cur][lista].filter(x => x.id !== id);
  saveDay();
  toast(`“${nome}” excluído`);
  renderAll();
  $(lista === "foods" ? "foodList" : "exList").focus();
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
    const ul = document.createElement("ul");
    ul.className = "rlist";
    items.forEach(f => {
      const macros = [[f.carb, "carb"], [f.prot, "prot"], [f.gord, "gord"]]
        .filter(([v]) => v != null).map(([v, k]) => `${fmt(v)} g ${k}`);
      ul.appendChild(itemEl(
        f.name,
        [qtyLabel(f)].concat(macros).join(" · "),
        fmt(f.kcal || 0) + " kcal",
        () => editarAlimento(f.id),
        () => excluirRegistro("foods", f.id, f.name)
      ));
    });
    g.appendChild(ul);
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
  const ul = document.createElement("ul");
  ul.className = "rlist";
  d.ex.forEach(e => {
    ul.appendChild(itemEl(
      e.name,
      `${e.min} min · intensidade ${lv[e.int] || ""}`,
      "−" + fmt(e.kcal || 0) + " kcal",
      () => editarExercicio(e.id),
      () => excluirRegistro("ex", e.id, e.name)
    ));
  });
  box.appendChild(ul);
}

// saldo estimado dos 7 dias até o dia mostrado (só dias completos)
function renderChart() {
  const ks = [];
  for (let i = 6; i >= 0; i--) ks.push(addDays(cur, -i));
  const vals = ks.map(k => { const r = resumoDia(k); return r.deficit == null ? null : -r.deficit; });
  const box = $("chart");
  if (!vals.some(v => v != null)) {
    box.innerHTML = '<div class="empty">Marque dias como completos (e complete o Perfil) para ver o saldo estimado.</div>';
    box._chart = null;
    return;
  }
  const maxAbs = Math.max(300, ...vals.filter(v => v != null).map(v => Math.abs(v)));
  const W = larguraDe(box), H = 170, top = 22, bot = 30;
  const mid = top + (H - top - bot) / 2, half = (H - top - bot) / 2;
  const slot = W / 7, bw = Math.min(24, slot - 6);
  const cA = cssVar("--accent"), cW = cssVar("--warn"), cL = cssVar("--line"), cM = cssVar("--muted"), cI = cssVar("--ink");
  let s = `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Saldo estimado dos 7 dias até ${dataBr(cur)} (só dias completos)">`;
  s += `<rect class="hl" x="0" y="${top}" width="0" height="${H - top - bot}" fill="${cI}" style="opacity:0;fill-opacity:.07"/>`;
  s += `<line x1="0" x2="${W}" y1="${mid}" y2="${mid}" stroke="${cL}" stroke-width="1"/>`;
  const pts = [];
  ks.forEach((k, i) => {
    const cx = slot * i + slot / 2, x = cx - bw / 2, v = vals[i];
    if (v == null) {
      s += `<rect x="${x}" y="${mid - 1.5}" width="${bw}" height="3" rx="1.5" fill="${cM}" opacity=".45"/>`;
    } else {
      const h = Math.max(3, Math.abs(v) / maxAbs * half);
      s += v <= 0 ? `<path d="M${x} ${mid}V${mid + h - 4}Q${x} ${mid + h} ${x + 4} ${mid + h}H${x + bw - 4}Q${x + bw} ${mid + h} ${x + bw} ${mid + h - 4}V${mid}Z" fill="${cA}"/>`
        : `<path d="${coluna(x, mid - h, bw, h)}" fill="${cW}"/>`;
    }
    s += `<text x="${cx}" y="${H - 6}" text-anchor="middle" font-size="10.5" font-weight="${k === cur ? 800 : 600}" fill="${k === cur ? cI : cM}" ${FONT}>${diaCurto(k)}</text>`;
    pts.push({ x: cx, y: top, hw: slot / 2, linhas: [v == null ? "Sem saldo (dia sem registro completo)" : (v <= 0 ? "Déficit estimado " : "Superávit estimado ") + fmt(Math.abs(v)) + " kcal", dataBr(k)] });
  });
  box.innerHTML = s + '</svg><div class="tip" hidden></div>';
  interativo(box, W, pts, "Saldo estimado por dia");
}

/* ---------- Perfil: formulário dos dados pessoais ---------- */
function renderProfile() {
  $("pNome").value = profile.nome || "";
  $("pAlt").value = profile.altura == null ? "" : String(profile.altura).replace(".", ",");
  $("pIdade").value = profile.nascimento ? (idadeAtual() == null ? "" : idadeAtual()) : (profile.idade == null ? "" : profile.idade);
  $("pIdade").disabled = !!profile.nascimento;
  $("pNasc").value = profile.nascimento || "";
  $("pNasc").max = TODAY;
  CONDICOES.forEach(c => { $(c.id).checked = (profile.condicoes || []).includes(c.k); });
  $("pSexo").value = profile.sexo || "";
  $("pFator").value = String(profile.fator);
  $("pObjetivo").value = profile.objetivo || "manter";
  $("pCopo").value = String(prefs.copo_ml);
  renderProfileInfo();
}

function renderProfileInfo() {
  const b = tmb(), g = tdee();
  const falta = dadosFaltando();
  $("profSum").textContent = falta.length ? "Faltam: " + falta.join(", ") : `${fmt1(pesoReferencia().peso)} kg · TMB ${fmt(b)}`;
  $("tmbInfo").innerHTML = b == null
    ? `Para estimar o gasto, preencha: <b>${escapeHtml(falta.join(", "))}</b>. O peso vem das suas pesagens (cartão “Peso e medidas”).`
    : `Taxa metabólica basal: <b>${fmt(b)} kcal</b>. Com a rotina escolhida, gasto diário sem exercícios: <b>${fmt(g)} kcal</b>.`;
  $("hdrNome").textContent = profile.nome ? "Olá, " + profile.nome : "";
}

function renderPerfil() {
  renderCorpo();
  renderMetasForm();
  renderAguaMeta();
  renderProfileInfo();
}

// cada parte é desenhada mesmo que outra falhe (um erro não deixa a tela pela metade)
function renderAll() {
  [renderDate, renderSummary, renderFoods, renderEx, renderChart, renderAnDia, renderAgua, renderPerfil, renderAnalytics,
    updateFoodPreview, updateExPreview].forEach(fn => {
    try { fn(); } catch (e) { console.error(fn.name, e); }
  });
}
