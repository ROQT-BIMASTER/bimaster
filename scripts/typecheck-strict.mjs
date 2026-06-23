#!/usr/bin/env node
// Roda tsc com tsconfig.strict.json (strictNullChecks em src/lib/** e src/utils/**)
// e filtra a saída para apenas erros dentro dessas pastas. Imports transitivos
// para fora são propositalmente ignorados — as outras pastas serão cobertas
// em fases futuras (src/hooks, src/contexts, src/components).
//
// Falha (exit 1) somente se houver erro em arquivo de src/lib ou src/utils.

import { spawnSync } from "node:child_process";

const COVERED = /^src\/(lib|utils)\//;

const result = spawnSync(
  "npx",
  ["tsc", "-p", "tsconfig.strict.json", "--noEmit"],
  { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
);

const output = (result.stdout || "") + (result.stderr || "");
const lines = output.split("\n");

const errors = lines.filter((l) => COVERED.test(l));

if (errors.length === 0) {
  console.log("typecheck:strict OK — sem erros em src/lib/** e src/utils/**.");
  process.exit(0);
}

console.error("typecheck:strict falhou:\n");
console.error(errors.join("\n"));
console.error(`\n${errors.length} linha(s) de erro.`);
process.exit(1);

