#!/usr/bin/env node
// Roda tsc com tsconfig.strict.json (strictNullChecks em src/lib/**) e filtra
// a saída para apenas erros dentro de src/lib. Imports transitivos para fora
// de src/lib são propositalmente ignorados — as outras pastas serão cobertas
// em fases futuras (src/hooks, src/contexts, src/components).
//
// Falha (exit 1) somente se houver erro em arquivo de src/lib.

import { spawnSync } from "node:child_process";

const result = spawnSync(
  "npx",
  ["tsc", "-p", "tsconfig.strict.json", "--noEmit"],
  { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
);

const output = (result.stdout || "") + (result.stderr || "");
const lines = output.split("\n");

const libErrors = lines.filter((l) => /^src\/lib\//.test(l));

if (libErrors.length === 0) {
  console.log("typecheck:strict OK — sem erros em src/lib/**.");
  process.exit(0);
}

console.error("typecheck:strict falhou em src/lib/**:\n");
console.error(libErrors.join("\n"));
console.error(`\n${libErrors.length} linha(s) de erro em src/lib.`);
process.exit(1);
