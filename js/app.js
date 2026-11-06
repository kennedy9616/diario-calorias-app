/* ==========================================================
   Inicialização do app
   Ordem dos scripts (index.html): data → utils → ui → state → foods
   → storage → render → forms → body → metas → charts → analytics
   → water → install → nav → app
   ========================================================== */

// Abas Alimentação | Exercícios (padrão ARIA de abas, com setas do teclado)
function initTabs() {
  const tabs = [$("tabBtn-food"), $("tabBtn-ex")];
  const abrir = (b, foco) => {
    tabs.forEach(x => {
      const on = x === b;
      x.classList.toggle("on", on);
      x.setAttribute("aria-selected", String(on));
      x.setAttribute("tabindex", on ? "0" : "-1");
      $(x.getAttribute("aria-controls")).classList.toggle("hide", !on);
    });
    if (foco) b.focus();
  };
  tabs.forEach((b, i) => {
    b.addEventListener("click", () => abrir(b));
    b.addEventListener("keydown", e => {
      const alvo = { ArrowRight: tabs[(i + 1) % tabs.length], ArrowLeft: tabs[(i + tabs.length - 1) % tabs.length], Home: tabs[0], End: tabs[tabs.length - 1] }[e.key];
      if (alvo) { e.preventDefault(); abrir(alvo, true); }
    });
  });
}

function initDateNav() {
  $("prev").onclick = () => { cur = addDays(cur, -1); renderAll(); };
  $("next").onclick = () => { if (cur < TODAY) { cur = addDays(cur, 1); renderAll(); } };
  $("hoje").onclick = () => { cur = TODAY; renderAll(); $("prev").focus(); };
}

// virada do dia com o app aberto: começa um total novo sem apagar o histórico
function verificarDia() {
  if (!atualizarHoje()) return;
  $("mData").max = TODAY;
  $("pNasc").max = TODAY;
  renderAll();
  toast("Novo dia: os totais de hoje começam do zero. O histórico continua salvo.", 4000);
}

/* ---------- Atualização incompleta (cache) ----------
   Se o index.html e os scripts vierem de versões diferentes (cache do navegador
   logo depois de uma publicação), recarrega uma vez buscando tudo de novo. */
function versaoDaPagina() {
  return document.documentElement.getAttribute("data-versao");
}
function versaoConfere() {
  const v = versaoDaPagina();
  if (v === APP_VERSION) return true;
  const chave = "diario-calorias:recarga";
  let tentou = null;
  try { tentou = sessionStorage.getItem(chave); } catch (_) { /* sem sessionStorage */ }
  if (tentou !== APP_VERSION) {
    try { sessionStorage.setItem(chave, APP_VERSION); } catch (_) { /* segue */ }
    const urls = ["./", "index.html"].concat([...document.scripts].map(s => s.src).filter(Boolean), [...document.querySelectorAll('link[rel="stylesheet"]')].map(l => l.href));
    Promise.all(urls.map(u => fetch(u, { cache: "reload" }).catch(() => null))).finally(() => location.reload());
    return false;
  }
  console.warn(`Versões diferentes: página ${v}, scripts ${APP_VERSION}`);
  return true;
}

let iniciado = false;
function init() {
  if (iniciado) return;
  iniciado = true;
  if (!versaoConfere()) return;

  // cada parte inicia mesmo que outra falhe; a navegação vem primeiro
  const falhas = [];
  const etapa = (nome, fn) => { try { fn(); } catch (e) { console.error(nome, e); falhas.push(nome); } };
  etapa("navegação", initNav);
  etapa("menu", initStorageMenu);
  etapa("alimentos", initFoodForm);
  etapa("exercícios", initExForm);
  etapa("perfil", initProfileForm);
  etapa("medidas", initBodyForm);
  etapa("metas", initMetasForm);
  etapa("dia completo", initDiaCompleto);
  etapa("água", initAgua);
  etapa("analytics", initAnalytics);
  etapa("abas", initTabs);
  etapa("datas", initDateNav);
  etapa("instalação", initInstall);

  const hadData = loadSaved();
  ready = true;
  $("appVer").textContent = "Versão " + APP_VERSION + ".";
  etapa("status", setStatus);
  etapa("perfil", renderProfile);
  renderAll();
  showView(view);

  // primeira vez: abre o Perfil para a pessoa preencher os dados
  if (!hadData) {
    corrigirEndereco("perfil");
    showView("perfil");
    toast("Bem-vindo! Preencha seu Perfil para calcular gasto e metas.", 4500);
  }
  if (falhas.length) toast("Parte do app não carregou (" + falhas.join(", ") + "). Recarregue a página.", 6000);

  // virada do dia: ao voltar para o app e a cada minuto
  document.addEventListener("visibilitychange", () => { if (!document.hidden) verificarDia(); });
  window.addEventListener("focus", verificarDia);
  setInterval(verificarDia, 60000);

  // gráficos acompanham a largura da tela (só a largura: o teclado do celular muda a altura)
  let rt, largura = window.innerWidth;
  window.addEventListener("resize", () => {
    if (window.innerWidth === largura) return;
    largura = window.innerWidth;
    clearTimeout(rt); rt = setTimeout(() => showView(view), 200);
  });

  // base completa de alimentos (~2 MB): carrega depois que a tela já apareceu
  const carregarBase = () => loadFoodBase(onFoodBaseChange);
  if (window.requestIdleCallback) requestIdleCallback(carregarBase, { timeout: 1500 });
  else setTimeout(carregarBase, 200);

  // pede ao sistema para não apagar os dados por falta de espaço
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (_) { /* opcional */ }

  registerServiceWorker();
  restoreFileHandle();
}

init();
