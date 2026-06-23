#!/usr/bin/env node
/**
 * scripts/audit/orphan-routes-triage.mjs
 *
 * Cross-checks `src/App.tsx` (declared routes) against
 * `sidebar_menu_items.route` (active menu items) and classifies every
 * orphan route into one of 5 buckets:
 *
 *   A. Public / auth             — must stay out of the menu
 *   B. Child / wizard / detail   — reached via a parent page
 *   C. CRM nested                — reached via CRM internal tabs
 *   D. Admin / diagnostics       — must be cadastered with require_admin
 *   E. Real orphaned feature     — must be cadastered in its module
 *
 * Inputs:
 *   - src/App.tsx                                  (router)
 *   - scripts/audit/data/menu-routes.json          (snapshot of active routes)
 *   - scripts/audit/orphan-routes-exclusions.json  (manual overrides, optional)
 *
 * Output:
 *   docs/audit/2026-Q2/generated/ORPHAN_ROUTES.snapshot.md
 *
 * Audit-only. Does not edit App.tsx or the database.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname } from "node:path";

const APP = "src/App.tsx";
const MENU_FILE = "scripts/audit/data/menu-routes.json";
const EXCLUSIONS = "scripts/audit/orphan-routes-exclusions.json";
const OUT = "docs/audit/2026-Q2/generated/ORPHAN_ROUTES.snapshot.md";

// ---------- 1. Parse App.tsx for path + nearest guard context ----------
const src = readFileSync(APP, "utf8");
const lines = src.split("\n");

function inferGuard(idx) {
  // The whole <Route .../> element typically fits on a single line.
  // Scan the current line plus up to 3 lines forward to capture wrappers
  // inside element={...}. Recognize both raw wrappers (ScreenProtectedRoute,
  // ModuleProtectedRoute) and the local aliases (ScreenRoute, ModuleRoute).
  const window = lines.slice(idx, Math.min(lines.length, idx + 4)).join("\n");
  const ms = window.match(/ModuleScreenRoute[^>]*moduleCode="([^"]+)"[^>]*screenCode="([^"]+)"/);
  if (ms) return { kind: "module-screen", moduleCode: ms[1], screenCode: ms[2] };
  const sp = window.match(/(?:ScreenProtectedRoute|ScreenRoute)[^>]*screenCode="([^"]+)"/);
  const mp = window.match(/(?:ModuleProtectedRoute|ModuleRoute)[^>]*moduleCode="([^"]+)"/);
  if (sp && mp) return { kind: "module-screen", moduleCode: mp[1], screenCode: sp[1] };
  if (sp) return { kind: "screen", moduleCode: null, screenCode: sp[1] };
  if (mp) return { kind: "module", moduleCode: mp[1], screenCode: null };
  if (/CrmAdminRoute/.test(window)) return { kind: "crm-admin", moduleCode: "crm", screenCode: null };
  if (/ClienteProtectedRoute/.test(window)) return { kind: "cliente", moduleCode: null, screenCode: null };
  if (/ProtectedRoute/.test(window)) return { kind: "protected", moduleCode: null, screenCode: null };
  return { kind: "public", moduleCode: null, screenCode: null };
}


const routes = [];
const seen = new Set();
const re = /path="([^"]+)"/g;
let m;
while ((m = re.exec(src)) !== null) {
  const path = m[1];
  if (seen.has(path)) continue;
  seen.add(path);
  const before = src.slice(0, m.index);
  const idx = before.split("\n").length - 1;
  routes.push({ path, line: idx + 1, guard: inferGuard(idx) });
}

// ---------- 2. Load menu snapshot ----------
let menuRoutes = new Set();
if (existsSync(MENU_FILE)) {
  const raw = JSON.parse(readFileSync(MENU_FILE, "utf8"));
  menuRoutes = new Set(raw.routes ?? raw);
} else {
  console.error(`! ${MENU_FILE} ausente — gere-o antes (snapshot do banco).`);
  process.exit(2);
}

let exclusions = {};
if (existsSync(EXCLUSIONS)) {
  exclusions = JSON.parse(readFileSync(EXCLUSIONS, "utf8"));
}

// ---------- 3. Classify ----------
const PUBLIC_PREFIX = ["/auth/", "/portal/", "/painel/"];
const PUBLIC_EXACT = new Set([
  "/", "/contato", "/termos", "/termos-de-uso", "/privacidade", "/politica-privacidade",
  "/reset-password", "/unsubscribe", "/formulario-equipe", "/formulario-dinamico",
  "/formulario-dashboard", "/usuario-bloqueado", "/index", "/index.html", "/home",
  "/not-found", "/meu-perfil", "/aguardando-aprovacao", "/cofre-share", "/portal", "*",
]);
const CHILD_SUFFIX = ["/novo", "/sync", "/auditoria", "/conciliacao", "/builder", "/importar",
  "/exportacao-erp", "/sync-cadastros", "/preferencias", "/configuracao"];

function isChildOf(path) {
  // Param routes are always treated as detail/wizard children.
  if (path.includes(":")) return true;
  for (const suf of CHILD_SUFFIX) if (path.endsWith(suf)) return true;
  // Parent in menu? — but require a meaningful parent (>= 3 segments),
  // i.e. ignore matches against `/dashboard` itself, which is too generic.
  const parts = path.split("/");
  while (parts.length > 3) {
    parts.pop();
    const parent = parts.join("/");
    if (menuRoutes.has(parent)) return parent;
  }
  return false;
}


function classify(r) {
  const p = r.path;
  if (exclusions[p]) return { bucket: exclusions[p].bucket, reason: exclusions[p].reason ?? "override" };
  if (PUBLIC_EXACT.has(p)) return { bucket: "A", reason: "public/auth" };
  for (const pre of PUBLIC_PREFIX) if (p.startsWith(pre)) return { bucket: "A", reason: "public prefix" };
  if (p.startsWith("/dashboard/crm/") || ["analytics","bots","contatos","inbox","tickets","configuracoes"].includes(p)) {
    return { bucket: "C", reason: "CRM nested tab" };
  }
  const childOf = isChildOf(p);
  if (childOf) return { bucket: "B", reason: typeof childOf === "string" ? `child of ${childOf}` : "wizard/detail" };
  const isAdmin = p.startsWith("/admin/") || p.startsWith("/dashboard/admin/")
    || p.startsWith("/dashboard/security") || p.startsWith("/dashboard/seguranca")
    || p === "/dashboard/trilha-auditoria-acessos"
    || p === "/dashboard/preferencias-ui"
    || p === "/dashboard/admin-api-support"
    || p.startsWith("/configuracoes/admin/")
    || p.startsWith("/dashboard/configuracoes/");
  if (isAdmin) return { bucket: "D", reason: "admin/diagnostic" };
  return { bucket: "E", reason: "feature órfã real" };
}

const orphans = routes
  .filter((r) => !menuRoutes.has(r.path))
  .map((r) => ({ ...r, ...classify(r) }))
  .sort((a, b) => a.bucket.localeCompare(b.bucket) || a.path.localeCompare(b.path));

const buckets = { A: [], B: [], C: [], D: [], E: [] };
for (const o of orphans) buckets[o.bucket].push(o);

// ---------- 4. Render ----------
const totals = {
  routes: routes.length,
  menu: menuRoutes.size,
  orphans: orphans.length,
};

const labels = {
  A: "Public / auth (intencional fora do menu)",
  B: "Child / wizard / detail (intencional fora do menu)",
  C: "CRM nested (intencional fora do menu)",
  D: "Admin / diagnóstico (cadastrar com require_admin)",
  E: "Feature órfã real (cadastrar no módulo correto)",
};

const out = [];
out.push("# ORPHAN ROUTES — snapshot gerado");
out.push("");
out.push("> Gerado por `scripts/audit/orphan-routes-triage.mjs`. Não editar à mão.");
out.push("> Manualmente reclassifique via `scripts/audit/orphan-routes-exclusions.json`.");
out.push("");
out.push("## Totais");
out.push("");
out.push(`- Rotas únicas em \`src/App.tsx\`: **${totals.routes}**`);
out.push(`- Rotas ativas em \`sidebar_menu_items\`:  **${totals.menu}**`);
out.push(`- **Órfãs (no roteador, ausentes do menu): ${totals.orphans}**`);
out.push("");
out.push("| Bucket | Quantidade |");
out.push("| --- | ---: |");
for (const k of ["A","B","C","D","E"]) out.push(`| **${k}** — ${labels[k]} | ${buckets[k].length} |`);
out.push("");

for (const k of ["D","E","A","B","C"]) {
  out.push(`## Bucket ${k} — ${labels[k]}`);
  out.push("");
  if (buckets[k].length === 0) { out.push("_(vazio)_"); out.push(""); continue; }
  out.push("| Rota | Linha | Guard | module_code | screen_code | Motivo |");
  out.push("| --- | ---: | --- | --- | --- | --- |");
  for (const o of buckets[k]) {
    out.push(`| \`${o.path}\` | ${o.line} | ${o.guard.kind} | ${o.guard.moduleCode ?? "—"} | ${o.guard.screenCode ?? "—"} | ${o.reason} |`);
  }
  out.push("");
}

out.push("## Próximos passos");
out.push("");
out.push("1. Revise buckets **D** e **E** — cada linha vira um `INSERT` em `sidebar_menu_items`.");
out.push("2. Para reclassificar uma rota, adicione em `scripts/audit/orphan-routes-exclusions.json`:");
out.push("   ```json");
out.push("   { \"/dashboard/exemplo\": { \"bucket\": \"B\", \"reason\": \"acessada via tab interno\" } }");
out.push("   ```");
out.push("3. Após aprovação, a migration cadastra D+E preservando `require_admin` e `screen_code`.");
out.push("");

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, out.join("\n"));
console.log(`wrote ${OUT}`);
console.log(`totals: routes=${totals.routes} menu=${totals.menu} orphans=${totals.orphans}`);
for (const k of ["A","B","C","D","E"]) console.log(`  bucket ${k}: ${buckets[k].length}`);

// Emit also a machine-readable JSON for the migration step
const JSON_OUT = "docs/audit/2026-Q2/generated/ORPHAN_ROUTES.snapshot.json";
writeFileSync(JSON_OUT, JSON.stringify({ totals, buckets }, null, 2));
console.log(`wrote ${JSON_OUT}`);
