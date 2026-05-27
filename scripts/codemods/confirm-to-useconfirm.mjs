#!/usr/bin/env node
/**
 * Codemod: substitui chamadas a confirm() / window.confirm() nativas por
 * useConfirm() (AlertDialog tematizado).
 *
 * - Transforma `confirm("msg")` em `(await confirm({ title: "msg" }))`
 * - Detecta intenção destrutiva por palavras-chave (Excluir/Remover/Apagar/Desvincular/Tirar)
 * - Separa título e descrição em mensagens com "\n\n"
 * - Torna `async` a função enclosing imediata (arrow ou function decl)
 * - Insere `import { useConfirm } from "@/hooks/useConfirm";` e
 *   `const confirm = useConfirm();` no topo do primeiro componente que contém um confirm.
 *
 * Casos que o codemod NÃO consegue tratar com segurança são logados para
 * revisão manual.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";

const SKIP_FILES = new Set([
  "src/hooks/useConfirm.ts",
  "src/components/ui/confirm-dialog.tsx",
  "scripts/codemods/confirm-to-useconfirm.mjs",
]);

const DESTRUCTIVE_REGEX =
  /\b(Excluir|Remover|Apagar|Desvincular|Tirar|excluir|remover|apagar|desvincular|tirar|Limpar|limpar|confirmExcluir|confirmLimpar|removerConfirm|desvincularConfirm)\b/;

const files = execSync(
  `rg -l "window\\.confirm\\(|\\bconfirm\\(" src -g '*.ts' -g '*.tsx'`,
  { encoding: "utf8" },
)
  .split("\n")
  .filter(Boolean)
  .filter((f) => !SKIP_FILES.has(f));

console.log(`Found ${files.length} files`);

// ---------------- helpers ----------------

/** Acha o índice do `)` que casa com o `(` em start (start aponta para `(`). */
function findMatchingParen(src, start) {
  let depth = 0;
  let i = start;
  let inStr = null; // '"' | "'" | "`"
  let tplBraceDepth = 0;
  while (i < src.length) {
    const c = src[i];
    if (inStr) {
      if (c === "\\") {
        i += 2;
        continue;
      }
      if (inStr === "`" && c === "$" && src[i + 1] === "{") {
        tplBraceDepth++;
        i += 2;
        continue;
      }
      if (c === inStr) {
        inStr = null;
      }
      i++;
      continue;
    }
    if (c === '"' || c === "'") {
      inStr = c;
      i++;
      continue;
    }
    if (c === "`") {
      inStr = "`";
      i++;
      continue;
    }
    if (c === "/" && src[i + 1] === "/") {
      while (i < src.length && src[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && src[i + 1] === "*") {
      i += 2;
      while (i < src.length - 1 && !(src[i] === "*" && src[i + 1] === "/")) i++;
      i += 2;
      continue;
    }
    if (c === "(") depth++;
    else if (c === ")") {
      depth--;
      if (depth === 0) return i;
    }
    i++;
  }
  return -1;
}

/**
 * Dado o conteúdo do arg (uma única expressão string-like, p.ex. `"msg"`,
 * `\`Excluir "${nome}"?\``, ou `t("inbox.x")`), separa em { title, description, destructive }.
 *
 * - Para strings literais com `\n\n`, split em title/description.
 * - Para template literals com `\n\n` no texto, split também.
 * - Para chamadas como `t(...)`, deixa tudo como title.
 */
function buildOptionsObject(arg) {
  const trimmed = arg.trim();
  // Detecta literal string simples
  const sQuote = trimmed[0];
  let title = trimmed;
  let description = null;
  if ((sQuote === '"' || sQuote === "'") && trimmed.endsWith(sQuote)) {
    const inner = trimmed.slice(1, -1);
    if (inner.includes("\\n\\n")) {
      const [t, ...rest] = inner.split("\\n\\n");
      title = `${sQuote}${t}${sQuote}`;
      description = `${sQuote}${rest.join("\\n\\n")}${sQuote}`;
    }
  } else if (sQuote === "`" && trimmed.endsWith("`")) {
    const inner = trimmed.slice(1, -1);
    if (inner.includes("\\n\\n")) {
      const idx = inner.indexOf("\\n\\n");
      const t = inner.slice(0, idx);
      const d = inner.slice(idx + 4);
      title = `\`${t}\``;
      description = `\`${d}\``;
    }
  }

  const destructive = DESTRUCTIVE_REGEX.test(trimmed);

  const parts = [`title: ${title}`];
  if (description) parts.push(`description: ${description}`);
  if (destructive) parts.push(`destructive: true`);
  return `{ ${parts.join(", ")} }`;
}

/** Encontra o índice do `(` da declaração de função enclosing imediata, OU
 * o índice de início do callback arrow, para podermos inserir `async`.
 * Retorna { insertAt, kind } onde kind indica se já é async (skip) ou o tipo.
 * Retorna null se não conseguiu identificar.
 */
function findEnclosingFunction(src, pos) {
  // Walk backwards counting brace depth. Quando entrarmos em uma função, ela
  // é aquela em que estamos: marcamos o `{` que NOS contém.
  let depth = 0;
  let braceOpenIdx = -1;
  for (let i = pos - 1; i >= 0; i--) {
    const c = src[i];
    if (c === "}") depth++;
    else if (c === "{") {
      if (depth === 0) {
        braceOpenIdx = i;
        break;
      }
      depth--;
    }
  }
  if (braceOpenIdx < 0) return null;

  // Olha pra trás do `{` para entender o que é.
  // Padrões comuns:
  //   `) {`                  ← function/method/arrow body
  //   `) => {`               ← arrow body
  //   `{}` de bloco solto    ← bail (não é função)
  //
  // Walking back skipping whitespace.
  let j = braceOpenIdx - 1;
  while (j >= 0 && /\s/.test(src[j])) j--;
  if (j < 0) return null;

  // Caso arrow: `=> {`
  if (src[j] === ">" && src[j - 1] === "=") {
    // Acha o `(` que abre os params da arrow.
    // Walk back: `=> ` precedido por `)` ou um identificador (param único).
    let k = j - 2;
    while (k >= 0 && /\s/.test(src[k])) k--;
    if (k < 0) return null;
    if (src[k] === ")") {
      // Acha matching `(`.
      let depthP = 0;
      let m = k;
      while (m >= 0) {
        if (src[m] === ")") depthP++;
        else if (src[m] === "(") {
          depthP--;
          if (depthP === 0) break;
        }
        m--;
      }
      if (m < 0) return null;
      // Verifica se já tem `async` antes do `(`.
      let n = m - 1;
      while (n >= 0 && /\s/.test(src[n])) n--;
      if (n >= 4 && src.slice(n - 4, n + 1) === "async") {
        return { isAsync: true };
      }
      return { insertAt: m, prefix: "async " };
    } else if (/[A-Za-z_$]/.test(src[k])) {
      // arrow de param único: `x => {`
      let n = k;
      while (n > 0 && /[A-Za-z0-9_$]/.test(src[n - 1])) n--;
      // Verifica async antes do identificador
      let p = n - 1;
      while (p >= 0 && /\s/.test(src[p])) p--;
      if (p >= 4 && src.slice(p - 4, p + 1) === "async") {
        return { isAsync: true };
      }
      return { insertAt: n, prefix: "async " };
    }
    return null;
  }

  // Caso function: `) {` precedido por `function` ou método de classe/objeto.
  if (src[j] === ")") {
    // Encontra matching `(`.
    let depthP = 0;
    let m = j;
    while (m >= 0) {
      if (src[m] === ")") depthP++;
      else if (src[m] === "(") {
        depthP--;
        if (depthP === 0) break;
      }
      m--;
    }
    if (m < 0) return null;

    // Volta antes do `(`, captura identificador.
    let n = m - 1;
    while (n >= 0 && /\s/.test(src[n])) n--;
    if (n < 0) return null;
    let nameEnd = n + 1;
    while (n >= 0 && /[A-Za-z0-9_$]/.test(src[n])) n--;
    const nameStart = n + 1;
    const name = src.slice(nameStart, nameEnd);

    // Antes do nome, talvez `function` keyword.
    let p = n;
    while (p >= 0 && /\s/.test(src[p])) p--;
    if (
      p >= 7 &&
      src.slice(p - 7, p + 1) === "function"
    ) {
      // `function name(`
      // Antes de `function`, verificar `async`
      let q = p - 8;
      while (q >= 0 && /\s/.test(src[q])) q--;
      if (q >= 4 && src.slice(q - 4, q + 1) === "async") {
        return { isAsync: true };
      }
      return { insertAt: p - 7, prefix: "async " };
    }

    // Pode ser método: `name(`
    if (name) {
      // verifica `async name(`
      let q = nameStart - 1;
      while (q >= 0 && /\s/.test(src[q])) q--;
      if (q >= 4 && src.slice(q - 4, q + 1) === "async") {
        return { isAsync: true };
      }
      return { insertAt: nameStart, prefix: "async " };
    }
  }

  return null;
}

/** Encontra início do componente React (function decl ou const = () =>) que
 * contém pos. Heurística: sobe brace-depth até depth 0 e procura `function Name(`
 * ou `const Name = ... => {`. Retorna posição logo após o `{` do corpo. */
function findComponentBodyStart(src, pos) {
  // Encontra o `{` mais externo que ainda contém pos (depth 1 a partir do top).
  let depth = 0;
  let i = pos;
  let outerOpen = -1;
  for (; i >= 0; i--) {
    const c = src[i];
    if (c === "}") depth++;
    else if (c === "{") {
      if (depth === 0) {
        outerOpen = i;
        // continue indo: queremos o MAIS externo. Mas precisa estar dentro
        // de uma função. Olha pra trás:
        // se imediatamente antes (skip ws) for `=>` ou `)`, é função.
        let j = i - 1;
        while (j >= 0 && /\s/.test(src[j])) j--;
        const isFn =
          (src[j] === ">" && src[j - 1] === "=") || src[j] === ")";
        if (isFn) {
          // tenta subir mais
          depth = 0;
          continue;
        } else {
          // bloco não-função; volta um para reiniciar
          depth = 1;
        }
      } else {
        depth--;
      }
    }
  }
  if (outerOpen < 0) return null;
  return outerOpen + 1;
}

// ---------------- transform ----------------

function transformFile(path) {
  let src = readFileSync(path, "utf8");
  const original = src;
  const skipped = [];
  let calls = 0;
  let componentBodyStart = -1;

  // Coletamos confirm calls primeiro (left-to-right) e processamos de trás
  // pra frente para preservar offsets.
  const calls_info = [];

  let i = 0;
  while (i < src.length) {
    // Acha `confirm(` que não seja precedido por identificador (exceto `window.`)
    const idx = src.indexOf("confirm(", i);
    if (idx < 0) break;
    // checar `useConfirm(` ou outros
    const prev = idx === 0 ? "" : src[idx - 1];
    let callStart = idx;
    let isWindow = false;
    if (idx >= 7 && src.slice(idx - 7, idx) === "window.") {
      callStart = idx - 7;
      isWindow = true;
    } else if (/[A-Za-z0-9_$]/.test(prev)) {
      // skip (useConfirm, etc.)
      i = idx + 8;
      continue;
    }
    // Tem que ser uma chamada de função: o caractere prev (antes de `callStart`)
    // não pode estar dentro de algo tipo comentário ou string. Assumimos OK.
    const parenOpen = idx + 7; // posição do `(`
    const parenClose = findMatchingParen(src, parenOpen);
    if (parenClose < 0) {
      skipped.push(`unmatched paren near char ${idx}`);
      i = idx + 8;
      continue;
    }
    calls_info.push({ callStart, parenOpen, parenClose, isWindow });
    i = parenClose + 1;
  }

  if (calls_info.length === 0) return { ok: true, calls: 0 };

  // Determina componentBodyStart usando a posição da primeira call
  componentBodyStart = findComponentBodyStart(src, calls_info[0].callStart);

  // Coleta posições de funções enclosing a tornar async (dedup por posição).
  const asyncInserts = new Map(); // pos -> prefix

  // Processa calls de TRÁS pra FRENTE para preservar offsets.
  for (let cIdx = calls_info.length - 1; cIdx >= 0; cIdx--) {
    const c = calls_info[cIdx];
    const arg = src.slice(c.parenOpen + 1, c.parenClose);
    // Bail se arg está vazio
    if (!arg.trim()) {
      skipped.push(`empty confirm at char ${c.callStart}`);
      continue;
    }
    const opts = buildOptionsObject(arg);
    const replacement = `(await confirm(${opts}))`;
    src = src.slice(0, c.callStart) + replacement + src.slice(c.parenClose + 1);

    // Acha enclosing function (no NOVO src — mas como editamos do fim pro
    // começo, posições anteriores ainda valem).
    const enclosing = findEnclosingFunction(src, c.callStart);
    if (!enclosing) {
      skipped.push(`could not find enclosing function for call at char ${c.callStart}`);
    } else if (!enclosing.isAsync) {
      asyncInserts.set(enclosing.insertAt, enclosing.prefix);
    }
    calls++;
  }

  // Aplica async inserts de trás pra frente
  const sortedInserts = Array.from(asyncInserts.entries()).sort(
    (a, b) => b[0] - a[0],
  );
  for (const [pos, prefix] of sortedInserts) {
    src = src.slice(0, pos) + prefix + src.slice(pos);
  }

  // Insere `const confirm = useConfirm();` no topo do componente. Recalcula
  // componentBodyStart pois inserts mudaram offsets — mais simples: localiza
  // novamente usando a posição da PRIMEIRA call que ainda existe.
  // Como inserts foram só prefixos "async ", podemos somar deltas, mas a
  // forma mais robusta é re-localizar via indexOf de `await confirm(`.
  const firstAwaitIdx = src.indexOf("await confirm(");
  let bodyStart = -1;
  if (firstAwaitIdx >= 0) {
    bodyStart = findComponentBodyStart(src, firstAwaitIdx);
  }
  if (bodyStart < 0) {
    skipped.push("could not locate component body to inject useConfirm()");
  } else {
    // Pula whitespace e nova linha após `{`
    let bs = bodyStart;
    // Pega indentação da próxima linha não-vazia
    let probe = bs;
    while (probe < src.length && (src[probe] === " " || src[probe] === "\n" || src[probe] === "\t")) probe++;
    // indentação da linha onde probe está
    let lineStart = probe;
    while (lineStart > 0 && src[lineStart - 1] !== "\n") lineStart--;
    const indent = src.slice(lineStart, probe);
    const insertion = `\n${indent}const confirm = useConfirm();`;
    src = src.slice(0, bs) + insertion + src.slice(bs);
  }

  // Adiciona import se ainda não existir
  if (!/from\s*["']@\/hooks\/useConfirm["']/.test(src)) {
    // Insere após o último import single-line
    const importRe = /^import [^\n]+;[ \t]*$/gm;
    let lastIdx = 0;
    let m;
    while ((m = importRe.exec(src)) !== null) {
      lastIdx = m.index + m[0].length;
    }
    if (lastIdx === 0) {
      src = `import { useConfirm } from "@/hooks/useConfirm";\n` + src;
    } else {
      src =
        src.slice(0, lastIdx) +
        `\nimport { useConfirm } from "@/hooks/useConfirm";` +
        src.slice(lastIdx);
    }
  }

  if (src !== original) writeFileSync(path, src, "utf8");
  return { ok: skipped.length === 0, calls, skipped };
}

let totalCalls = 0;
const reports = [];

for (const f of files) {
  try {
    const r = transformFile(f);
    totalCalls += r.calls;
    if (r.ok) {
      console.log(`OK   ${f} (${r.calls} calls)`);
    } else {
      console.log(`PART ${f} (${r.calls} calls, ${r.skipped.length} issues)`);
      for (const s of r.skipped) console.log(`     ! ${s}`);
      reports.push({ file: f, issues: r.skipped });
    }
  } catch (e) {
    console.log(`ERR  ${f}: ${e.message}`);
    reports.push({ file: f, issues: [e.message] });
  }
}

console.log(`\n--- Summary ---`);
console.log(`Files: ${files.length}, calls rewritten: ${totalCalls}`);
console.log(`Files with issues: ${reports.length}`);
