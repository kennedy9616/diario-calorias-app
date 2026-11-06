/* ==========================================================
   Instalação como app (ícone na tela inicial) e uso sem internet
   - Android / Chrome / Edge / Samsung Internet: botão "Instalar".
   - iPhone / iPad: o Safari não tem botão automático, então
     mostramos como fazer pelo menu Compartilhar.
   ========================================================== */

const INSTALL_DISMISS_KEY = "diario-calorias:instalar-dispensado";
let installPrompt = null; // evento guardado para abrir o pedido de instalação depois

// ícone de "Compartilhar" do iPhone (quadrado com seta para cima)
const IOS_SHARE_ICON = '<svg class="ios-share" viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">'
  + '<path d="M8 10H6v11h12V10h-2M12 3v12M8.5 6.5 12 3l3.5 3.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function installDismissed() {
  try { return localStorage.getItem(INSTALL_DISMISS_KEY) === "1"; } catch (_) { return false; }
}

function showInstallUI() {
  const can = !STANDALONE && (installPrompt || IOS);
  $("mInstall").classList.toggle("hide", !can);

  const bar = $("installBar");
  if (!can || installDismissed()) { bar.classList.add("hide"); return; }
  if (installPrompt) {
    $("installTxt").textContent = "Abra pelo ícone na tela inicial, como um app, e use até sem internet.";
    $("installBtn").classList.remove("hide");
  } else {
    $("installTxt").innerHTML = `Toque em <b>Compartilhar</b> ${IOS_SHARE_ICON} e depois em <b>Adicionar à Tela de Início</b>.`;
    $("installBtn").classList.add("hide");
  }
  bar.classList.remove("hide");
}

async function promptInstall() {
  if (installPrompt) {
    const ev = installPrompt;
    installPrompt = null; // o pedido só pode ser usado uma vez
    ev.prompt();
    try { await ev.userChoice; } catch (_) { /* usuário fechou */ }
    showInstallUI();
    return;
  }
  if (IOS) {
    toast("Toque em Compartilhar e depois em “Adicionar à Tela de Início”.", 6000);
  }
}

function initInstall() {
  $("installBtn").onclick = promptInstall;
  $("mInstall").onclick = () => { closeMenu(); promptInstall(); };
  $("installClose").onclick = () => {
    try { localStorage.setItem(INSTALL_DISMISS_KEY, "1"); } catch (_) { /* sem armazenamento */ }
    $("installBar").classList.add("hide");
    toast("Para instalar depois, use o botão no topo da página, à direita.", 3600);
  };
  showInstallUI();
}

// o navegador avisa que o app pode ser instalado
window.addEventListener("beforeinstallprompt", e => {
  e.preventDefault(); // usamos a nossa faixa no lugar da barra padrão
  installPrompt = e;
  showInstallUI();
});

window.addEventListener("appinstalled", () => {
  installPrompt = null;
  showInstallUI();
  toast("App instalado! Procure o ícone “Calorias” na tela inicial.", 4000);
});

// guarda os arquivos no aparelho para abrir sem internet (precisa de https)
function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  const secure = location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1";
  if (!secure) return;
  navigator.serviceWorker.register("sw.js").catch(e => console.error(e));
}
