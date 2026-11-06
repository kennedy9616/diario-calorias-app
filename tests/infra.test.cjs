// Estrutura do app: scripts, HTML, service worker e JSON.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { root, read, html, scripts } = require("./helpers.cjs");

const source = scripts.map(read).join("\n");
const sw = read("sw.js");

test("scripts do index.html compilam juntos, sem colisão de globais", () => {
  assert.ok(scripts.length > 0);
  new vm.Script(source);
  new vm.Script(sw);
});

test("todo $(\"id\") usado nos scripts existe no HTML", () => {
  const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]));
  for (const [, id] of source.matchAll(/\$\("([^"]+)"\)/g)) {
    assert.ok(ids.has(id), `Elemento ausente no HTML: ${id}`);
  }
});

test("ids do HTML são únicos", () => {
  const seen = new Set();
  for (const [, id] of html.matchAll(/\bid="([^"]+)"/g)) {
    assert.ok(!seen.has(id), `id repetido: ${id}`);
    seen.add(id);
  }
});

test("service worker guarda todos os scripts e só lista arquivos existentes", () => {
  for (const file of scripts) assert.ok(sw.includes(`"./${file}"`), `Sem cache: ${file}`);
  for (const [, file] of sw.matchAll(/"\.\/([^"]+)"/g)) {
    assert.ok(fs.existsSync(path.join(root, file)), `Arquivo ausente: ${file}`);
  }
});

test("JSON versionados são válidos", () => {
  for (const file of ["manifest.webmanifest", "data/alimentos_usuario.json"]) JSON.parse(read(file));
});
