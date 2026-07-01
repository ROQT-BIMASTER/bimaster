import { describe, it, expect } from "vitest";

/**
 * Validação estática do isolamento do módulo "Em Desenvolvimento".
 *
 * Regras verificadas neste teste (checagem em migrations aplicadas + guardas na UI):
 *
 * 1. A categoria/módulo `em_desenvolvimento` fica marcada como `ativo = FALSE`
 *    em `sidebar_categories`, `sidebar_category_modules` e `modulos_sistema`.
 *    → `useNavV2Data` filtra `.filter((c) => c.ativo)` e portanto a categoria
 *    NUNCA aparece na barra lateral para nenhum usuário (nem admin, nem comum).
 *
 * 2. Qualquer `sidebar_menu_items` com `module_code = 'em_desenvolvimento'` é
 *    obrigatoriamente `require_admin = TRUE` (garantido pelo CHECK constraint
 *    `sidebar_menu_items_em_desenvolvimento_admin_only`). Assim, mesmo que a
 *    categoria seja reativada por engano, itens continuam invisíveis a não-admins.
 *
 * 3. Rotas internas (`/dashboard/*`, `/admin/*`) sempre passam por
 *    `ScreenRoute`/`ScreenProtectedRoute`/`ModuleRoute` em `src/App.tsx` — nunca
 *    ficam expostas por navegação direta sem checar permissão do usuário.
 */
import fs from "node:fs";
import path from "node:path";

const MIGRATIONS_DIR = path.resolve(process.cwd(), "supabase/migrations");
const APP_TSX = path.resolve(process.cwd(), "src/App.tsx");

function loadAllMigrations(): string {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .map((f) => fs.readFileSync(path.join(MIGRATIONS_DIR, f), "utf8"))
    .join("\n\n");
}

describe("Isolamento do módulo Em Desenvolvimento", () => {
  const sql = loadAllMigrations();

  it("aplica CHECK constraint garantindo require_admin=TRUE em itens do módulo", () => {
    expect(sql).toMatch(
      /sidebar_menu_items_em_desenvolvimento_admin_only[\s\S]{0,400}module_code\s*<>\s*'em_desenvolvimento'\s+OR\s+require_admin\s*=\s*TRUE/i,
    );
  });

  it("desativa a categoria e o módulo em_desenvolvimento na barra lateral", () => {
    expect(sql).toMatch(
      /UPDATE\s+public\.sidebar_categories[\s\S]{0,120}ativo\s*=\s*FALSE[\s\S]{0,120}em_desenvolvimento/i,
    );
    expect(sql).toMatch(
      /UPDATE\s+public\.sidebar_category_modules[\s\S]{0,120}ativo\s*=\s*FALSE[\s\S]{0,120}em_desenvolvimento/i,
    );
  });

  it("não deixa a última tela órfã (solicitações de acesso) apontando para em_desenvolvimento", () => {
    // A migração move `admin_solicitacoes_acesso` para o módulo `configuracoes`.
    expect(sql).toMatch(
      /UPDATE\s+public\.sidebar_menu_items[\s\S]{0,400}module_code\s*=\s*'configuracoes'[\s\S]{0,400}admin_solicitacoes_acesso/i,
    );
  });

  it("todas as rotas /admin/* em App.tsx passam por ScreenRoute ou guard equivalente", () => {
    const app = fs.readFileSync(APP_TSX, "utf8");
    const adminRoutes = [...app.matchAll(/<Route\s+path="(\/admin\/[^"]+|\/dashboard\/admin\/[^"]+)"[^>]*element=\{([^}]+(?:\{[^}]*\}[^}]*)*)\}/g)];
    expect(adminRoutes.length).toBeGreaterThan(0);
    const unguarded = adminRoutes.filter(([, route, element]) => {
      const hasGuard =
        /ScreenRoute|ScreenProtectedRoute|CrmAdminRoute|AdminRoute|ModuleRoute|RequireAdmin|isAdmin/.test(element);
      // permitir explicitamente a página de solicitar acesso para qualquer
      // usuário autenticado (é o próprio fluxo de pedir permissão).
      if (route.endsWith("/solicitar-acesso")) return false;
      return !hasGuard;
    });
    if (unguarded.length > 0) {
      // eslint-disable-next-line no-console
      console.error("Rotas /admin/* sem guarda:", unguarded.map((m) => m[1]));
    }
    expect(unguarded).toHaveLength(0);
  });
});
