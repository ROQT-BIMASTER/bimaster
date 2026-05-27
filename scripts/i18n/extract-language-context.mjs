#!/usr/bin/env node
/**
 * Extrai o dicionário monolítico de src/contexts/LanguageContext.tsx para
 * arquivos JSON por idioma e namespace em src/i18n/locales/<lang>/<ns>.json.
 *
 * Executado uma vez como parte da Fase 1 da migração para i18next.
 * Script idempotente — pode ser reexecutado para auditoria/sync.
 *
 * Uso: node scripts/i18n/extract-language-context.mjs
 */
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");
const SRC = resolve(ROOT, "src/contexts/LanguageContext.tsx");
const OUT = resolve(ROOT, "src/i18n/locales");

const LANGS = ["pt-BR", "en", "es", "ar"];

// Mapa prefixo -> namespace. Prefixos não listados caem em "common".
const PREFIX_TO_NS = {
  system: "common", lang: "common", offline: "common", logout: "common",
  label: "common", action: "common", quick: "common", nav: "common",
  module: "common",

  dashboard: "dashboard", widget: "dashboard", exec: "dashboard",
  funnel: "dashboard", vs: "dashboard", pq: "dashboard", brand: "dashboard",

  prospects: "prospects", status: "prospects", auth: "prospects",

  financeiro: "financeiro", fin: "financeiro", fin_w: "financeiro",
  approval: "financeiro",

  trade: "trade", trade_cat: "trade", trade_exec: "trade", trade_fin: "trade",
  trade_w: "trade", visits: "trade", eventos: "trade",

  marketing: "marketing", mkt: "marketing",

  fabrica: "fabrica", comercial: "fabrica", precos: "fabrica",

  portal: "portal", dept: "portal",
};

const NAMESPACES = Array.from(new Set(Object.values(PREFIX_TO_NS)));

function nsFor(key) {
  const prefix = key.split(".")[0];
  return PREFIX_TO_NS[prefix] ?? "common";
}

function extractLangBlock(src, lang) {
  // Localiza `"<lang>": {` e captura até o fechamento balanceado.
  const marker = `"${lang}": {`;
  const start = src.indexOf(marker);
  if (start === -1) throw new Error(`Bloco do idioma ${lang} não encontrado`);
  let i = start + marker.length;
  let depth = 1;
  while (i < src.length && depth > 0) {
    const ch = src[i];
    if (ch === '"') {
      // pular string (com escapes)
      i++;
      while (i < src.length) {
        if (src[i] === "\\") { i += 2; continue; }
        if (src[i] === '"') { i++; break; }
        i++;
      }
      continue;
    }
    if (ch === "{") depth++;
    else if (ch === "}") depth--;
    i++;
  }
  return src.slice(start + marker.length, i - 1);
}

function parsePairs(block) {
  // Casa "key": "value" tolerando vírgulas, comentários // e escapes.
  // Estratégia: varrer caracter a caracter.
  const out = {};
  let i = 0;
  while (i < block.length) {
    const ch = block[i];
    // pular whitespace
    if (/\s/.test(ch) || ch === ",") { i++; continue; }
    // pular comentários de linha
    if (ch === "/" && block[i + 1] === "/") {
      while (i < block.length && block[i] !== "\n") i++;
      continue;
    }
    // pular comentários de bloco
    if (ch === "/" && block[i + 1] === "*") {
      i += 2;
      while (i < block.length && !(block[i] === "*" && block[i + 1] === "/")) i++;
      i += 2;
      continue;
    }
    if (ch !== '"') {
      throw new Error(`Esperava '"' no offset ${i}, achou ${JSON.stringify(ch)}`);
    }
    // ler key
    const key = readString(block, i);
    i = key.end;
    // pular whitespace e :
    while (/\s/.test(block[i])) i++;
    if (block[i] !== ":") throw new Error(`Esperava ':' após key '${key.value}'`);
    i++;
    while (/\s/.test(block[i])) i++;
    if (block[i] !== '"') throw new Error(`Esperava '"' para valor de '${key.value}'`);
    const val = readString(block, i);
    i = val.end;
    out[key.value] = val.value;
  }
  return out;
}

function readString(s, start) {
  if (s[start] !== '"') throw new Error("readString: não é string");
  let i = start + 1;
  let out = "";
  while (i < s.length) {
    const ch = s[i];
    if (ch === "\\") {
      const nx = s[i + 1];
      const map = { n: "\n", t: "\t", r: "\r", '"': '"', "\\": "\\", "'": "'" };
      out += map[nx] ?? nx;
      i += 2;
      continue;
    }
    if (ch === '"') return { value: out, end: i + 1 };
    out += ch;
    i++;
  }
  throw new Error("readString: string não terminada");
}

function sortObj(o) {
  return Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));
}

const src = readFileSync(SRC, "utf8");

const totals = {};
for (const lang of LANGS) {
  const block = extractLangBlock(src, lang);
  const pairs = parsePairs(block);
  const buckets = Object.fromEntries(NAMESPACES.map((ns) => [ns, {}]));
  for (const [k, v] of Object.entries(pairs)) {
    buckets[nsFor(k)][k] = v;
  }
  const dir = resolve(OUT, lang);
  mkdirSync(dir, { recursive: true });
  const counts = {};
  for (const ns of NAMESPACES) {
    const sorted = sortObj(buckets[ns]);
    writeFileSync(
      resolve(dir, `${ns}.json`),
      JSON.stringify(sorted, null, 2) + "\n",
      "utf8",
    );
    counts[ns] = Object.keys(sorted).length;
  }
  totals[lang] = counts;
  const sum = Object.values(counts).reduce((a, b) => a + b, 0);
  console.log(`[${lang}] total=${sum}`, counts);
}

// Diff de cobertura entre idiomas
const ref = totals["pt-BR"];
for (const lang of LANGS) {
  if (lang === "pt-BR") continue;
  for (const ns of NAMESPACES) {
    if (totals[lang][ns] !== ref[ns]) {
      console.warn(
        `aviso: ${lang}/${ns} tem ${totals[lang][ns]} chaves vs pt-BR ${ref[ns]}`,
      );
    }
  }
}
console.log("OK");
