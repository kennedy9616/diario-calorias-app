// Barra de navegação inferior: 4 abas [Água | Calorias | Analytics | Histórico].
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { html, read, loadApp } = require("./helpers.cjs");

const ABAS = [["agua", "Água"], ["calorias", "Calorias"], ["analytics", "Analytics"], ["historico", "Histórico"]];

// view (<main id="view-x">) que contém o elemento com esse id
function viewOf(id) {
  const at = html.indexOf(`id="${id}"`);
  assert.ok(at >= 0, `id ausente: ${id}`);
  for (const [k] of ABAS) {
    const start = html.indexOf(`<main id="view-${k}"`);
    const end = html.indexOf("</main>", start);
    if (start >= 0 && at > start && at < end) return k;
  }
  return null;
}

test("HTML tem a barra inferior com as 4 abas, nessa ordem", () => {
  const nav = html.slice(html.indexOf('<nav class="bnav"'), html.indexOf("</nav>"));
  assert.ok(nav.length > 0, "barra .bnav ausente");
  const ids = [...nav.matchAll(/id="nav-([a-z]+)"/g)].map(m => m[1]);
  assert.deepEqual(ids, ABAS.map(a => a[0]));
  for (const [k, label] of ABAS) {
    assert.match(nav, new RegExp(`id="nav-${k}"[^>]*>[\\s\\S]*?<span>${label}</span>`), `rótulo ${label}`);
    assert.ok(html.includes(`<main id="view-${k}"`), `view-${k} ausente`);
  }
});

test("conteúdo existente fica na aba certa", () => {
  assert.equal(viewOf("balance"), "calorias");
  assert.equal(viewOf("foodName"), "calorias");
  assert.equal(viewOf("exType"), "calorias");
  assert.equal(viewOf("chart"), "analytics");
  assert.equal(viewOf("profBox"), "historico");
});

test("viewFromHash aceita só abas conhecidas e cai em Calorias", () => {
  const { run } = loadApp();
  assert.equal(run('viewFromHash("#agua")'), "agua");
  assert.equal(run('viewFromHash("#/historico")'), "historico");
  assert.equal(run('viewFromHash("#ANALYTICS")'), "analytics");
  assert.equal(run('viewFromHash("")'), "calorias");
  assert.equal(run('viewFromHash("#nada")'), "calorias");
  assert.equal(run("viewFromHash(undefined)"), "calorias");
});

test("showView mostra só a aba escolhida, marca o botão e atualiza o endereço", () => {
  const app = loadApp();
  app.run('showView("agua")');
  for (const [k] of ABAS) {
    assert.equal(app.el("view-" + k).classList.contains("hide"), k !== "agua", `view-${k}`);
    assert.equal(app.el("nav-" + k).classList.contains("on"), k === "agua", `nav-${k}`);
    assert.equal(app.el("nav-" + k).getAttribute("aria-current"), k === "agua" ? "page" : null);
  }
  assert.equal(app.location.hash, "#agua");
  assert.equal(app.run("view"), "agua");
  app.run('showView("inexistente")');
  assert.equal(app.run("view"), "calorias");
});

test("seletor de dia aparece nas abas diárias e some no Histórico", () => {
  const app = loadApp();
  app.run('showView("historico")');
  assert.ok(app.el("datenav").classList.contains("hide"));
  app.run('showView("agua")');
  assert.ok(!app.el("datenav").classList.contains("hide"));
});

test("initNav abre a aba do endereço e troca ao tocar nos botões", () => {
  const app = loadApp({ hash: "#historico" });
  app.run("initNav()");
  assert.equal(app.run("view"), "historico");
  app.el("nav-agua").click();
  assert.equal(app.run("view"), "agua");
});

test("CSS fixa a barra embaixo respeitando a área segura do celular", () => {
  const css = read("css/style.css");
  const rule = css.slice(css.indexOf(".bnav {"), css.indexOf("}", css.indexOf(".bnav {")));
  assert.match(rule, /position:\s*fixed/);
  assert.match(rule, /bottom:\s*0/);
  assert.match(rule, /safe-area-inset-bottom/);
});
