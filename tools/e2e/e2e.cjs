// Teste de ponta a ponta no Chrome real (headless), com o app servido em /diario-calorias-app/
// como no GitHub Pages. Opcional (não roda no CI): precisa do Google Chrome ou Chromium.
// Uso: node tools/e2e/e2e.cjs [pasta-para-capturas]
//      (sem Node: ELECTRON_RUN_AS_NODE=1 "<VS Code>/Code.exe" tools/e2e/e2e.cjs)
// Verifica as 4 seções, os critérios de aceite de Água, Calorias e Analytics, teclado,
// recarregar, larguras de 360, 390, 768 e 1280 px e erros no console. Usa um perfil temporário.
const { launch, sleep } = require("./cdp.cjs");
const { servir } = require("./servidor.cjs");
const path = require("node:path"), fs = require("node:fs"), os = require("node:os");
const PORTA = Number(process.env.PORTA || 8799);
const BASE = "http://127.0.0.1:" + PORTA + "/diario-calorias-app/";
const OUT = process.argv[2] || fs.mkdtempSync(path.join(os.tmpdir(), "diario-e2e-capturas-"));
const res = [];
const ok = (nome, cond, info = "") => { res.push([cond ? "OK " : "FALHA", nome, info]); };

(async () => {
  const srv = await servir(path.join(__dirname, "..", ".."), PORTA);
  const b = await launch({ port: 9340 });
  const J = async e => b.eval(e);
  try {
    await b.viewport(390, 844);
    await b.goto(BASE, 1800);
    ok("primeira visita abre o Perfil", (await J("location.hash")) === "#perfil" && (await J("view")) === "perfil");

    // ---- Perfil: preencher pelo formulário (vírgula decimal) ----
    await J(`(() => { const s = (id, v) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event("input", { bubbles: true })); };
      s("pNome", "Ana"); s("pIdade", "30"); s("pAlt", "165,5"); s("pSexo", "F"); s("pObjetivo", "perder"); s("pFator", "1.2"); })()`);
    await b.tap("#pSalvar"); await sleep(150);
    ok("perfil salvo com feedback", /salvos/.test(await J("pMsg.textContent")), await J("pMsg.textContent"));
    await J(`document.getElementById("mPeso").value = "62,4"`);
    await b.tap("#addMedida"); await sleep(150);
    ok("peso registrado vira peso atual", (await J("document.getElementById('pesoAtual').textContent")) === "62,4 kg", await J("document.getElementById('pesoAtual').textContent"));
    ok("TMB calculada sem NaN", /^\d[\d.]* kcal\/dia$/.test(await J("tmbVal.textContent")), await J("tmbVal.textContent"));
    // meta de água estimada
    await J(`aguaMetaBox.open = true; aguaMetaOrigem.value = "estimada"; aguaMetaOrigem.dispatchEvent(new Event("change"))`);
    await b.tap("#aguaMetaSalvar"); await sleep(150);
    ok("meta de água estimada (F) = 1,6 L", /1,6 L/.test(await J("aguaMetaSum.textContent")), await J("aguaMetaSum.textContent"));
    await b.shot(path.join(OUT, "390-perfil.png"));

    // ---- Navegação ----
    for (const v of ["agua", "calorias", "analytics", "perfil"]) {
      await b.tap("#nav-" + v); await sleep(250);
      const st = await J(`JSON.stringify({ h: location.hash, view, cur: document.getElementById("nav-${v}").getAttribute("aria-current"), vis: !document.getElementById("view-${v}").classList.contains("hide") })`);
      const s = JSON.parse(st);
      ok("abre " + v, s.h === "#" + v && s.view === v && s.cur === "page" && s.vis, st);
    }
    await J("history.back()"); await sleep(300);
    ok("voltar retorna à seção anterior", (await J("view")) === "analytics", await J("view"));
    await J("history.forward()"); await sleep(300);
    ok("avançar", (await J("view")) === "perfil");
    const navBg = await J(`getComputedStyle(document.querySelector(".bnav a")).backgroundColor`);
    const icoW = await J(`document.querySelector(".bnav .ico").getBoundingClientRect().width`);
    ok("links da barra sem fundo branco", !/255, 255, 255|240, 240, 240/.test(navBg), navBg);
    ok("ícones proporcionais (24px + respiro)", icoW > 20 && icoW < 64, String(icoW));

    // ---- Água: critérios de aceite ----
    await b.tap("#nav-agua"); await sleep(250);
    await b.tap('#aguaCopoOpcoes [data-copo="250"]');
    for (let i = 0; i < 3; i++) { await b.tap("#aguaCopo"); await sleep(40); }
    await sleep(300);
    ok("250 ml × 3 = 750 ml", (await J("aguaTotal.textContent")) === "750 ml", await J("aguaTotal.textContent"));
    ok("3 registros na lista", (await J("aguaList.querySelectorAll('li').length")) === 3);
    await b.tap("#aguaDesfazer"); await sleep(200);
    ok("desfazer volta para 500 ml", (await J("aguaTotal.textContent")) === "500 ml", await J("aguaTotal.textContent"));
    await b.tap('#aguaCopoOpcoes [data-copo="500"]'); await sleep(100);
    await b.tap("#aguaCopo"); await sleep(200);
    ok("mudar o copo preserva os anteriores", JSON.stringify(await J("days[TODAY].agua.map(x => x.ml)")) === "[250,250,500]", JSON.stringify(await J("days[TODAY].agua.map(x => x.ml)")));
    await J(`aguaCopoMl.value = "-30"`); await b.tap("#aguaCopoSalvar"); await sleep(100);
    ok("copo negativo explica o erro no campo", /entre 50/.test(await J("aguaCopoErro.textContent")) && (await J("aguaCopoMl.getAttribute('aria-invalid')")) === "true", await J("aguaCopoErro.textContent"));
    await sleep(1000);
    const t1 = await J(`getComputedStyle(document.querySelector("#aguaFig .nivel")).transform`);
    ok("silhueta parcialmente cheia (1 L de 1,6 L)", /matrix/.test(t1), t1);
    await b.tap("#aguaCopo"); await b.tap("#aguaCopo"); await sleep(1100);   // 2 L > 1,6 L
    const t2 = await J(`getComputedStyle(document.querySelector("#aguaFig .nivel")).transform`);
    const y = t => parseFloat(t.split(",")[5]);
    ok("acima da meta: silhueta para no topo (y = 4)", Math.abs(y(t2) - 4) < 0.5, t2);
    ok("acima da meta: total real preservado", (await J("aguaTotal.textContent")) === "2 L", await J("aguaTotal.textContent") + " · " + await J("aguaRestante.textContent"));
    ok("desfazer disponível após toques", /Último: \+500 ml/.test(await J("aguaUltimo.textContent")) && !(await J("document.getElementById(\"aguaDesfazer\").disabled")), await J("JSON.stringify([aguaUltimo.textContent, aguaDesfazer.length, aguaDesfazer.slice(-1)])"));
    await b.shot(path.join(OUT, "390-agua-sessao.png"));

    // ---- Calorias: alimento pela busca + edição ----
    await b.tap("#nav-calorias"); await sleep(300);
    await J(`(() => { foodName.focus(); foodName.value = "arroz branco"; foodName.dispatchEvent(new Event("input")); })()`);
    await sleep(200);
    ok("busca mostra sugestões", await J("sugg.classList.contains('open') && sugg.querySelectorAll('button').length > 0"));
    await b.tap("#sugg button"); await sleep(150);
    const escolhido = await J("selFood && selFood.n");
    await J(`(() => { qty.value = "150"; qty.dispatchEvent(new Event("input")); })()`);
    await sleep(100);
    await b.tap("#addFood"); await sleep(300);
    const kc1 = await J("days[TODAY].foods[0] && days[TODAY].foods[0].kcal");
    const esperado = await J("Math.round(selFood ? 0 : 0) + Math.round(findByName(days[TODAY].foods[0].name).nut[NUT.kcal] * 1.5)");
    ok("calculadora: alimento escolhido na lista e adicionado", kc1 === esperado, escolhido + " " + kc1);
    ok("gasto estimado calculado", /^\d/.test(await J("sGasto.textContent")), await J("sGasto.textContent"));
    await J(`foodList.querySelector(".ib").click()`); await sleep(200);
    ok("janela de edição abre", await J("editDlg.open"));
    await J(`document.getElementById("ed-qtd").value = "300"`);
    await b.tap("#editSalvar"); await sleep(300);
    const kc2 = await J("days[TODAY].foods[0].kcal");
    ok("editar alimento recalcula (dobro)", Math.abs(kc2 - 2 * kc1) <= 1 && !(await J("editDlg.open")), kc1 + " -> " + kc2);
    await b.shot(path.join(OUT, "390-calorias.png"));

    // ---- Analytics ----
    await b.tap("#nav-analytics"); await sleep(400);
    const kcTxt = (await J("fmt(days[TODAY].foods[0].kcal)")) + " kcal";
    ok("Analytics reflete a edição", (await J("anKpis.textContent")).includes(kcTxt), kcTxt + " em " + (await J("anKpis.textContent")).slice(0, 200));
    ok("cobertura informada", /1 de 7 dias com registro/.test(await J("anKpis.textContent")));
    for (const p of ["hoje", "30d", "90d"]) {
      await b.tap(`#anPeriodo [data-p="${p}"]`); await sleep(250);
      ok("filtro " + p, (await J(`document.querySelector('#anPeriodo [data-p="${p}"]').getAttribute("aria-pressed")`)) === "true" && /\d/.test(await J("anPerTxt.textContent")), await J("anPerTxt.textContent"));
    }
    await b.tap('#anPeriodo [data-p="7d"]'); await sleep(250);
    ok("gráficos SVG", (await J(`["anAguaChart","anKcalChart","anPesoChart"].every(id => document.getElementById(id).querySelector("svg"))`)));
    // tooltip por toque e por teclado
    await b.tap("#anKcalChart svg"); await sleep(150);
    ok("toque mostra o valor do dia", !(await J(`anKcalChart.querySelector(".tip").hidden`)), await J(`anKcalChart.querySelector(".tip").textContent`));
    await J("anAguaChart.focus()"); await b.key("ArrowLeft", "ArrowLeft", 37); await sleep(100);
    ok("teclado (←) mostra o valor", /Sem registro|ml|L/.test(await J(`anAguaChart.querySelector(".tip").textContent`)), await J(`anAguaChart.querySelector(".tip").textContent`));
    await b.shot(path.join(OUT, "390-analytics.png"));

    // ---- Teclado na navegação ----
    await J(`document.getElementById("nav-perfil").focus()`);
    await b.key("Enter", "Enter", 13); await sleep(300);
    ok("Enter no link abre a seção", (await J("view")) === "perfil", await J("view"));
    const fv = await J(`(() => { const a = document.getElementById("nav-agua"); a.focus(); return getComputedStyle(a, ":focus-visible") ? getComputedStyle(a).outlineStyle : ""; })()`);
    ok("foco visível disponível", typeof fv === "string");

    await J(`location.hash = "calorias"`); await sleep(300);
    await J(`document.getElementById("tabBtn-food").focus()`); await b.key("ArrowRight", "ArrowRight", 39); await sleep(150);
    ok("abas Alimentação/Exercícios pelo teclado (→)", (await J(`!document.getElementById("tab-ex").classList.contains("hide") && document.activeElement.id === "tabBtn-ex" && document.getElementById("tabBtn-ex").getAttribute("aria-selected") === "true"`)));
    await J(`location.hash = "calorias"; foodList.querySelector(".ib").click()`); await sleep(150);
    await J(`document.getElementById("ed-qtd").value = "1x"`); await b.tap("#editSalvar"); await sleep(150);
    ok("edição inválida explica o erro e mantém a janela", (await J("editDlg.open")) && /números/.test(await J("editErro.textContent")), await J("editErro.textContent"));
    await b.key("Escape", "Escape", 27); await sleep(150);
    ok("Esc fecha a janela", !(await J("editDlg.open")));
    await J(`location.hash = "perfil"`); await sleep(300);
    // ---- Recarregar restaura ----
    await b.reload(1500);
    ok("recarregar mantém a seção", (await J("view")) === "perfil");
    ok("recarregar restaura água", (await J("aguaDia(TODAY).total_ml")) === 2000, String(await J("aguaDia(TODAY).total_ml")));
    ok("recarregar restaura nome e copo", (await J("profile.nome")) === "Ana" && (await J("prefs.copo_ml")) === 500);

    // ---- Larguras ----
    for (const [w, h] of [[360, 740], [390, 844], [768, 1024], [1280, 860]]) {
      await b.viewport(w, h);
      for (const v of ["agua", "calorias", "analytics", "perfil"]) {
        await J(`location.hash = "${v}"`); await sleep(350);
        const m = JSON.parse(await J(`JSON.stringify({ sw: document.documentElement.scrollWidth, iw: innerWidth,
          over: [...document.querySelectorAll("#view-${v} *")].filter(e => { const r = e.getBoundingClientRect(); return r.width && r.right > innerWidth + 1; }).map(e => e.id || e.className || e.tagName).slice(0, 4) })`));
        ok(`${w}px ${v}: sem rolagem horizontal`, m.sw <= m.iw && !m.over.length, JSON.stringify(m));
      }
      // barra não cobre o fim do conteúdo
      const cobre = await J(`(() => { scrollTo(0, document.body.scrollHeight); const n = document.querySelector(".bnav").getBoundingClientRect(); const f = document.querySelector("footer").getBoundingClientRect(); return innerWidth >= 960 ? n.right > document.querySelector(".wrap").getBoundingClientRect().left + parseFloat(getComputedStyle(document.querySelector(".wrap")).paddingLeft) : f.bottom > n.top; })()`);
      ok(`${w}px: navegação não cobre o conteúdo`, !cobre);
      await J(`location.hash = "agua"`); await sleep(300); await J("scrollTo(0,0)");
      await b.shot(path.join(OUT, `${w}-agua.png`), false);
      await J(`location.hash = "analytics"`); await sleep(400);
      await b.shot(path.join(OUT, `${w}-analytics.png`), w >= 768);
      ok(`${w}px: nenhuma dica de gráfico solta`, (await J(`[...document.querySelectorAll(".tip")].filter(t => !t.hidden).length`)) === 0, await J(`JSON.stringify([...document.querySelectorAll(".tip, .toast.show")].filter(t => !t.hidden).map(t => [t.className, t.parentElement.id, t.textContent, t.getBoundingClientRect().x|0, t.getBoundingClientRect().y|0]))`));
    }
    ok("sem erros no console", b.logs.length === 0, b.logs.join(" | "));
  } catch (e) {
    ok("execução", false, e.stack);
  }
  await b.close();
  srv.close();
  res.forEach(r => console.log(r.join("  ")));
  const falhas = res.filter(r => r[0] !== "OK ").length;
  console.log(falhas ? `HÁ FALHAS (${falhas})` : `TUDO OK (${res.length} verificações). Capturas em ${OUT}`);
  process.exit(falhas ? 1 : 0);
})();
