// A localização não pode mudar a composição da base publicada na v1.1.0.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const vm = require("node:vm");
const root = path.join(__dirname, "..");
const data = JSON.parse(fs.readFileSync(path.join(root, "data/alimentos_unificados.json"), "utf8"));
const hash = value => crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
assert.equal(data.alimentos.length, 13822);
assert.equal(data.alimentos.filter(a => a.idioma_original === "en").length, 13225);
for (const food of data.alimentos) {
  assert.equal(food.idioma, "pt-BR", food.id);
  assert.ok(food.nome.trim(), food.id);
  assert.ok(!/[▁\uFFFD]/.test(food.nome), `Nome inválido: ${food.id}`);
  if (food.fonte_id.startsWith("usda")) assert.ok(food.nome_original, food.id);
}
// Estes hashes registram os dados originais. Atualizações nutricionais futuras
// devem revisar explicitamente esta referência; traduções não devem alterá-la.
assert.equal(hash(data.alimentos.map(({ nome, idioma, nome_original, idioma_original, ...a }) => a)),
  "4c76c3c816b814750eb326267bb9bbccdd45511fc66a619552c96eca4fe4d566");
assert.equal(hash(data.alimentos.map(a => [a.id, a.nome_original || a.nome, a.idioma_original || a.idioma])),
  "2534fb4fd7e72a4f3be7ee27004785c3074162a1ef5c0c5f81e4daf7abc66014");
const byOriginal = original => data.alimentos.find(a => a.nome_original === original);
assert.equal(byOriginal("Corn dog").nome, "Salsicha empanada em massa de milho no palito");
assert.equal(byOriginal("Baby Toddler beef").nome, "Carne bovina para bebês e crianças pequenas");
assert.equal(byOriginal("Tuna noodle casserole with vegetables and mushroom sauce").nome,
  "Macarrão de forno com atum, vegetais e molho de cogumelos");
const generated = { self: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, "data/alimentos-base.js"), "utf8"), generated);
const names = new Map(data.alimentos.map(a => [a.id, a.nome]));
for (const item of generated.self.ALIMENTOS_BASE.itens) {
  if (names.has(item[0])) assert.equal(item[1], names.get(item[0]), `Nome desatualizado: ${item[0]}`);
}
console.log("OK: nomes em português, originais preservados e dados nutricionais intactos.");
