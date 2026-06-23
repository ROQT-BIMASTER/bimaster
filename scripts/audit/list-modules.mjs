#!/usr/bin/env node
// scripts/audit/list-modules.mjs
import { readdirSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";

const OUT = "docs/audit/2026-Q2/generated/MODULES.snapshot.md";

const componentsDir = "src/components";
const pagesDir = "src/pages";
const hooksDir = "src/hooks";
const contextsDir = "src/contexts";

const ls = (d) => readdirSync(d).filter((e) => statSync(join(d, e)).isDirectory());
const lsFiles = (d, re) => readdirSync(d).filter((e) => re.test(e));

const compDirs = ls(componentsDir).sort();
const pageDirs = ls(pagesDir).sort();
const rootPages = lsFiles(pagesDir, /\.tsx$/).sort();
const hooks = lsFiles(hooksDir, /\.tsx?$/).sort();
const contexts = lsFiles(contextsDir, /\.tsx?$/).sort();

// pages count per nested dir
const nestedPageCounts = pageDirs.map((d) => {
  let count = 0;
  const walk = (p) => {
    for (const e of readdirSync(p)) {
      const f = join(p, e);
      const s = statSync(f);
      if (s.isDirectory()) walk(f);
      else if (/\.tsx$/.test(e)) count++;
    }
  };
  walk(join(pagesDir, d));
  return { dir: d, count };
});

const lines = [];
lines.push("# MODULES — snapshot gerado");
lines.push("");
lines.push("> Gerado por `scripts/audit/list-modules.mjs`. Não editar à mão.");
lines.push("");
lines.push("## Totais");
lines.push("");
lines.push(`- Diretórios em \`src/components/\`: **${compDirs.length}**`);
lines.push(`- Páginas raiz em \`src/pages/\`: **${rootPages.length}**`);
lines.push(`- Subdiretórios em \`src/pages/\`: **${pageDirs.length}**`);
lines.push(`- Hooks (\`src/hooks/\`): **${hooks.length}**`);
lines.push(`- Contexts (\`src/contexts/\`): **${contexts.length}**`);
lines.push("");
lines.push("## Diretórios de componentes");
lines.push("");
lines.push("```");
for (const d of compDirs) lines.push(d);
lines.push("```");
lines.push("");
lines.push("## Páginas por subdiretório");
lines.push("");
lines.push("| Subdiretório | Páginas (.tsx, recursivo) |");
lines.push("| --- | ---: |");
for (const r of nestedPageCounts.sort((a, b) => b.count - a.count)) {
  lines.push(`| \`${r.dir}\` | ${r.count} |`);
}
lines.push("");
lines.push("## Contexts");
lines.push("");
for (const c of contexts) lines.push(`- \`${c}\``);
lines.push("");

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, lines.join("\n"));
console.log(`wrote ${OUT}: ${compDirs.length} comp dirs, ${rootPages.length} root pages`);
