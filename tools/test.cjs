// Roda todos os testes de tests/*.test.cjs (node:test, sem dependências).
// Uso: node tools/test.cjs   (ou sh tools/run-tests.sh, que acha o Node sozinho)
const fs = require("node:fs");
const path = require("node:path");

const dir = path.join(__dirname, "..", "tests");
const files = fs.readdirSync(dir).filter(f => f.endsWith(".test.cjs")).sort();
if (!files.length) { console.error("Nenhum teste em tests/."); process.exit(1); }
for (const f of files) require(path.join(dir, f));
