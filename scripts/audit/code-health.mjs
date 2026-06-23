#!/usr/bin/env node
// scripts/audit/code-health.mjs
// Audit-only. God-files, any-count, TODO, ts-ignore, console.
import { readdirSync, readFileSync, writeFileSync, mkdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";

const ROOT = "src";
const OUT = "docs/audit/2026-Q2/generated/CODE_HEALTH.snapshot.md";
const IGNORE_PATHS = [/^src\/integrations\/supabase\/types\.ts$/];
const RE_ANY = /(?::\s*any\b|<any>|\bas\s+any\b)/g;
const RE_TODO = /\b(TODO|FIXME|HACK|XXX)\b/g;
const RE_TSIGNORE = /@ts-(ignore|nocheck|expect-error)\b/g;
const RE_CONSOLE = /\bconsole\.(log|warn|error|info|debug)\b/g;

function* walk(dir) {
  for (const e of readdirSync(dir)) {
    const full = join(dir, e);
    const s = statSync(full);
    if (s.isDirectory()) yield* walk(full);
    else if (/\.(ts|tsx)$/.test(e)) yield full;
  }
}

let totalFiles = 0;
let totalLoc = 0;
let any = { hits: 0, files: 0 };
let todo = { hits: 0, files: 0 };
let tsig = { hits: 0, files: 0 };
let cons = { hits: 0, files: 0 };
const sizes = [];

for (const f of walk(ROOT)) {
  if (IGNORE_PATHS.some((r) => r.test(f))) continue;
  const src = readFileSync(f, "utf8");
  const loc = src.split("\n").length;
  totalFiles++;
  totalLoc += loc;
  sizes.push({ path: f, loc });
  const h = (re) => (src.match(re) ?? []).length;
  const ha = h(RE_ANY);
  if (ha) { any.hits += ha; any.files++; }
  const ht = h(RE_TODO);
  if (ht) { todo.hits += ht; todo.files++; }
  const hi = h(RE_TSIGNORE);
  if (hi) { tsig.hits += hi; tsig.files++; }
  const hc = h(RE_CONSOLE);
  if (hc) { cons.hits += hc; cons.files++; }
}

sizes.sort((a, b) => b.loc - a.loc);
const buckets = { gt1500: 0, gt1000: 0, gt800: 0 };
for (const s of sizes) {
  if (s.loc > 1500) buckets.gt1500++;
  else if (s.loc > 1000) buckets.gt1000++;
  else if (s.loc > 800) buckets.gt800++;
}
const top = sizes.slice(0, 25);

const lines = [];
lines.push("# CODE HEALTH — snapshot gerado");
lines.push("");
lines.push("> Gerado por `scripts/audit/code-health.mjs`. Não editar à mão.");
lines.push("");
lines.push("## Resumo");
lines.push("");
lines.push("| Métrica | Valor |");
lines.push("| --- | ---: |");
lines.push(`| Arquivos \`.ts/.tsx\` (exclui auto-gerados) | ${totalFiles} |`);
lines.push(`| LoC total | ${totalLoc.toLocaleString("pt-BR")} |`);
lines.push(`| God-files > 1500 LoC | ${buckets.gt1500} |`);
lines.push(`| God-files 1001–1500 LoC | ${buckets.gt1000} |`);
lines.push(`| God-files 801–1000 LoC | ${buckets.gt800} |`);
lines.push(`| Uso de \`any\` (hits / arquivos) | ${any.hits} / ${any.files} |`);
lines.push(`| TODO/FIXME/HACK/XXX | ${todo.hits} / ${todo.files} |`);
lines.push(`| \`@ts-ignore/@ts-nocheck/@ts-expect-error\` | ${tsig.hits} / ${tsig.files} |`);
lines.push(`| \`console.*\` | ${cons.hits} / ${cons.files} |`);
lines.push("");
lines.push("## Top 25 god-files");
lines.push("");
lines.push("| LoC | Arquivo |");
lines.push("| ---: | --- |");
for (const s of top) lines.push(`| ${s.loc} | \`${s.path}\` |`);
lines.push("");

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, lines.join("\n"));
console.log(`wrote ${OUT}: ${totalFiles} files, ${any.hits} any hits`);
