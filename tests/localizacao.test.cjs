// Hotfix 1.1.1: nomes em português, originais preservados e nutrientes intactos.
const { test } = require("node:test");

test("localização da base (tools/check-localization.cjs)", () => {
  require("../tools/check-localization.cjs");
});
