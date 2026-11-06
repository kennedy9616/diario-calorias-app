/* ==========================================================
   Navegação: Água | Calorias | Analytics | Perfil
   - Cada destino é um link (#agua, #calorias, #analytics, #perfil):
     voltar, avançar, recarregar e favoritos funcionam sem servidor
     (o endereço com # funciona em qualquer subpasta do GitHub Pages).
   - Endereços antigos (#historico) abrem o Perfil.
   - A seção aberta é marcada com aria-current="page".
   ========================================================== */

const VIEWS = ["agua", "calorias", "analytics", "perfil"];
const VIEW_NOME = { agua: "Água", calorias: "Calorias", analytics: "Analytics", perfil: "Perfil" };
const VIEW_ALIAS = { historico: "perfil" };
const DEFAULT_VIEW = "calorias";
const DAY_VIEWS = ["agua", "calorias"];   // seções que usam o seletor de dia

let view = DEFAULT_VIEW;

function viewFromHash(h) {
  let v = String(h == null ? "" : h).replace(/^#\/?/, "").toLowerCase();
  v = VIEW_ALIAS[v] || v;
  return VIEWS.includes(v) ? v : DEFAULT_VIEW;
}

// mostra a seção; foco = leva o foco para o título dela (troca feita pelo usuário)
function showView(v, { foco = false } = {}) {
  view = VIEWS.includes(v) ? v : DEFAULT_VIEW;
  VIEWS.forEach(k => {
    const on = k === view;
    $("view-" + k).classList.toggle("hide", !on);
    const b = $("nav-" + k);
    b.classList.toggle("on", on);
    if (on) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
  });
  $("datenav").classList.toggle("hide", !DAY_VIEWS.includes(view));
  try { document.title = VIEW_NOME[view] + " · Diário de Calorias"; } catch (_) { /* sem document.title nos testes */ }
  // gráficos medem a largura da tela: redesenha ao mostrar a seção
  if (ready) {
    try {
      if (view === "analytics") renderAnalytics();
      else if (view === "perfil") renderPerfil();
      else if (view === "agua") renderAgua();
      else renderChart();
    } catch (e) { console.error(e); }
  }
  if (foco) {
    const h = $("view-" + view).querySelector("h2");
    if (h && h.focus) { h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: true }); }
  }
}

// endereço canônico (sem criar entrada nova no histórico)
function corrigirEndereco(v) {
  if (location.hash === "#" + v) return;
  try { history.replaceState(null, "", "#" + v); } catch (_) { /* file:// antigo: segue sem corrigir */ }
}

// abre uma seção pelo código (cria entrada no histórico, como um clique no link)
function irPara(v) {
  if (location.hash === "#" + v) showView(v);
  else location.hash = v;
}

let navIniciada = false;
function initNav() {
  if (navIniciada) return;
  navIniciada = true;
  VIEWS.forEach(k => {
    $("nav-" + k).addEventListener("click", e => {
      if (view === k && location.hash === "#" + k) { e.preventDefault(); window.scrollTo(0, 0); }   // tocar na aba aberta volta ao topo
    });
  });
  window.addEventListener("hashchange", () => {
    const v = viewFromHash(location.hash);
    corrigirEndereco(v);
    showView(v, { foco: true });
    window.scrollTo(0, 0);
  });
  const v = viewFromHash(location.hash);
  if (location.hash) corrigirEndereco(v);
  showView(v);
}
