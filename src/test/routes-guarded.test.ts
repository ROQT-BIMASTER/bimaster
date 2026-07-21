import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Invariante de segurança:
 *   Toda <Route path="/dashboard/..."> em src/App.tsx deve carregar um guard
 *   de módulo ou tela (ScreenProtectedRoute, ModuleProtectedRoute, ScreenRoute,
 *   ModuleRoute, ModuleScreenRoute) ou ser um redirect <Navigate />.
 *
 *   ProtectedRoute puro (só autenticação) é aceitável apenas para rotas neutras
 *   já contempladas por DEFAULT_MODULES/DEFAULT_SCREENS em PermissionsContext
 *   (perfil, preferências, MFA, ajuda, instalar-app, dashboard root/redirect).
 *
 *   Rota /dashboard/* catch-all é obrigatória e deve renderizar AccessDenied.
 */
const APP_TSX = readFileSync(join(process.cwd(), "src/App.tsx"), "utf8");

const NEUTRAL_ROUTES = new Set([
  "/dashboard",
  "/dashboard/preferencias-ui",
  "/dashboard/instalar-app",
  "/dashboard/security/mfa",
  "/dashboard/ajuda/projetos-visibilidade",
]);

const GUARD_TOKENS = [
  "ScreenProtectedRoute",
  "ModuleProtectedRoute",
  "ScreenRoute",
  "ModuleRoute",
  "ModuleScreenRoute",
  "CrmAdminRoute",
  "ClienteProtectedRoute",
];

// Match <Route path="/dashboard/..." element={...}/> — permite element inline ou multiline.
const routeRegex = /<Route\s+path="(\/dashboard(?:\/[^"]*)?)"\s+element=\{([\s\S]*?)\}\s*\/>/g;

interface RouteEntry {
  path: string;
  element: string;
}

function extractRoutes(): RouteEntry[] {
  const out: RouteEntry[] = [];
  let m: RegExpExecArray | null;
  while ((m = routeRegex.exec(APP_TSX)) !== null) {
    out.push({ path: m[1], element: m[2] });
  }
  return out;
}

describe("Route guards — /dashboard/* fail-closed", () => {
  const routes = extractRoutes();

  it("encontra ao menos 50 rotas /dashboard/* (sanity)", () => {
    expect(routes.length).toBeGreaterThan(50);
  });

  it("toda rota /dashboard/* usa guard de módulo/tela, redirect ou está na allowlist neutra", () => {
    const offenders: string[] = [];
    for (const { path, element } of routes) {
      // Redirects são inofensivos (levam a outra rota que será validada).
      if (/<Navigate\s+to=/.test(element)) continue;
      // Allowlist explícita de rotas neutras.
      if (NEUTRAL_ROUTES.has(path)) continue;

      const hasGuard = GUARD_TOKENS.some((t) => element.includes(t));
      if (!hasGuard) {
        offenders.push(path);
      }
    }
    expect(
      offenders,
      `Rotas /dashboard/* sem guard de módulo/tela (usar ScreenRoute/ModuleScreenRoute ou adicionar à NEUTRAL_ROUTES se realmente neutra): ${offenders.join(", ")}`,
    ).toEqual([]);
  });

  it("existe fallback fail-closed /dashboard/* com AccessDenied", () => {
    expect(APP_TSX).toMatch(/path="\/dashboard\/\*"[\s\S]{0,200}AccessDenied/);
  });
});
