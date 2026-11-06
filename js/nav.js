/* ==========================================================
   Navegação inferior: Água | Calorias | Analytics | Histórico
   A aba aberta fica no endereço (#agua, #calorias...), então
   recarregar a página volta para a mesma aba.
   ========================================================== */

const VIEWS = ["agua", "calorias", "analytics", "historico"];
const DEFAULT_VIEW = "calorias";
const DAY_VIEWS = ["agua", "calorias", "analytics"];   // abas que usam o seletor de dia

let view = DEFAULT_VIEW;

function viewFromHash(h) {
  const v = String(h == null ? "" : h).replace(/^#\/?/, "").toLowerCase();
  return VIEWS.includes(v) ? v : DEFAULT_VIEW;
}

function showView(v, { updateHash = true } = {}) {
  view = VIEWS.includes(v) ? v : DEFAULT_VIEW;
  VIEWS.forEach(k => {
    const on = k === view;
    $("view-" + k).classList.toggle("hide", !on);
    const b = $("nav-" + k);
    b.classList.toggle("on", on);
    if (on) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
  });
  $("datenav").classList.toggle("hide", !DAY_VIEWS.includes(view));
  if (updateHash && location.hash !== "#" + view) {
    try { history.replaceState(null, "", "#" + view); } catch (_) { location.hash = view; }
  }
}

function initNav() {
  VIEWS.forEach(k => {
    $("nav-" + k).onclick = () => {
      if (view === k) { window.scrollTo(0, 0); return; }   // tocar na aba aberta volta ao topo
      showView(k);
      window.scrollTo(0, 0);
    };
  });
  window.addEventListener("hashchange", () => showView(viewFromHash(location.hash), { updateHash: false }));
  showView(viewFromHash(location.hash), { updateHash: false });
}
