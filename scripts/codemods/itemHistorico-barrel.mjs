#!/usr/bin/env node
/**
 * Codemod: substitui imports de '@/hooks/useItemHistorico' por
 * '@/hooks/itemHistorico' (barrel oficial) em arquivos .ts / .tsx.
 *
 * Uso:
 *   node scripts/codemods/itemHistorico-barrel.mjs           # aplica
 *   node scripts/codemods/itemHistorico-barrel.mjs --dry     # só relata
 *   node scripts/codemods/itemHistorico-barrel.mjs src/foo   # raízes custom
 *
 * Cobre:
 *   - import ... from "@/hooks/useItemHistorico"
 *   - import ... from '@/hooks/useItemHistorico'
 *   - import("@/hooks/useItemHistorico")  (dinâmico)
 *   - export ... from "@/hooks/useItemHistorico"
 *   - require("@/hooks/useItemHistorico")
 *
 * NÃO altera o próprio arquivo `src/hooks/itemHistorico/**`.
 */
import { readFileSync, writeFileSync, statSync, readdirSync } from "node:fs";
import { join, sep, resolve } from "node:path";

const args = process.argv.slice(2);
const dry = args.includes("--dry");
const roots = args.filter((a) => !a.startsWith("--"));
const TARGETS = roots.length ? roots : ["src"];

const OLD = "@/hooks/useItemHistorico";
const NEW = "@/hooks/itemHistorico";

const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  ".git",
  ".next",
  ".vite",
  "build",
  "coverage",
  "dev-dist",
]);

const SKIP_PATH_FRAGMENT = `${sep}hooks${sep}itemHistorico${sep}`;

const EXTS = new Set([".ts", ".tsx", ".js", ".jsx", ".mts", ".cts"]);

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      yield* walk(full);
    } else if (st.isFile()) {
      const dot = entry.lastIndexOf(".");
      if (dot !== -1 && EXTS.has(entry.slice(dot))) yield full;
    }
  }
}

// Regex que casa o caminho exato OLD entre aspas simples ou duplas,
// independentemente de ser import estático/dinâmico, export ou require.
function makeReplacer() {
  // Escapa chars regex do OLD
  const escaped = OLD.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Captura a aspa para preservar (' ou ")
  return new RegExp(`(['"])${escaped}\\1`, "g");
}

const re = makeReplacer();
let scanned = 0;
let changed = 0;
const changedFiles = [];

for (const root of TARGETS) {
  const abs = resolve(root);
  for (const file of walk(abs)) {
    if (file.includes(SKIP_PATH_FRAGMENT)) continue;
    scanned++;
    const src = readFileSync(file, "utf8");
    if (!src.includes(OLD)) continue;
    const out = src.replace(re, (_m, quote) => `${quote}${NEW}${quote}`);
    if (out === src) continue;
    changed++;
    changedFiles.push(file);
    if (!dry) writeFileSync(file, out, "utf8");
  }
}

const tag = dry ? "[dry-run] " : "";
console.log(`${tag}Arquivos escaneados: ${scanned}`);
console.log(`${tag}Arquivos ${dry ? "que seriam alterados" : "alterados"}: ${changed}`);
for (const f of changedFiles) console.log(`  - ${f}`);

if (changed === 0) console.log("Nada a fazer. Imports já padronizados.");
