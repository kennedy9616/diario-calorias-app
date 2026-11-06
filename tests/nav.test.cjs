// Navegação principal: 4 destinos [Água | Calorias | Analytics | Perfil], links com # (voltar/avançar/recarregar).
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { html, read, loadApp } = require("./helpers.cjs");

const ABAS = [["agua", "Água"], ["calorias", "Calorias"], ["analytics", "Analytics"], ["perfil", "Perfil"]];
const nav = html.slice(html.indexOf('<nav class="bnav"'), html.indexOf("</nav>"));

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

test("barra de navegação: 4 links, nessa ordem, cada um com # do destino e rótulo visível", () => {
  assert.ok(nav.length > 0, "barra .bnav ausente");
  const links = [...nav.matchAll(/<a href="#([a-z]+)" id="nav-([a-z]+)"/g)];
  assert.deepEqual(links.map(m => m[2]), ABAS.map(a => a[0]));
  links.forEach(m => assert.equal(m[1], m[2], "href aponta para o próprio destino"));
  for (const [k, label] of ABAS) {
    assert.match(nav, new RegExp(`id="nav-${k}"[^>]*>[\\s\\S]*?<span>${label}</span>`), `rótulo ${label}`);
    assert.ok(html.includes(`<main id="view-${k}"`), `view-${k} ausente`);
  }
  assert.doesNotMatch(nav, /Histórico|<button/, "sem 'Histórico' e sem <button> (o estilo padrão de botão deixava a barra branca)");
  assert.ok(!html.includes('id="view-historico"'));
});

test("ícones da navegação são decorativos e de mesmo tamanho (nome acessível vem do texto)", () => {
  const svgs = [...nav.matchAll(/<svg[^>]*>/g)].map(m => m[0]);
  assert.equal(svgs.length, 4);
  svgs.forEach(s => {
    assert.match(s, /class="ico"/);
    assert.match(s, /aria-hidden="true"/);
    assert.match(s, /focusable="false"/);
    assert.match(s, /viewBox="0 0 24 24"/);
  });
});

test("conteúdo fica na seção certa: histórico corporal e metas dentro de Perfil", () => {
  assert.equal(viewOf("balance"), "calorias");
  assert.equal(viewOf("foodName"), "calorias");
  assert.equal(viewOf("exType"), "calorias");
  assert.equal(viewOf("anNutri"), "calorias");
  assert.equal(viewOf("aguaCopo"), "agua");
  assert.equal(viewOf("aguaFig"), "agua");
  assert.equal(viewOf("anKpis"), "analytics");
  assert.equal(viewOf("anPeriodo"), "analytics");
  for (const id of ["perfilForm", "pNome", "pAlt", "pObjetivo", "medidaList", "pesoChart", "tmbVal", "mtKOrigem", "aguaMetaOrigem", "metasHist", "pCopo"]) {
    assert.equal(viewOf(id), "perfil", id);
  }
});

test("viewFromHash aceita só destinos conhecidos; #historico (endereço antigo) abre o Perfil", () => {
  const { run } = loadApp();
  assert.equal(run('viewFromHash("#agua")'), "agua");
  assert.equal(run('viewFromHash("#/perfil")'), "perfil");
  assert.equal(run('viewFromHash("#historico")'), "perfil");
  assert.equal(run('viewFromHash("#ANALYTICS")'), "analytics");
  assert.equal(run('viewFromHash("")'), "calorias");
  assert.equal(run('viewFromHash("#nada")'), "calorias");
  assert.equal(run("viewFromHash(undefined)"), "calorias");
});

test("showView mostra só a seção escolhida e marca o link com aria-current", () => {
  const app = loadApp();
  app.run('showView("agua")');
  for (const [k] of ABAS) {
    assert.equal(app.el("view-" + k).classList.contains("hide"), k !== "agua", `view-${k}`);
    assert.equal(app.el("nav-" + k).classList.contains("on"), k === "agua", `nav-${k}`);
    assert.equal(app.el("nav-" + k).getAttribute("aria-current"), k === "agua" ? "page" : null);
  }
  assert.equal(app.run("view"), "agua");
  app.run('showView("inexistente")');
  assert.equal(app.run("view"), "calorias");
});

test("seletor de dia aparece em Água e Calorias; some em Analytics (tem filtro de período) e Perfil", () => {
  const app = loadApp();
  for (const [k, on] of [["perfil", false], ["analytics", false], ["agua", true], ["calorias", true]]) {
    app.run(`showView("${k}")`);
    assert.equal(!app.el("datenav").classList.contains("hide"), on, k);
  }
});

test("initNav abre a seção do endereço, corrige #historico para #perfil e segue o hashchange", () => {
  const app = loadApp({ hash: "#historico" });
  app.run("initNav()");
  assert.equal(app.run("view"), "perfil");
  assert.equal(app.location.hash, "#perfil");
  app.run("location.hash = '#agua'; __hashchange()");
  assert.equal(app.run("view"), "agua");
  app.run("initNav()");   // de novo: não duplica listeners
  assert.equal(app.run("__hashListeners()"), 1);
});

test("CSS: barra fixa embaixo com área segura, coluna lateral em tela larga, sem estilo padrão de botão", () => {
  const css = read("css/style.css");
  const rule = css.slice(css.indexOf(".bnav {"), css.indexOf("}", css.indexOf(".bnav {")));
  assert.match(rule, /position:\s*fixed/);
  assert.match(rule, /bottom:\s*0/);
  assert.match(rule, /safe-area-inset-bottom/);
  assert.match(css, /\.wrap \{[\s\S]*?var\(--nav-h\)[\s\S]*?safe-area-inset-bottom/, "conteúdo reserva espaço para a barra");
  assert.match(css, /\.bnav a\[aria-current="page"\]/);
  assert.match(css, /\.bnav a \.ico \{[^}]*width:\s*24px;[^}]*height:\s*24px/);
  assert.match(css, /@media \(min-width: 960px\)[\s\S]*\.bnav \{[\s\S]*?width: var\(--rail\)/);
  assert.match(css, /color-scheme:\s*light dark/, "controles nativos seguem o tema escuro");
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /:focus-visible/);
});
