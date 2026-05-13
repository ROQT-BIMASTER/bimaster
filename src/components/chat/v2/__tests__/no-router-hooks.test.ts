import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Regra de lint: nenhum componente em src/components/chat/** ou src/hooks/chat/**
 * pode importar useLocation/useNavigate/useParams/useRoutes/useMatch de
 * react-router-dom — o ChatDrawer é montado FORA de <Router> via
 * ChatDrawerProvider no shell global, então qualquer hook de Router quebra
 * a tela inteira.
 *
 * Para navegação programática dentro do chat, use window.location ou o helper
 * useBrowserPathname (escuta popstate + history). Para links, use <a>
 * comum quando estiver fora de Router, ou Link dentro de páginas /chat.
 */

const ROUTER_HOOKS = [
  "useLocation",
  "useNavigate",
  "useParams",
  "useMatch",
  "useRoutes",
  "useSearchParams",
];

const ROOTS = ["src/components/chat", "src/hooks/chat"];

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, acc);
    else if (/\.(ts|tsx)$/.test(entry)) acc.push(p);
  }
  return acc;
}

describe("Chat lint: no react-router hooks outside Router", () => {
  const files = ROOTS.flatMap((r) => walk(r));

  it("encontra arquivos para auditar", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    it(`${file} não usa hooks do react-router-dom`, () => {
      const src = readFileSync(file, "utf8");
      // Detecta tanto import nomeado quanto chamada
      const importRe = /from\s+["']react-router-dom["']/;
      if (!importRe.test(src)) return;
      for (const hook of ROUTER_HOOKS) {
        const re = new RegExp(`\\b${hook}\\s*\\(`);
        expect(re.test(src), `${file} chama ${hook}() — proibido em chat/**`).toBe(false);
      }
    });
  }
});
