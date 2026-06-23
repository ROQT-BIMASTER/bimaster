#!/usr/bin/env node
// scripts/audit/list-edge.mjs
// Audit-only. Inventaria supabase/functions/* (sem _shared).
import { readdirSync, readFileSync, writeFileSync, mkdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";

const ROOT = "supabase/functions";
const OUT = "docs/audit/2026-Q2/generated/EDGE_FUNCTIONS.snapshot.md";

const dirs = readdirSync(ROOT).filter((d) => {
  if (d.startsWith("_")) return false;
  try {
    return statSync(join(ROOT, d)).isDirectory();
  } catch {
    return false;
  }
});

const rows = [];
const flags = { authNone: 0, rateZero: 0, requireMfa: 0, requireStepUp: 0 };

for (const name of dirs.sort()) {
  const idx = join(ROOT, name, "index.ts");
  let src = "";
  try {
    src = readFileSync(idx, "utf8");
  } catch {
    rows.push({ name, exists: false });
    continue;
  }
  const auth = /auth:\s*"(none|jwt|apikey|any)"/.exec(src)?.[1] ?? "?";
  const rl = /rateLimit:\s*(\d+)/.exec(src)?.[1] ?? "?";
  const mfa = /requireMfa:\s*true/.test(src);
  const step = /requireStepUp:\s*"([^"]+)"/.exec(src)?.[1] ?? null;
  if (auth === "none") flags.authNone++;
  if (rl === "0") flags.rateZero++;
  if (mfa) flags.requireMfa++;
  if (step) flags.requireStepUp++;
  rows.push({ name, exists: true, auth, rl, mfa, step });
}

const lines = [];
lines.push("# EDGE FUNCTIONS — snapshot gerado");
lines.push("");
lines.push("> Gerado por `scripts/audit/list-edge.mjs`. Não editar à mão.");
lines.push("");
lines.push("## Totais");
lines.push("");
lines.push(`- Funções: **${rows.length}**`);
lines.push(`- \`auth: "none"\`: **${flags.authNone}**`);
lines.push(`- \`rateLimit: 0\`: **${flags.rateZero}**`);
lines.push(`- \`requireMfa: true\`: **${flags.requireMfa}**`);
lines.push(`- \`requireStepUp\`: **${flags.requireStepUp}**`);
lines.push("");
lines.push("## Inventário");
lines.push("");
lines.push("| Função | auth | rateLimit | MFA | step-up |");
lines.push("| --- | --- | ---: | :-: | --- |");
for (const r of rows) {
  if (!r.exists) {
    lines.push(`| \`${r.name}\` | — | — | — | _sem index.ts_ |`);
    continue;
  }
  lines.push(
    `| \`${r.name}\` | ${r.auth} | ${r.rl} | ${r.mfa ? "✓" : ""} | ${r.step ?? ""} |`,
  );
}
lines.push("");

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, lines.join("\n"));
console.log(
  `wrote ${OUT}: ${rows.length} funcs, auth:none=${flags.authNone}, rl:0=${flags.rateZero}`,
);
