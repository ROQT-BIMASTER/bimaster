#!/usr/bin/env node
// scripts/audit/list-routes.mjs
// Audit-only. Reads src/App.tsx, emits docs/audit/2026-Q2/generated/ROUTES.snapshot.md
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const SRC = "src/App.tsx";
const OUT = "docs/audit/2026-Q2/generated/ROUTES.snapshot.md";

const txt = readFileSync(SRC, "utf8");
const paths = [...txt.matchAll(/path="([^"]+)"/g)].map((m) => m[1]);
const unique = [...new Set(paths)].sort();

const total = paths.length;
const byTop = new Map();
const byDashboard = new Map();
for (const p of paths) {
  const top = p === "*" ? "*" : p.split("/").filter(Boolean)[0] ?? "/";
  byTop.set(top, (byTop.get(top) ?? 0) + 1);
  if (p.startsWith("/dashboard/")) {
    const sub = p.split("/")[2] ?? "(root)";
    byDashboard.set(sub, (byDashboard.get(sub) ?? 0) + 1);
  }
}

const sortDesc = (m) => [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

const lines = [];
lines.push("# ROUTES — snapshot gerado");
lines.push("");
lines.push("> Gerado por `scripts/audit/list-routes.mjs`. Não editar à mão.");
lines.push("> Drift detectado por `.github/workflows/docs-drift.yml`.");
lines.push("");
lines.push("## Totais");
lines.push("");
lines.push(`- \`<Route>\` declarados: **${total}**`);
lines.push(`- Paths únicos: **${unique.length}**`);
lines.push("");
lines.push("## Distribuição por primeiro segmento");
lines.push("");
lines.push("| Segmento | Rotas |");
lines.push("| --- | ---: |");
for (const [k, v] of sortDesc(byTop)) lines.push(`| \`/${k === "*" ? "*" : k}\` | ${v} |`);
lines.push("");
lines.push("## Distribuição dentro de `/dashboard/*`");
lines.push("");
lines.push("| Módulo | Rotas |");
lines.push("| --- | ---: |");
for (const [k, v] of sortDesc(byDashboard)) lines.push(`| \`${k}\` | ${v} |`);
lines.push("");
lines.push("## Paths únicos");
lines.push("");
lines.push("```");
for (const p of unique) lines.push(p);
lines.push("```");
lines.push("");

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, lines.join("\n"));
console.log(`wrote ${OUT}: ${total} routes, ${unique.length} unique`);
