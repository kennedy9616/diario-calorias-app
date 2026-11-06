// Servidor estático que imita o GitHub Pages: app em /diario-calorias-app/, Cache-Control: max-age=600.
const http = require("node:http"), fs = require("node:fs"), path = require("node:path");
const TIPOS = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".json": "application/json",
  ".png": "image/png", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml" };
const BASE = "/diario-calorias-app/";

function servir(raiz, porta) {
  return new Promise(ok => {
    const srv = http.createServer((req, res) => {
      const u = decodeURIComponent(new URL(req.url, "http://x").pathname);
      if (!u.startsWith(BASE)) { res.writeHead(404); return res.end("404"); }
      let p = path.join(raiz, u.slice(BASE.length) || "index.html");
      if (!p.startsWith(raiz)) { res.writeHead(403); return res.end(); }
      if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, "index.html");
      if (!fs.existsSync(p)) { res.writeHead(404); return res.end("404"); }
      res.writeHead(200, { "Content-Type": TIPOS[path.extname(p)] || "application/octet-stream", "Cache-Control": "max-age=600" });
      fs.createReadStream(p).pipe(res);
    }).listen(porta, "127.0.0.1", () => ok(srv));
  });
}
module.exports = { servir, BASE };
