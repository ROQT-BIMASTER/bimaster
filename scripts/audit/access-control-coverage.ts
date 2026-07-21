/**
 * Auditoria de cobertura de controle de acesso.
 *
 * Cruza:
 *   - screenCode="..." referenciados em src/App.tsx
 *   - códigos em public.telas_sistema
 *   - module_code / screen_code / route em public.sidebar_menu_items
 *   - códigos em public.modulos_sistema
 *
 * Reporta drift e sai com código != 0 se houver.
 *
 * Uso:
 *   bunx tsx scripts/audit/access-control-coverage.ts
 *
 * Requer variáveis de ambiente do Supabase (VITE_SUPABASE_URL + service role
 * OU PGHOST/PGUSER/PGPASSWORD/PGDATABASE) para consulta ao banco.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { execSync } from "node:child_process";

const APP_TSX = resolve(process.cwd(), "src/App.tsx");

function extractScreenCodes(): Set<string> {
  const src = readFileSync(APP_TSX, "utf8");
  const codes = new Set<string>();
  for (const m of src.matchAll(/screenCode="([a-z0-9_]+)"/gi)) codes.add(m[1]);
  return codes;
}

function extractRoutes(): Set<string> {
  const src = readFileSync(APP_TSX, "utf8");
  const routes = new Set<string>();
  for (const m of src.matchAll(/<Route\s+path="([^"]+)"/g)) routes.add(m[1]);
  return routes;
}

function psql(sql: string): string[] {
  const out = execSync(`psql -tAc ${JSON.stringify(sql)}`, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });
  return out.split("\n").map((s) => s.trim()).filter(Boolean);
}

const screenCodesInCode = extractScreenCodes();
const routesInCode = extractRoutes();

const screensInDb = new Set(psql("SELECT codigo FROM public.telas_sistema"));
const modulesInDb = new Set(psql("SELECT codigo FROM public.modulos_sistema"));
const menuModules = new Set(
  psql("SELECT DISTINCT module_code FROM public.sidebar_menu_items WHERE ativo"),
);
const menuScreens = new Set(
  psql(
    "SELECT DISTINCT screen_code FROM public.sidebar_menu_items WHERE ativo AND screen_code IS NOT NULL",
  ),
);
const menuRoutes = psql(
  "SELECT DISTINCT route FROM public.sidebar_menu_items WHERE ativo AND route IS NOT NULL",
);

const issues: string[] = [];

for (const c of screenCodesInCode) {
  if (!screensInDb.has(c)) issues.push(`screenCode "${c}" em App.tsx sem cadastro em telas_sistema`);
}
for (const c of menuScreens) {
  if (!screensInDb.has(c)) issues.push(`screen_code "${c}" no menu sem cadastro em telas_sistema`);
}
for (const c of menuModules) {
  if (!modulesInDb.has(c)) issues.push(`module_code "${c}" no menu sem cadastro em modulos_sistema`);
}
// rotas do menu que não correspondem a nenhuma rota conhecida (aproximado — ignora params dinâmicos)
const routePatterns = [...routesInCode].map((r) => new RegExp("^" + r.replace(/:[^/]+/g, "[^/]+") + "/?$"));
for (const r of menuRoutes) {
  if (!routePatterns.some((re) => re.test(r))) {
    issues.push(`menu route "${r}" não corresponde a nenhuma <Route> em App.tsx`);
  }
}

if (issues.length === 0) {
  console.log("Cobertura de controle de acesso: OK");
  process.exit(0);
}
console.log(`Cobertura de controle de acesso: ${issues.length} divergência(s)`);
for (const i of issues) console.log(" - " + i);
process.exit(1);
