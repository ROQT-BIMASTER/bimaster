#!/usr/bin/env node
/**
 * Snapshot de funções SECURITY DEFINER + chamadores no frontend.
 *
 * Uso:
 *   1. Exporte a lista de funções para /tmp/secdef.tsv via psql:
 *      psql -At -F$'\t' -c "SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid), pg_get_function_result(p.oid), l.lanname, CASE p.provolatile WHEN 'i' THEN 'immutable' WHEN 's' THEN 'stable' WHEN 'v' THEN 'volatile' END, has_function_privilege('authenticated', p.oid, 'EXECUTE'), has_function_privilege('anon', p.oid, 'EXECUTE'), has_function_privilege('service_role', p.oid, 'EXECUTE') FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace JOIN pg_language l ON l.oid = p.prolang WHERE p.prosecdef = true AND n.nspname NOT IN ('pg_catalog','information_schema','pg_toast') ORDER BY n.nspname, p.proname;" > /tmp/secdef.tsv
 *   2. node scripts/audit/security-definer-snapshot.mjs
 *
 * Gera src/data/security/security-definer-snapshot.json
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const SRC = join(ROOT, "src");
const TSV = process.env.SECDEF_TSV || "/tmp/secdef.tsv";
const OUT = join(SRC, "data/security/security-definer-snapshot.json");

// 1. Carrega lista de funções
const rows = readFileSync(TSV, "utf8")
  .split("\n")
  .filter(Boolean)
  .map((line) => {
    const [
      schema_name,
      function_name,
      function_args,
      return_type,
      language,
      volatility,
      granted_to_authenticated,
      granted_to_anon,
      granted_to_service_role,
    ] = line.split("\t");
    return {
      schema_name,
      function_name,
      function_args,
      function_signature: `${schema_name}.${function_name}(${function_args})`,
      return_type,
      language,
      volatility,
      granted_to_authenticated: granted_to_authenticated === "t",
      granted_to_anon: granted_to_anon === "t",
      granted_to_service_role: granted_to_service_role === "t",
      callers: [],
    };
  });

console.log(`Funções carregadas: ${rows.length}`);

// 2. Indexa por nome (sobrecargas compartilham callers)
const byName = new Map();
for (const r of rows) {
  if (!byName.has(r.function_name)) byName.set(r.function_name, []);
  byName.get(r.function_name).push(r);
}

// 3. Walk em src/**/*.{ts,tsx} procurando .rpc('name') ou .rpc("name")
function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

const RPC_RE = /\.rpc\(\s*['"`]([a-zA-Z0-9_]+)['"`]/g;
const files = walk(SRC);
console.log(`Arquivos varridos: ${files.length}`);

let totalCallers = 0;
for (const file of files) {
  const text = readFileSync(file, "utf8");
  const rel = relative(ROOT, file);
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.includes(".rpc(")) continue;
    let m;
    RPC_RE.lastIndex = 0;
    while ((m = RPC_RE.exec(line)) !== null) {
      const name = m[1];
      const variants = byName.get(name);
      if (!variants) continue;
      for (const v of variants) {
        v.callers.push({ file: rel, line: i + 1 });
        totalCallers++;
      }
    }
  }
}

console.log(`Total de chamadores encontrados: ${totalCallers}`);

// 4. Estatísticas
const usadas = rows.filter((r) => r.callers.length > 0).length;
const revogadas = rows.filter(
  (r) => !r.granted_to_anon && !r.granted_to_authenticated,
).length;

const snapshot = {
  generated_at: new Date().toISOString(),
  total: rows.length,
  used_in_frontend: usadas,
  no_public_grant: revogadas,
  functions: rows,
};

writeFileSync(OUT, JSON.stringify(snapshot, null, 2));
console.log(`Snapshot escrito em ${OUT}`);
console.log(`  Total: ${rows.length}`);
console.log(`  Usadas no frontend: ${usadas}`);
console.log(`  Sem grant público (revogadas): ${revogadas}`);
