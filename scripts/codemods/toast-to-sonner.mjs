#!/usr/bin/env node
/**
 * Codemod: migra useToast() + radix toast para sonner.
 * Descartável — rodar uma vez e apagar (mas mantido em git para auditoria).
 *
 * Transformações por arquivo:
 *   1. Remove `import { useToast } from "@/hooks/use-toast";`
 *   2. Remove `const { toast } = useToast();`
 *   3. Garante `import { toast } from "sonner";`
 *   4. Reescreve cada `toast({ ... })`:
 *        variant: "destructive"  -> toast.error(title, { description })
 *        com description, sem variant -> toast.success(title, { description })
 *        só title -> toast(title)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";

const files = execSync(
  `rg -l "@/hooks/use-toast" src`,
  { encoding: "utf8" }
)
  .split("\n")
  .filter(Boolean);

console.log(`Found ${files.length} files`);

const skipped = [];
let totalCalls = 0;

/** Encontra o índice do `}` que fecha o `{` em `start` (após `toast(`). */
function findMatchingBrace(src, start) {
  // start aponta para `{`
  let depth = 0;
  let i = start;
  let inStr = null; // '"' | "'" | "`"
  let inTpl = 0; // depth de ${} dentro de template
  while (i < src.length) {
    const c = src[i];
    const prev = src[i - 1];
    if (inStr) {
      if (c === "\\") { i += 2; continue; }
      if (c === inStr) {
        if (inStr === "`" && false) {
          // handled below
        }
        inStr = null;
      } else if (inStr === "`" && c === "$" && src[i + 1] === "{") {
        inTpl++;
        i += 2;
        continue;
      }
      i++;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") { inStr = c; i++; continue; }
    if (c === "/" && src[i + 1] === "/") {
      // line comment
      while (i < src.length && src[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && src[i + 1] === "*") {
      i += 2;
      while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) i++;
      i += 2;
      continue;
    }
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return i;
    }
    i++;
  }
  return -1;
}

/** Parser super simples para extrair chaves top-level de um objeto literal. */
function parseObjectLiteral(body) {
  // body é o conteúdo entre { e }, sem as chaves
  // retorna { keys: { title?: string, description?: string, variant?: string }, unknown: string[] }
  const result = { keys: {}, unknown: [], order: [] };
  let i = 0;
  const len = body.length;
  while (i < len) {
    // skip ws + commas
    while (i < len && /[\s,]/.test(body[i])) i++;
    if (i >= len) break;
    // line/block comments
    if (body[i] === "/" && body[i + 1] === "/") {
      while (i < len && body[i] !== "\n") i++;
      continue;
    }
    if (body[i] === "/" && body[i + 1] === "*") {
      i += 2;
      while (i < len && !(body[i] === "*" && body[i + 1] === "/")) i++;
      i += 2;
      continue;
    }
    // read key (identifier or "string")
    let key;
    if (body[i] === '"' || body[i] === "'") {
      const q = body[i++];
      let s = "";
      while (i < len && body[i] !== q) {
        if (body[i] === "\\") { s += body[i] + body[i + 1]; i += 2; }
        else s += body[i++];
      }
      i++;
      key = s;
    } else if (/[A-Za-z_$]/.test(body[i])) {
      let s = "";
      while (i < len && /[A-Za-z0-9_$]/.test(body[i])) s += body[i++];
      key = s;
    } else if (body[i] === "[" || body[i] === "." /* spread */) {
      return null; // spread or computed → bail
    } else {
      return null;
    }
    // skip ws
    while (i < len && /\s/.test(body[i])) i++;
    if (body[i] !== ":") {
      // shorthand { title } -> value === identifier
      const value = key;
      result.order.push(key);
      result.keys[key] = value;
      continue;
    }
    i++; // skip :
    while (i < len && /\s/.test(body[i])) i++;
    // read value until top-level comma or end
    const valStart = i;
    let depth = 0;
    let inStr = null;
    while (i < len) {
      const c = body[i];
      if (inStr) {
        if (c === "\\") { i += 2; continue; }
        if (c === inStr) inStr = null;
        i++;
        continue;
      }
      if (c === '"' || c === "'" || c === "`") { inStr = c; i++; continue; }
      if (c === "(" || c === "{" || c === "[") depth++;
      else if (c === ")" || c === "}" || c === "]") depth--;
      else if (c === "," && depth === 0) break;
      i++;
    }
    const value = body.slice(valStart, i).trim();
    result.order.push(key);
    result.keys[key] = value;
  }
  return result;
}

/** Reescreve uma chamada toast({...}). Retorna string nova ou null se bail. */
function rewriteToastCall(objectBody) {
  const parsed = parseObjectLiteral(objectBody);
  if (!parsed) return null;
  const { keys } = parsed;
  const known = new Set(["title", "description", "variant", "duration"]);
  for (const k of Object.keys(keys)) {
    if (!known.has(k)) return null; // unknown prop → bail
  }
  const title = keys.title;
  const description = keys.description;
  const variant = keys.variant; // expression form like "destructive" or '"default"'
  const duration = keys.duration;

  let fn;
  if (variant && /["']destructive["']/.test(variant)) fn = "toast.error";
  else if (description) fn = "toast.success";
  else fn = "toast";

  const opts = [];
  if (description) opts.push(`description: ${description}`);
  if (duration) opts.push(`duration: ${duration}`);

  if (!title) {
    // fallback: keep as-is, bail
    return null;
  }
  if (opts.length === 0) {
    return `${fn}(${title})`;
  }
  return `${fn}(${title}, { ${opts.join(", ")} })`;
}

function transformFile(path) {
  let src = readFileSync(path, "utf8");
  const original = src;

  // 1. Remove import { useToast } from "@/hooks/use-toast";
  //    Handle multi-import lines too.
  src = src.replace(
    /^import\s*\{\s*useToast\s*\}\s*from\s*["']@\/hooks\/use-toast["'];?\s*\n/gm,
    ""
  );
  // multi-import: e.g. import { useToast, toast as t } — bail if found
  if (/from\s*["']@\/hooks\/use-toast["']/.test(src)) {
    return { ok: false, reason: "complex use-toast import" };
  }

  // 2. Remove const { toast } = useToast();
  src = src.replace(
    /^\s*const\s*\{\s*toast\s*\}\s*=\s*useToast\(\)\s*;?\s*\n/gm,
    ""
  );
  // also handle multi-destructure like { toast, dismiss } — bail if remains
  if (/useToast\(/.test(src)) {
    return { ok: false, reason: "leftover useToast() call" };
  }

  // 3. Find toast({ ... }) calls. Walk the string.
  let out = "";
  let i = 0;
  let callCount = 0;
  while (i < src.length) {
    // Look for `toast(` preceded by non-identifier char (or BOL)
    const idx = src.indexOf("toast(", i);
    if (idx === -1) { out += src.slice(i); break; }
    const prev = idx === 0 ? "" : src[idx - 1];
    const isWordChar = /[A-Za-z0-9_$.]/.test(prev);
    if (isWordChar) {
      // skip — e.g. `useToast(` or `toastify(`
      out += src.slice(i, idx + 6);
      i = idx + 6;
      continue;
    }
    // check next non-space char is `{`
    let j = idx + 6;
    while (j < src.length && /\s/.test(src[j])) j++;
    if (src[j] !== "{") {
      out += src.slice(i, idx + 6);
      i = idx + 6;
      continue;
    }
    // find matching brace
    const close = findMatchingBrace(src, j);
    if (close === -1) {
      return { ok: false, reason: "unmatched brace" };
    }
    // ensure next non-space is `)`
    let k = close + 1;
    while (k < src.length && /\s/.test(src[k])) k++;
    if (src[k] !== ")") {
      // toast({...}, extra) — bail
      return { ok: false, reason: "toast call with extra args" };
    }
    const objBody = src.slice(j + 1, close);
    const replacement = rewriteToastCall(objBody);
    if (replacement == null) {
      return { ok: false, reason: "unparseable toast call: " + objBody.slice(0, 80) };
    }
    out += src.slice(i, idx) + replacement;
    i = k + 1;
    callCount++;
  }
  src = out;
  totalCalls += callCount;

  // 4. Ensure sonner import
  if (!/from\s*["']sonner["']/.test(src)) {
    // insert at top after last import line
    const importRe = /^import .+;?\s*$/gm;
    let lastIdx = 0;
    let m;
    while ((m = importRe.exec(src)) !== null) {
      lastIdx = m.index + m[0].length;
    }
    if (lastIdx === 0) {
      src = `import { toast } from "sonner";\n` + src;
    } else {
      src = src.slice(0, lastIdx) + `\nimport { toast } from "sonner";` + src.slice(lastIdx);
    }
  } else {
    // already has sonner import — ensure `toast` is in the named imports
    src = src.replace(
      /import\s*\{\s*([^}]*)\}\s*from\s*["']sonner["'];?/,
      (full, names) => {
        const list = names.split(",").map((s) => s.trim()).filter(Boolean);
        if (!list.includes("toast")) list.unshift("toast");
        return `import { ${list.join(", ")} } from "sonner";`;
      }
    );
  }

  if (src === original) return { ok: true, changed: false, calls: 0 };
  writeFileSync(path, src, "utf8");
  return { ok: true, changed: true, calls: callCount };
}

for (const f of files) {
  try {
    const r = transformFile(f);
    if (!r.ok) {
      skipped.push({ file: f, reason: r.reason });
      console.log(`SKIP ${f}: ${r.reason}`);
    } else if (r.changed) {
      console.log(`OK   ${f} (${r.calls} calls)`);
    } else {
      console.log(`NOOP ${f}`);
    }
  } catch (e) {
    skipped.push({ file: f, reason: e.message });
    console.log(`ERR  ${f}: ${e.message}`);
  }
}

console.log(`\n--- Summary ---`);
console.log(`Files processed: ${files.length}`);
console.log(`Skipped: ${skipped.length}`);
console.log(`Total toast() calls rewritten: ${totalCalls}`);
if (skipped.length) {
  console.log(`\nSkipped files:`);
  for (const s of skipped) console.log(`  ${s.file}: ${s.reason}`);
}
