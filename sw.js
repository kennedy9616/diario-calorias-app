// Service worker: guarda o app no aparelho para abrir sem internet.
// Arquivos do app: busca primeiro a versão nova na rede; sem rede, usa a cópia guardada.
// Fonte (Google Fonts): usa a cópia guardada; só baixa da rede na primeira vez.
//
// Ao adicionar ou renomear arquivos do app, atualize a lista FILES e
// aumente o número da versão em CACHE.

const CACHE = "diario-calorias-v6";
const FONT_CACHE = "diario-calorias-fontes-v1";
const FILES = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/style.css",
  "./js/data.js",
  "./js/utils.js",
  "./js/state.js",
  "./js/foods.js",
  "./js/storage.js",
  "./js/render.js",
  "./js/forms.js",
  "./js/body.js",
  "./js/install.js",
  "./js/nav.js",
  "./js/app.js",
  "./data/alimentos-base.js",
  "./icons/apple-touch-icon.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png"
];
const FONT_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== FONT_CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // fonte: cache primeiro
  if (FONT_HOSTS.includes(url.hostname)) {
    e.respondWith(
      caches.open(FONT_CACHE).then(c =>
        c.match(req).then(hit => hit || fetch(req).then(res => {
          if (res.ok || res.type === "opaque") c.put(req, res.clone());
          return res;
        }))
      )
    );
    return;
  }

  if (url.origin !== location.origin) return;

  // arquivos do app: rede primeiro, cópia guardada se estiver sem internet
  e.respondWith(
    fetch(req)
      .then(res => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      })
      .catch(() =>
        caches.match(req, { ignoreSearch: true })
          .then(r => r || (req.mode === "navigate" ? caches.match("./index.html") : Response.error()))
      )
  );
});
