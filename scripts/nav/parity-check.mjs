#!/usr/bin/env node
/**
 * Nav Parity Check — v1 ↔ v2 ↔ App.tsx
 *
 * Garante paridade de rotas/permissões entre a navegação clássica (v1 —
 * hardcoded em src/components/dashboard/AppSidebar.tsx) e a navegação v2
 * (dirigida pela tabela public.sidebar_menu_items), e detecta telas
 * "perdidas" (rotas registradas em src/App.tsx que não aparecem em
 * nenhuma sidebar).
 *
 * Saídas:
 *   - JSON detalhado em stdout (ou arquivo via --out=<path>)
 *   - Resumo humano em stderr
 *   - Exit code 1 quando houver violação dura:
 *       (a) rota presente em v1 e ausente em v2   -> paridade quebrada
 *       (b) rota em sidebar_menu_items sem <Route> -> link morto
 *       (c) telas órfãs acima do limiar tolerado  -> --max-orphans=N
 *
 * Uso:
 *   node scripts/nav/parity-check.mjs [--max-orphans=0] [--allow-missing-db]
 *
 * Sem VITE_SUPABASE_URL / _PUBLISHABLE_KEY: só valida parte estática
 * (App.tsx vs v1). Passe --allow-missing-db para não falhar nesse cenário
 * (usado no job de PR quando não há acesso ao backend).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? true];
  }),
);
const MAX_ORPHANS = Number(args["max-orphans"] ?? 0);
const ALLOW_MISSING_DB = Boolean(args["allow-missing-db"]);
const OUT = typeof args.out === "string" ? args.out : null;

const APP_TSX = resolve("src/App.tsx");
const V1_SIDEBAR = resolve("src/components/dashboard/AppSidebar.tsx");

/** Normaliza uma rota para comparação (remove params, trailing slash). */
function norm(route) {
  if (!route) return "";
  let r = route.trim();
  if (!r.startsWith("/")) r = "/" + r;
  // Remove segmentos de parâmetro (:id, :slug, *)
  r = r.replace(/\/:[^/]+/g, "").replace(/\/\*$/, "").replace(/\*$/, "");
  // Remove trailing slash (exceto raiz)
  if (r.length > 1 && r.endsWith("/")) r = r.slice(0, -1);
  return r || "/";
}

function extractAppRoutes() {
  const src = readFileSync(APP_TSX, "utf8");
  const rx = /<Route\s+[^>]*\bpath=["']([^"']+)["']/g;
  const out = new Set();
  let m;
  while ((m = rx.exec(src))) {
    const raw = m[1];
    if (raw === "*" || raw === "/") continue;
    out.add(norm(raw));
  }
  return out;
}

function extractV1SidebarRoutes() {
  const src = readFileSync(V1_SIDEBAR, "utf8");
  const out = new Set();
  // NavLink to="/x" e Link to="/x"
  const rx1 = /\bto=["'](\/[^"'#?]+)["']/g;
  let m;
  while ((m = rx1.exec(src))) out.add(norm(m[1]));
  // navigate("/x") e useNavigate patterns dentro do sidebar
  const rx2 = /\bnavigate\(\s*["'](\/[^"']+)["']/g;
  while ((m = rx2.exec(src))) out.add(norm(m[1]));
  return out;
}

async function fetchV2Routes() {
  const url = process.env.VITE_SUPABASE_URL;
  const key =
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  const endpoint =
    `${url}/rest/v1/sidebar_menu_items` +
    `?select=id,item_code,label,route,module_code,ativo,require_admin,require_admin_or_supervisor,screen_code` +
    `&ativo=eq.true`;
  const res = await fetch(endpoint, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    throw new Error(`Falha ao consultar sidebar_menu_items: ${res.status} ${res.statusText}`);
  }
  const rows = await res.json();
  if (!Array.isArray(rows) || rows.length === 0) {
    // A tabela nunca está vazia em produção — 0 linhas quase sempre indica
    // RLS bloqueando (publishable/anon key sem sessão). Sinalize para o caller.
    throw new Error(
      "sidebar_menu_items retornou 0 linhas — provavelmente RLS bloqueou (use SUPABASE_SERVICE_ROLE_KEY em CI)",
    );
  }
  const byRoute = new Map();
  for (const r of rows) {
    if (!r.route) continue;
    const k = norm(r.route);
    if (!byRoute.has(k)) byRoute.set(k, []);
    byRoute.get(k).push(r);
  }
  return byRoute;
}

/**
 * Rotas que NÃO precisam aparecer em nenhuma sidebar (públicas, auth,
 * páginas de erro, deep-links de convite, portais externos etc.).
 * Ampliar essa lista sempre é preferível a criar exceções pontuais.
 */
const ALLOWED_ORPHAN_PREFIXES = [
  "/auth",
  "/aguardando-aprovacao",
  "/cofre-share",
  "/publico",
  "/public",
  "/convite",
  "/portal",
  "/embed",
  "/share",
  "/link",
  "/erro",
  "/404",
  "/403",
  "/500",
  "/health",
];

function isAllowedOrphan(route) {
  return ALLOWED_ORPHAN_PREFIXES.some((p) => route === p || route.startsWith(p + "/"));
}

async function main() {
  const appRoutes = extractAppRoutes();
  const v1Routes = extractV1SidebarRoutes();
  let v2Map = null;
  let v2Error = null;
  try {
    v2Map = await fetchV2Routes();
  } catch (e) {
    v2Error = String(e?.message || e);
  }

  const v2Routes = v2Map ? new Set(v2Map.keys()) : null;

  // (a) v1 -> v2: rotas em v1 sem correspondente em v2 = paridade perdida
  const v1MissingInV2 = v2Routes
    ? [...v1Routes].filter((r) => !v2Routes.has(r) && !isAllowedOrphan(r))
    : [];

  // (b) v2 -> App.tsx: rotas registradas em sidebar_menu_items sem <Route>
  const v2DeadLinks = v2Routes
    ? [...v2Routes].filter((r) => !appRoutes.has(r))
    : [];

  // (c) App.tsx -> (v1 ∪ v2): telas órfãs (registradas mas invisíveis)
  const orphans = [...appRoutes].filter((r) => {
    if (isAllowedOrphan(r)) return false;
    if (v1Routes.has(r)) return false;
    if (v2Routes && v2Routes.has(r)) return false;
    return true;
  });

  const report = {
    generatedAt: new Date().toISOString(),
    counts: {
      appRoutes: appRoutes.size,
      v1SidebarRoutes: v1Routes.size,
      v2SidebarRoutes: v2Routes ? v2Routes.size : null,
      v1MissingInV2: v1MissingInV2.length,
      v2DeadLinks: v2DeadLinks.length,
      orphans: orphans.length,
    },
    v1MissingInV2: v1MissingInV2.sort(),
    v2DeadLinks: v2DeadLinks.sort(),
    orphans: orphans.sort(),
    v2Fetched: Boolean(v2Routes),
    v2Error,
  };

  const json = JSON.stringify(report, null, 2);
  if (OUT) writeFileSync(OUT, json);
  else process.stdout.write(json + "\n");

  const log = (s) => process.stderr.write(s + "\n");
  log("═══ Nav Parity Check ═══");
  log(`App.tsx routes:       ${report.counts.appRoutes}`);
  log(`v1 sidebar routes:    ${report.counts.v1SidebarRoutes}`);
  log(
    `v2 sidebar routes:    ${
      report.counts.v2SidebarRoutes ?? "n/a (sem credenciais de backend)"
    }`,
  );
  log(`Paridade v1→v2:       ${v1MissingInV2.length} rota(s) perdida(s)`);
  log(`Links mortos v2:      ${v2DeadLinks.length}`);
  log(`Telas órfãs:          ${orphans.length} (limite=${MAX_ORPHANS})`);

  const violations = [];
  if (v2Routes) {
    if (v1MissingInV2.length > 0) {
      violations.push(
        `paridade v1→v2: ${v1MissingInV2.length} rota(s) presentes na sidebar clássica não estão no menu v2:\n  - ${v1MissingInV2.join("\n  - ")}`,
      );
    }
    if (v2DeadLinks.length > 0) {
      violations.push(
        `links mortos v2: ${v2DeadLinks.length} entrada(s) apontam para rotas inexistentes em App.tsx:\n  - ${v2DeadLinks.join("\n  - ")}`,
      );
    }
  } else if (!ALLOW_MISSING_DB) {
    violations.push(
      `não foi possível consultar sidebar_menu_items (${v2Error ?? "sem VITE_SUPABASE_URL/PUBLISHABLE_KEY"}). ` +
        `Rode com --allow-missing-db para tolerar.`,
    );
  }
  if (orphans.length > MAX_ORPHANS) {
    violations.push(
      `telas órfãs acima do limite (${orphans.length} > ${MAX_ORPHANS}):\n  - ${orphans.slice(0, 40).join("\n  - ")}${
        orphans.length > 40 ? `\n  ... (+${orphans.length - 40})` : ""
      }`,
    );
  }

  if (violations.length > 0) {
    log("");
    log("✖ Violações:");
    for (const v of violations) log("  • " + v);
    process.exit(1);
  }
  log("✓ OK");
}

main().catch((e) => {
  console.error("parity-check falhou:", e);
  process.exit(2);
});
