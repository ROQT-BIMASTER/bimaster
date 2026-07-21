/**
 * Nav parity — static regression guard.
 *
 * Executa o mesmo extrator do `scripts/nav/parity-check.mjs` (sem consultar
 * o backend) e valida que não regredimos:
 *   - Nenhuma rota é adicionada apenas em App.tsx ou v1 sem contrapartida
 *     razoável (limite máximo de rotas órfãs estáticas).
 *   - Nenhum novo pattern de deep-link "silencioso" aparece no rail v1.
 *
 * O check completo v1↔v2 (com sidebar_menu_items) roda em CI via
 * `.github/workflows/nav-parity.yml` quando SUPABASE_SERVICE_ROLE_KEY
 * está disponível. Este teste é a rede de proteção offline.
 */
import { execFileSync } from "node:child_process";
import { describe, it, expect } from "vitest";

const BASELINE = {
  // Ajustado em 2026-07-21 após inclusão de /dashboard/tarefas/modelos
  // (gestão de modelos de tarefa, acessada por botão dentro da UI de
  // projetos — intencionalmente sem entrada de sidebar).
  // Diminuir é sempre bem-vindo; aumentar exige mover a rota para uma
  // sidebar ou incluir seu prefixo em ALLOWED_ORPHAN_PREFIXES.
  maxOrphans: 265,
};

describe("nav parity (static)", () => {
  it("não regride o número de rotas órfãs (App.tsx sem sidebar)", () => {
    const out = execFileSync(
      "node",
      [
        "scripts/nav/parity-check.mjs",
        "--allow-missing-db",
        `--max-orphans=${BASELINE.maxOrphans}`,
      ],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
    const report = JSON.parse(out);
    expect(report.counts.orphans).toBeLessThanOrEqual(BASELINE.maxOrphans);
    // Se um dia zerar orphans, atualize o BASELINE para travar em 0.
    expect(report.counts.appRoutes).toBeGreaterThan(100);
    expect(report.counts.v1SidebarRoutes).toBeGreaterThan(50);
  });
});
