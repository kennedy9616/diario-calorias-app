/* ==========================================================
   Inicialização do app
   Ordem dos scripts (index.html): data → utils → state → storage
   → render → forms → install → app
   ========================================================== */

function initTabs() {
  const buttons = document.querySelectorAll(".tabs button");
  buttons.forEach(b => b.onclick = () => {
    buttons.forEach(x => x.classList.toggle("on", x === b));
    $("tab-food").classList.toggle("hide", b.dataset.tab !== "food");
    $("tab-ex").classList.toggle("hide", b.dataset.tab !== "ex");
  });
}

function initDateNav() {
  $("prev").onclick = () => { cur = addDays(cur, -1); renderAll(); };
  $("next").onclick = () => { if (cur < TODAY) { cur = addDays(cur, 1); renderAll(); } };
}

function init() {
  initStorageMenu();
  initFoodForm();
  initExForm();
  initProfileForm();
  initTabs();
  initDateNav();
  initInstall();

  const hadData = loadSaved();
  ready = true;
  setStatus();
  renderProfile();
  renderAll();

  // primeira vez: abre "Meus dados" para a pessoa preencher peso, altura e idade
  if (!hadData) {
    $("profBox").open = true;
    toast("Bem-vindo! Preencha “Meus dados” no fim da página.", 4000);
  }

  // pede ao sistema para não apagar os dados por falta de espaço
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (_) { /* opcional */ }

  registerServiceWorker();
  restoreFileHandle();
}

init();
