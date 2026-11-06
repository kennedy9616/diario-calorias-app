// Publicação no GitHub Pages: a 1.2.0 quebrou porque o index.html novo carregou CSS e JS antigos
// do cache do navegador (Cache-Control: max-age=600, mesmos endereços). Estes testes impedem a volta.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { read, html, loadApp } = require("./helpers.cjs");

const versao = loadApp().run("APP_VERSION");
const sw = read("sw.js");

test("todo CSS e JS do app no index.html tem ?v= igual à versão do app", () => {
  const locais = [...html.matchAll(/(?:src|href)="((?:css|js)\/[^"]+)"/g)].map(m => m[1]);
  assert.ok(locais.length >= 17, "css + scripts");
  for (const u of locais) assert.match(u, new RegExp(`\\?v=${versao.replace(/\./g, "\\.")}$`), u);
  assert.match(html, new RegExp(`<html lang="pt-BR" data-versao="${versao.replace(/\./g, "\\.")}">`));
});

test("a base de alimentos também é pedida com a versão no endereço", () => {
  assert.match(read("js/foods.js"), /data\/alimentos-base\.js\?v=" \+ APP_VERSION/);
});

test("service worker: cópia offline sem cache HTTP, página sempre revalidada, uma cópia por arquivo", () => {
  assert.match(sw, /new Request\(u, \{ cache: "reload" \}\)/);
  assert.match(sw, /req\.mode === "navigate" \? new Request\(req, \{ cache: "no-cache" \}\)/);
  assert.match(sw, /url\.origin \+ url\.pathname/);
  assert.match(sw, /ignoreSearch: true/);
  assert.doesNotMatch(sw, /"diario-calorias-v9"/, "CACHE novo para os arquivos novos");
});

test("app.js confere a versão da página e dos scripts antes de iniciar (recarrega uma vez)", () => {
  const app = read("js/app.js");
  assert.match(app, /data-versao/);
  assert.match(app, /cache: "reload"/);
  assert.match(app, /sessionStorage/);
});

test("navegação por # funciona em subpasta (GitHub Pages) e o manifest abre o app na pasta dele", () => {
  const man = JSON.parse(read("manifest.webmanifest"));
  assert.equal(man.start_url, "./");
  assert.equal(man.scope, "./");
  assert.doesNotMatch(html, /(?:src|href)="\/(?!\/)/, "nenhum caminho absoluto a partir da raiz do domínio");
  assert.doesNotMatch(read("js/nav.js"), /pushState|location\.pathname/, "sem rotas que dependam do servidor");
});

// service worker rodando numa VM com cache e rede falsos
function swFalso({ online = true } = {}) {
  const vm = require("node:vm");
  const ouvintes = {}, cache = new Map(), pedidos = [];
  class Req { constructor(i, init = {}) { this.url = new URL(typeof i === "string" ? i : i.url, "https://x.github.io/app/").href; this.mode = i.mode || "cors"; this.method = "GET"; this.cache = init.cache || i.cache || "default"; } }
  const resp = url => ({ ok: true, type: "basic", url, clone() { return this; } });
  const ctx = vm.createContext({
    URL, Promise, console,
    location: { origin: "https://x.github.io" },
    Request: Req, Response: { error: () => ({ erro: true }) },
    fetch: r => { pedidos.push(r); return online ? Promise.resolve(resp(r.url)) : Promise.reject(new TypeError("offline")); },
    caches: {
      open: () => Promise.resolve({
        addAll: rs => { rs.forEach(r => cache.set(r.url, { r, res: resp(r.url) })); return Promise.resolve(); },
        put: (k, res) => { cache.set(typeof k === "string" ? k : k.url, { res }); return Promise.resolve(); },
        match: k => Promise.resolve((cache.get(k.url || k) || {}).res)
      }),
      keys: () => Promise.resolve([]),
      match: (k, o) => {
        const u = new URL(typeof k === "string" ? k : k.url, "https://x.github.io/app/");
        const chave = o && o.ignoreSearch ? u.origin + u.pathname : u.href;
        return Promise.resolve((cache.get(chave) || {}).res);
      }
    }
  });
  ctx.self = Object.assign(ctx, { addEventListener: (t, f) => { ouvintes[t] = f; }, skipWaiting() {}, clients: { claim() {} } });
  vm.runInContext(sw, ctx);
  const disparar = (tipo, req) => new Promise(ok => {
    let p = null;
    ouvintes[tipo]({ request: req, waitUntil: x => { p = x; }, respondWith: x => { p = x; } });
    Promise.resolve(p).then(ok);
  });
  return { disparar, cache, pedidos };
}

test("service worker: instala sem cache HTTP, revalida a página e guarda cada arquivo sem a ?v=", async () => {
  const s = swFalso();
  await s.disparar("install");
  const instalados = [...s.cache.values()].map(v => v.r);
  assert.ok(instalados.length >= 20);
  assert.ok(instalados.every(r => r.cache === "reload"), "cópia offline vem direto da rede");
  const nav = await s.disparar("fetch", { method: "GET", url: "https://x.github.io/app/#agua", mode: "navigate" });
  assert.equal(s.pedidos.at(-1).cache, "no-cache", "página revalidada");
  assert.ok(nav.ok);
  await s.disparar("fetch", { method: "GET", url: "https://x.github.io/app/js/app.js?v=9.9.9", mode: "no-cors" });
  assert.ok(s.cache.has("https://x.github.io/app/js/app.js"), "guarda sem a ?v=");
  assert.ok(![...s.cache.keys()].some(k => k.includes("?v=")));
});

test("service worker offline: arquivo versionado sai da cópia guardada; página cai no index.html", async () => {
  const on = swFalso();
  await on.disparar("install");
  const s = swFalso({ online: false });
  on.cache.forEach((v, k) => s.cache.set(k, v));
  const js = await s.disparar("fetch", { method: "GET", url: "https://x.github.io/app/js/nav.js?v=1.2.0", mode: "no-cors" });
  assert.equal(js.url, "https://x.github.io/app/js/nav.js");
  const pag = await s.disparar("fetch", { method: "GET", url: "https://x.github.io/app/", mode: "navigate" });
  assert.ok(pag && pag.ok);
});
