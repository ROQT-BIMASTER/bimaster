import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Regra de lint: nenhum componente em src/components/chat/** ou src/hooks/chat/**
 * pode importar de react-router-dom — o ChatDrawer é montado FORA de <Router>
 * via ChatDrawerProvider no shell global (App.tsx envelopa BrowserRouter em
 * ChatDrawerProvider), então qualquer hook OU componente do react-router
 * (useNavigate, useLocation, Link, NavLink, Outlet, Navigate, etc.) explode
 * a tela inteira quando o drawer é aberto.
 *
 * Para navegação programática, use window.location. Para links, use <a>.
 */

const FORBIDDEN_SYMBOLS = [
  // hooks
  "useLocation",
  "useNavigate",
  "useParams",
  "useMatch",
  "useRoutes",
  "useSearchParams",
  // componentes que também exigem contexto do Router
  "Link",
  "NavLink",
  "Outlet",
  "Navigate",
  "Routes",
  "Route",
];

const ROOTS = ["src/components/chat", "src/hooks/chat"];

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "__tests__" || entry.endsWith(".test.ts") || entry.endsWith(".test.tsx")) continue;
    const p = join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, acc);
    else if (/\.(ts|tsx)$/.test(entry)) acc.push(p);
  }
  return acc;
}

describe("Chat lint: no react-router usage outside Router", () => {
  const files = ROOTS.flatMap((r) => walk(r));

  it("encontra arquivos para auditar", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    it(`${file} não importa nada de react-router-dom`, () => {
      const src = readFileSync(file, "utf8");
      const importRe = /from\s+["']react-router-dom["']/;
      expect(
        importRe.test(src),
        `${file} importa de react-router-dom — proibido em chat/** (drawer fica fora do Router)`,
      ).toBe(false);
      // Salvaguarda extra: mesmo sem import explícito, nenhum símbolo do
      // react-router deve aparecer em uso.
      for (const sym of FORBIDDEN_SYMBOLS) {
        const useRe = new RegExp(`\\b${sym}\\s*[\\(<]`);
        if (useRe.test(src) && importRe.test(src)) {
          expect.fail(`${file} usa ${sym} do react-router — proibido em chat/**`);
        }
      }
    });
  }
});

